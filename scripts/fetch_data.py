#!/usr/bin/env python3
"""
fetch_data.py — download all raw climate/energy series for Global Warming Monitor.

Design goals:
  * Every endpoint download is independently wrapped: one failure never kills the run.
  * Each source can list multiple candidate URLs (fallbacks for URL rot / version bumps).
  * Every downloaded file is validated (size, expected content marker, minimum line count)
    before it is accepted — an HTML error page saved as "data.csv" counts as a failure.
  * The run ends with a human-readable summary table and a machine-readable
    data/raw/fetch_report.json, and exits non-zero if any REQUIRED source failed.

Usage:
    python3 scripts/fetch_data.py            # fetch everything
    python3 scripts/fetch_data.py co2 seaice # fetch only the named source ids

Optional:
    EIA_API_KEY=...  enables monthly US electricity demand from the EIA v2 API.
    Without it, the OWID annual electricity-demand series is used instead (still fetched).

Stdlib only — no pip installs required.
"""

from __future__ import annotations

import json
import os
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
TIMEOUT_S = 60
RETRIES = 3
BACKOFF_S = 4  # 4s, 8s, 16s


def _load_dotenv() -> None:
    """Load key=value pairs from <repo-root>/.env into os.environ.

    Real environment variables always take precedence — this only sets values
    that are not already present.  Uses stdlib only; no third-party packages.
    Lines that are empty, start with '#', or lack '=' are silently ignored.
    Values may be optionally quoted with single or double quotes.
    """
    env_file = ROOT / ".env"
    if not env_file.is_file():
        return
    with env_file.open(encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            # Strip optional surrounding quotes
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            if key and key not in os.environ:
                os.environ[key] = value


_load_dotenv()

_contact = os.environ.get("CONTACT_EMAIL", "").strip()
if not _contact:
    print(
        "WARNING: CONTACT_EMAIL is not set. Set it in .env so data providers "
        "can identify your requests.",
        file=sys.stderr,
    )
USER_AGENT = (
    "GlobalWarmingMonitor/1.0 (personal research/education project; "
    f"contact: {_contact})"
)

# ---------------------------------------------------------------------------
# Source registry
# ---------------------------------------------------------------------------

@dataclass
class Source:
    id: str
    name: str
    urls: list[str]                 # tried in order; first valid response wins
    filename: str                   # saved under data/raw/
    must_contain: str               # substring that must appear in the payload
    min_lines: int                  # minimum number of newline-separated lines
    min_bytes: int = 500
    required: bool = True           # required sources gate the exit code
    landing_page: str = ""          # where a human should look if all URLs rot
    notes: str = ""


def _owid(slug: str, countries: str | None = None) -> str:
    """OWID grapher CSV API URL."""
    base = f"https://ourworldindata.org/grapher/{slug}.csv"
    params = {"v": "1", "csvType": "filtered" if countries else "full",
              "useColumnShortNames": "true"}
    if countries:
        params["country"] = countries
    return base + "?" + urllib.parse.urlencode(params, safe="~")


SOURCES: list[Source] = [
    Source(
        id="co2",
        name="Atmospheric CO2, Mauna Loa monthly (NOAA GML)",
        urls=[
            "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv",
            "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt",
        ],
        filename="co2_mm_mlo.csv",
        must_contain="1958",
        min_lines=500,
        landing_page="https://gml.noaa.gov/ccgg/trends/data.html",
    ),
    Source(
        id="emissions",
        name="Global fossil CO2 emissions, annual (Global Carbon Project via OWID)",
        urls=[
            _owid("annual-co2-emissions-per-country", countries="OWID_WRL"),
            _owid("annual-co2-emissions-per-country"),
        ],
        filename="owid_co2_emissions.csv",
        must_contain="World",
        min_lines=50,
        landing_page="https://ourworldindata.org/grapher/annual-co2-emissions-per-country",
    ),
    Source(
        id="electricity_owid",
        name="Electricity demand, annual US + World (Ember via OWID)",
        urls=[
            _owid("electricity-demand", countries="USA~OWID_WRL"),
            _owid("electricity-demand"),
        ],
        filename="owid_electricity_demand.csv",
        must_contain="United States",
        min_lines=20,
        landing_page="https://ourworldindata.org/grapher/electricity-demand",
    ),
    Source(
        id="electricity_eia",
        name="US net electricity generation, monthly",
        urls=[],  # built at runtime from the API key
        filename="eia_us_generation.json",
        must_contain='"response"',
        min_lines=1,
        required=False,
        landing_page="https://www.eia.gov/opendata/",
        notes="Free key at eia.gov/opendata. Optional: OWID annual series is the fallback.",
    ),
    Source(
        id="gistemp",
        name="Global surface temperature anomaly, monthly (NASA GISTEMP v4)",
        urls=[
            "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv",
        ],
        filename="gistemp_glb.csv",
        must_contain="Land-Ocean",
        min_lines=100,
        landing_page="https://data.giss.nasa.gov/gistemp/",
    ),
    Source(
        id="sst",
        name="Global ocean surface temp anomaly, monthly (NOAA NCEI Climate at a Glance)",
        urls=[
            "https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series/globe/ocean/all/1/1850-2030/data.csv",
            "https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series/globe/ocean/1/0/1850-2030/data.csv",
            "https://www.ncdc.noaa.gov/cag/global/time-series/globe/ocean/all/1/1850-2030/data.csv",
        ],
        filename="ncei_ocean_anomaly.csv",
        must_contain="Anomaly",
        min_lines=200,
        landing_page="https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series",
    ),
    Source(
        id="ohc",
        name="Ocean heat content 0-700m, yearly (NOAA NCEI)",
        urls=[
            "https://www.ncei.noaa.gov/data/oceans/woa/DATA_ANALYSIS/3M_HEAT_CONTENT/DATA/basin/yearly/h22-w0-700m.dat",
            "https://www.ncei.noaa.gov/access/global-ocean-heat-content/data/basin/yearly/h22-w0-700m.dat",
        ],
        filename="ncei_ohc_0-700m.dat",
        must_contain="WO",
        min_lines=40,
        landing_page="https://www.ncei.noaa.gov/access/global-ocean-heat-content/basin_heat_data.html",
        notes="If URLs rot, the landing page links the current h22-w0-700m yearly file.",
    ),
    Source(
        id="sealevel",
        name="Global mean sea level, altimetry (NOAA STAR / OWID fallback)",
        urls=[
            "https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/slr/slr_sla_gbl_free_txj1j2_90.csv",
            "https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/slr/slr_sla_gbl_keep_txj1j2_90.csv",
            "https://www.star.nesdis.noaa.gov/sod/lsa/SeaLevelRise/slr/slr_sla_gbl_free_txj1j2_90.csv",
            _owid("sea-level"),  # CSIRO + NOAA reconstruction, different format, parser handles both
        ],
        filename="sealevel_gmsl.csv",
        must_contain="19",
        min_lines=100,
        landing_page="https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/",
    ),
    Source(
        id="seaice",
        name="Arctic sea ice extent, September monthly mean (NSIDC Sea Ice Index)",
        urls=[
            "https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/N_09_extent_v4.0.csv",
            "https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/N_09_extent_v3.0.csv",
        ],
        filename="nsidc_n09_extent.csv",
        must_contain="extent",
        min_lines=40,
        landing_page="https://nsidc.org/data/seaice_index/data-and-image-archive",
    ),
    Source(
        id="icesheets",
        name="Ice sheet cumulative mass change, Greenland + Antarctica (IMBIE/NASA via OWID)",
        urls=[
            _owid("ice-sheet-mass-balance"),
        ],
        filename="owid_ice_sheets.csv",
        must_contain="Greenland",
        min_lines=50,
        landing_page="https://ourworldindata.org/grapher/ice-sheet-mass-balance",
    ),
]

# ---------------------------------------------------------------------------
# Download machinery
# ---------------------------------------------------------------------------

@dataclass
class Result:
    source: Source
    status: str = "PENDING"     # OK | OK-FALLBACK | SKIPPED | FAILED
    url_used: str = ""
    bytes: int = 0
    attempts: list[dict] = field(default_factory=list)
    reason: str = ""


class ValidationError(Exception):
    pass


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/csv, text/plain, application/json, */*",
    })
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=TIMEOUT_S, context=ctx) as resp:
        return resp.read()


def validate(payload: bytes, src: Source) -> None:
    if len(payload) < src.min_bytes:
        raise ValidationError(f"payload too small ({len(payload)} bytes < {src.min_bytes})")
    head = payload[:4096].lstrip().lower()
    if head.startswith(b"<!doctype html") or head.startswith(b"<html"):
        raise ValidationError("server returned an HTML page, not data (likely an error page)")
    text = payload.decode("utf-8", errors="replace")
    if src.must_contain not in text:
        raise ValidationError(f"expected marker {src.must_contain!r} not found in payload")
    if text.count("\n") + 1 < src.min_lines:
        raise ValidationError(f"only {text.count(chr(10)) + 1} lines (< {src.min_lines} expected)")


def classify_error(exc: Exception) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        return f"HTTP {exc.code} {exc.reason}"
    if isinstance(exc, urllib.error.URLError):
        r = exc.reason
        if isinstance(r, socket.timeout) or "timed out" in str(r):
            return f"timeout after {TIMEOUT_S}s"
        if isinstance(r, socket.gaierror):
            return f"DNS failure ({r})"
        return f"connection error ({r})"
    if isinstance(exc, (socket.timeout, TimeoutError)):
        return f"timeout after {TIMEOUT_S}s"
    if isinstance(exc, ssl.SSLError):
        return f"TLS error ({exc})"
    if isinstance(exc, ValidationError):
        return f"validation failed: {exc}"
    return f"{type(exc).__name__}: {exc}"


def fetch_source(src: Source) -> Result:
    res = Result(source=src)
    urls = list(src.urls)

    if src.id == "electricity_eia":
        key = os.environ.get("EIA_API_KEY", "").strip()
        if not key:
            res.status = "SKIPPED"
            res.reason = "EIA_API_KEY not set — using OWID annual fallback for the demand chart"
            return res
        params = urllib.parse.urlencode({
            "api_key": key,
            "frequency": "monthly",
            "data[0]": "generation",
            "facets[location][]": "US",
            "facets[sectorid][]": "98",       # electric power sector
            "facets[fueltypeid][]": "ALL",
            "start": "2001-01",
            "sort[0][column]": "period",
            "sort[0][direction]": "asc",
            "offset": "0",
            "length": "5000",
        })
        urls = [f"https://api.eia.gov/v2/electricity/electric-power-operational-data/data/?{params}"]

    for i, url in enumerate(urls):
        for attempt in range(1, RETRIES + 1):
            label = url.split("?")[0]
            try:
                payload = http_get(url)
                validate(payload, src)
                dest = RAW_DIR / src.filename
                dest.write_bytes(payload)
                res.status = "OK" if i == 0 else "OK-FALLBACK"
                res.url_used = url.split("?")[0]  # never persist query strings (API keys)
                res.bytes = len(payload)
                res.attempts.append({"url": label, "attempt": attempt, "outcome": "ok"})
                return res
            except Exception as exc:  # noqa: BLE001 — deliberate catch-all per endpoint
                why = classify_error(exc)
                res.attempts.append({"url": label, "attempt": attempt, "outcome": why})
                transient = isinstance(exc, (urllib.error.URLError, socket.timeout,
                                             TimeoutError, ssl.SSLError)) and not (
                    isinstance(exc, urllib.error.HTTPError) and exc.code in (401, 403, 404))
                if isinstance(exc, ValidationError):
                    transient = False
                if attempt < RETRIES and transient:
                    time.sleep(BACKOFF_S * (2 ** (attempt - 1)))
                    continue
                break  # next candidate URL

    res.status = "FAILED"
    last = res.attempts[-1]["outcome"] if res.attempts else "no URLs configured"
    res.reason = last
    return res

# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def print_summary(results: list[Result]) -> None:
    print("\n" + "=" * 78)
    print("DOWNLOAD SUMMARY")
    print("=" * 78)
    icon = {"OK": "[OK]      ", "OK-FALLBACK": "[OK*]     ",
            "SKIPPED": "[SKIPPED] ", "FAILED": "[FAILED]  "}
    for r in results:
        line = f"{icon[r.status]}{r.source.id:<16} {r.source.name}"
        print(line)
        if r.status in ("OK", "OK-FALLBACK"):
            note = "  (fallback URL)" if r.status == "OK-FALLBACK" else ""
            print(f"           -> {r.source.filename}  {r.bytes:,} bytes{note}")
        elif r.status == "SKIPPED":
            print(f"           -> {r.reason}")
        else:
            print(f"           -> last error: {r.reason}")
            for a in r.attempts:
                print(f"              tried {a['url']} (attempt {a['attempt']}): {a['outcome']}")
            if r.source.landing_page:
                print(f"           -> check for a moved file: {r.source.landing_page}")
    ok = sum(r.status.startswith("OK") for r in results)
    failed = [r for r in results if r.status == "FAILED"]
    skipped = sum(r.status == "SKIPPED" for r in results)
    print("-" * 78)
    print(f"{ok} downloaded, {skipped} skipped, {len(failed)} failed "
          f"({sum(1 for r in failed if r.source.required)} of the failures are required sources)")
    if failed:
        print("Re-run just the failures with: python3 scripts/fetch_data.py "
              + " ".join(r.source.id for r in failed))


def write_report(results: list[Result]) -> None:
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sources": {
            r.source.id: {
                "name": r.source.name,
                "status": r.status,
                "url_used": r.url_used,
                "file": r.source.filename if r.status.startswith("OK") else None,
                "bytes": r.bytes,
                "reason": r.reason,
                "attempts": r.attempts,
                "landing_page": r.source.landing_page,
                "required": r.source.required,
            }
            for r in results
        },
    }
    (RAW_DIR / "fetch_report.json").write_text(json.dumps(report, indent=2))


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    wanted = set(sys.argv[1:])
    known = {s.id for s in SOURCES}
    unknown = wanted - known
    if unknown:
        print(f"Unknown source id(s): {', '.join(sorted(unknown))}")
        print(f"Known ids: {', '.join(sorted(known))}")
        return 2
    todo = [s for s in SOURCES if not wanted or s.id in wanted]

    print(f"Fetching {len(todo)} source(s) into {RAW_DIR} ...\n")
    results = []
    for src in todo:
        print(f"* {src.id}: {src.name}")
        r = fetch_source(src)
        results.append(r)
        print(f"  -> {r.status}" + (f" ({r.reason})" if r.reason else ""))

    print_summary(results)
    write_report(results)
    hard_fail = any(r.status == "FAILED" and r.source.required for r in results)
    return 1 if hard_fail else 0


if __name__ == "__main__":
    sys.exit(main())
