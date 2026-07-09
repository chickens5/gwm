#!/usr/bin/env python3
"""
process_data.py — turn the raw files in data/raw/ into the JSON the frontend reads
(web/public/data/*.json).

Same philosophy as fetch_data.py: every source is parsed inside its own try/except,
one malformed file never blocks the others, and the run ends with a summary plus a
meta.json the frontend uses to know what's available and how fresh it is.

Stdlib only. Run after fetch_data.py:
    python3 scripts/process_data.py
"""

from __future__ import annotations

import csv
import io
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "web" / "public" / "data"

MISSING = {"-99.99", "-999", "-9999", "-9.99", "", "***", "NaN", "nan"}


# ---------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------

def fnum(s: str) -> float | None:
    s = s.strip()
    if s in MISSING:
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    if v in (-99.99, -999.0, -9999.0):
        return None
    return v


def rolling12(points: list[dict]) -> None:
    """Attach t = trailing 12-month mean to monthly points (in place)."""
    vals = [p["v"] for p in points]
    for i in range(len(points)):
        if i >= 11:
            window = vals[i - 11 : i + 1]
            points[i]["t"] = round(sum(window) / 12, 4)


def ym(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def decyear_to_ym(dy: float) -> str:
    year = int(dy)
    month = min(12, max(1, int((dy - year) * 12) + 1))
    return ym(year, month)


def read_text(name: str) -> str:
    p = RAW / name
    if not p.exists():
        raise FileNotFoundError(f"{p.name} not found in data/raw — run fetch_data.py first")
    return p.read_text(encoding="utf-8", errors="replace")


def data_lines(text: str) -> list[str]:
    return [ln for ln in text.splitlines() if ln.strip() and not ln.lstrip().startswith("#")]


# ---------------------------------------------------------------------------
# per-source parsers  (each returns (payload_dict, summary_note))
# ---------------------------------------------------------------------------

def parse_co2() -> tuple[dict, str]:
    text = read_text("co2_mm_mlo.csv")
    points = []
    for ln in data_lines(text):
        parts = [p.strip() for p in re.split(r"[,\s]+", ln.strip()) if p.strip()]
        if len(parts) < 5 or not parts[0].isdigit():
            continue  # header row or stray text
        year, month = int(parts[0]), int(parts[1])
        avg, deseason = fnum(parts[3]), fnum(parts[4])
        if avg is None:
            continue
        pt = {"d": ym(year, month), "v": round(avg, 2)}
        if deseason is not None:
            pt["t"] = round(deseason, 2)
        points.append(pt)
    if len(points) < 500:
        raise ValueError(f"only parsed {len(points)} monthly CO2 rows — format may have changed")
    return ({"id": "co2", "unit": "ppm", "points": points},
            f"{len(points)} months, {points[0]['d']}..{points[-1]['d']}")


def _owid_rows(name: str) -> tuple[list[str], list[list[str]]]:
    text = read_text(name)
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        raise ValueError(f"{name} is empty")
    header = [h.strip().lstrip("\ufeff") for h in rows[0]]
    return header, rows[1:]


def _owid_series(name: str, entity: str) -> list[dict]:
    header, rows = _owid_rows(name)
    lower = [h.lower() for h in header]
    ent_i = lower.index("entity")
    date_i = lower.index("day") if "day" in lower else lower.index("year")
    value_cols = [i for i in range(len(header)) if i not in (ent_i, date_i)
                  and lower[i] != "code"]
    # choose the value column with the most numeric data for this entity
    best, best_count = None, -1
    for ci in value_cols:
        n = sum(1 for r in rows if len(r) > ci and r[ent_i] == entity and fnum(r[ci]) is not None)
        if n > best_count:
            best, best_count = ci, n
    points = []
    for r in rows:
        if len(r) <= best or r[ent_i] != entity:
            continue
        v = fnum(r[best])
        if v is None:
            continue
        d = r[date_i].strip()
        d = d[:7] if "-" in d else d  # ISO date -> YYYY-MM, plain year stays
        points.append({"d": d, "v": v})
    points.sort(key=lambda p: p["d"])
    return points


def parse_emissions() -> tuple[dict, str]:
    pts = _owid_series("owid_co2_emissions.csv", "World")
    if len(pts) < 30:
        raise ValueError(f"only {len(pts)} annual emission rows for World")
    for p in pts:
        p["v"] = round(p["v"] / 1e9, 3)  # tonnes -> gigatonnes
    return ({"id": "emissions", "unit": "Gt CO2 / yr", "points": pts},
            f"{len(pts)} years, {pts[0]['d']}..{pts[-1]['d']}")


def parse_electricity() -> tuple[dict, str]:
    payload: dict = {"id": "electricity", "unit": "TWh"}
    notes = []
    us = _owid_series("owid_electricity_demand.csv", "United States")
    world = _owid_series("owid_electricity_demand.csv", "World")
    if len(us) < 10:
        raise ValueError("OWID electricity demand: too few US rows")
    payload["us_annual"] = us
    payload["world_annual"] = world
    notes.append(f"annual US {us[0]['d']}..{us[-1]['d']}")

    eia_path = RAW / "eia_us_generation.json"
    if eia_path.exists():
        try:
            data = json.loads(eia_path.read_text())
            rows = data["response"]["data"]
            by_period: dict[str, float] = {}
            for r in rows:
                ft = str(r.get("fueltypeid", "")).upper()
                if ft not in ("ALL", ""):
                    continue
                v = r.get("generation")
                if v is None:
                    continue
                by_period[r["period"]] = by_period.get(r["period"], 0.0) + float(v)
            monthly = [{"d": k, "v": round(v / 1000, 1)}  # thousand MWh -> TWh
                       for k, v in sorted(by_period.items())]
            if len(monthly) >= 24:
                rolling12(monthly)
                payload["us_monthly"] = monthly
                notes.append(f"EIA monthly {monthly[0]['d']}..{monthly[-1]['d']}")
        except Exception as exc:  # EIA is a bonus; never fail the source over it
            notes.append(f"EIA file present but unparseable ({exc}) — using annual only")
    else:
        notes.append("no EIA monthly file (optional)")
    return payload, "; ".join(notes)


def parse_gistemp() -> tuple[dict, str]:
    text = read_text("gistemp_glb.csv")
    points = []
    for ln in text.splitlines():
        parts = [p.strip() for p in ln.split(",")]
        if not parts or not re.fullmatch(r"\d{4}", parts[0] or ""):
            continue
        year = int(parts[0])
        for m in range(1, 13):
            if m < len(parts):
                v = fnum(parts[m])
                if v is not None:
                    points.append({"d": ym(year, m), "v": round(v, 2)})
    if len(points) < 500:
        raise ValueError(f"only parsed {len(points)} GISTEMP months")
    points.sort(key=lambda p: p["d"])
    rolling12(points)
    return ({"id": "gistemp", "unit": "°C vs 1951–1980", "points": points},
            f"{len(points)} months, {points[0]['d']}..{points[-1]['d']}")


def parse_sst() -> tuple[dict, str]:
    text = read_text("ncei_ocean_anomaly.csv")
    points, base = [], ""
    for ln in text.splitlines():
        s = ln.strip()
        low = s.lower()
        if low.startswith("base period"):
            base = s.split(":", 1)[-1].strip()
        m = re.match(r"^(\d{4})(\d{2}),\s*(-?\d+\.?\d*)", s)
        if m:
            v = fnum(m.group(3))
            if v is not None:
                points.append({"d": ym(int(m.group(1)), int(m.group(2))), "v": v})
    if len(points) < 200:
        raise ValueError(f"only parsed {len(points)} NCEI ocean anomaly rows")
    points.sort(key=lambda p: p["d"])
    rolling12(points)
    unit = f"°C vs {base}" if base else "°C anomaly"
    return ({"id": "sst", "unit": unit, "points": points},
            f"{len(points)} months, {points[0]['d']}..{points[-1]['d']}")


def parse_ohc() -> tuple[dict, str]:
    text = read_text("ncei_ohc_0-700m.dat")
    points = []
    for ln in data_lines(text):
        parts = ln.split()
        if not parts or not re.match(r"^\d{4}", parts[0]):
            continue
        year = int(float(parts[0]))
        v = fnum(parts[1]) if len(parts) > 1 else None
        if v is not None:
            points.append({"d": str(year), "v": v})
    if len(points) < 30:
        raise ValueError(f"only parsed {len(points)} OHC rows")
    return ({"id": "ohc", "unit": "10²² J vs 1955–2006", "points": points},
            f"{len(points)} years, {points[0]['d']}..{points[-1]['d']}")


def parse_sealevel() -> tuple[dict, str]:
    text = read_text("sealevel_gmsl.csv")
    if "Entity" in text.splitlines()[0]:  # OWID fallback format
        pts = _owid_series("sealevel_gmsl.csv", "World")
        if len(pts) < 50:
            raise ValueError("OWID sea level: too few rows")
        return ({"id": "sealevel", "unit": "mm (OWID reconstruction)", "points": pts},
                f"OWID fallback, {len(pts)} rows")
    # NOAA STAR format: decimal-year rows, one active altimetry mission column per row
    points = []
    for ln in data_lines(text):
        parts = [p.strip() for p in re.split(r"[,\s]+", ln.strip()) if p.strip()]
        if not parts or not re.match(r"^\d{4}\.", parts[0]):
            continue
        dy = float(parts[0])
        vals = [v for v in (fnum(p) for p in parts[1:]) if v is not None]
        if not vals:
            continue
        points.append({"d": decyear_to_ym(dy), "v": round(sum(vals) / len(vals), 2)})
    if len(points) < 100:
        raise ValueError(f"only parsed {len(points)} STAR sea level rows")
    # collapse the ~10-day cycles to monthly means so the chart isn't 1200 points
    monthly: dict[str, list[float]] = {}
    for p in points:
        monthly.setdefault(p["d"], []).append(p["v"])
    pts = [{"d": d, "v": round(sum(vs) / len(vs), 2)} for d, vs in sorted(monthly.items())]
    rolling12(pts)
    return ({"id": "sealevel", "unit": "mm since 1993 (altimetry)", "points": pts},
            f"{len(pts)} months, {pts[0]['d']}..{pts[-1]['d']}")


def parse_seaice() -> tuple[dict, str]:
    text = read_text("nsidc_n09_extent.csv")
    rows = list(csv.reader(io.StringIO(text)))
    header = [h.strip().lower() for h in rows[0]]
    try:
        yi = header.index("year")
        ei = next(i for i, h in enumerate(header) if "extent" in h)
    except (ValueError, StopIteration) as exc:
        raise ValueError(f"NSIDC header not recognized: {header}") from exc
    points = []
    for r in rows[1:]:
        if len(r) <= max(yi, ei):
            continue
        y = r[yi].strip()
        v = fnum(r[ei])
        if y.isdigit() and v is not None and v > 0:
            points.append({"d": y, "v": v})
    if len(points) < 30:
        raise ValueError(f"only parsed {len(points)} September sea ice rows")
    points.sort(key=lambda p: p["d"])
    return ({"id": "seaice", "unit": "million km², September mean", "points": points},
            f"{len(points)} years, {points[0]['d']}..{points[-1]['d']}")


def parse_icesheets() -> tuple[dict, str]:
    gl = _owid_series("owid_ice_sheets.csv", "Greenland")
    an = _owid_series("owid_ice_sheets.csv", "Antarctica")
    if len(gl) < 20 or len(an) < 20:
        raise ValueError(f"ice sheets: Greenland {len(gl)} rows, Antarctica {len(an)} rows")
    return ({"id": "icesheets", "unit": "Gt cumulative change (0 = 2002)",
             "greenland": gl, "antarctica": an},
            f"Greenland {gl[0]['d']}..{gl[-1]['d']}, Antarctica {an[0]['d']}..{an[-1]['d']}")


# ---------------------------------------------------------------------------
# driver
# ---------------------------------------------------------------------------

PARSERS = {
    "co2": (parse_co2, "co2.json"),
    "emissions": (parse_emissions, "emissions.json"),
    "electricity": (parse_electricity, "electricity.json"),
    "gistemp": (parse_gistemp, "gistemp.json"),
    "sst": (parse_sst, "sst.json"),
    "ohc": (parse_ohc, "ohc.json"),
    "sealevel": (parse_sealevel, "sealevel.json"),
    "seaice": (parse_seaice, "seaice.json"),
    "icesheets": (parse_icesheets, "icesheets.json"),
}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {"mode": "real",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "sources": {}}
    failures = 0
    print(f"Processing raw files from {RAW} -> {OUT}\n")
    for sid, (fn, outname) in PARSERS.items():
        try:
            payload, note = fn()
            (OUT / outname).write_text(json.dumps(payload, separators=(",", ":")))
            size = (OUT / outname).stat().st_size
            meta["sources"][sid] = {"ok": True, "note": note, "file": outname}
            print(f"[OK]     {sid:<12} {note}  ({size:,} bytes)")
        except Exception as exc:  # noqa: BLE001 — isolate per source
            failures += 1
            meta["sources"][sid] = {"ok": False, "note": str(exc)}
            print(f"[FAILED] {sid:<12} {exc}")
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2))
    print(f"\n{len(PARSERS) - failures}/{len(PARSERS)} sources processed. "
          f"meta.json written; the app hides any chart whose source failed.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
