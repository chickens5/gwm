# Global Warming Monitor

Planetary vital signs, 1958–present, told in three acts: the **drivers** of warming
(CO₂, emissions, electricity demand), the Earth system's **response** (surface and
ocean temperature, ocean heat content, sea level), and the **threshold** systems in
sustained decline (Arctic September sea ice, the Greenland and Antarctic ice sheets).

Static site — no backend, no ML. Python fetches and pre-processes nine public data
series into small JSON files; a Vite + React + Recharts frontend renders them.

## Quick start

```bash
# 1. See the app immediately with synthetic placeholder data
python3 scripts/make_sample_data.py
cd web && npm install && npm run dev

# 2. Replace with real observations (run from repo root, needs internet)
python3 scripts/fetch_data.py       # downloads raw files -> data/raw/
python3 scripts/process_data.py     # raw -> web/public/data/*.json
```

The app shows an amber SAMPLE DATA banner until a real `process_data.py` run
replaces the placeholder JSON. No pip installs are needed — both scripts are stdlib-only.

## The fetcher's contract

`fetch_data.py` treats every endpoint independently:

- multiple candidate URLs per source (fallbacks for URL rot and version bumps)
- retry with backoff on transient network errors; no retry on 403/404 or bad payloads
- every download is **validated** (size, expected content marker, minimum line count)
  before being accepted — an HTML error page saved as `data.csv` counts as a failure
- ends with a summary table, a machine-readable `data/raw/fetch_report.json`,
  a landing-page URL to check for each failed source, and a copy-paste command to
  re-run only the failures (`python3 scripts/fetch_data.py gistemp seaice`)
- exit code 1 if any required source failed (useful in CI)

`process_data.py` has the same isolation: a malformed file fails only its own chart.
The frontend reads `meta.json` and renders an "unavailable" note in place of any
chart whose source failed — the rest of the page is unaffected.

## Data sources

| id          | Series                                   | Provider                       | Cadence |
|-------------|------------------------------------------|--------------------------------|---------|
| co2         | Atmospheric CO₂, Mauna Loa               | NOAA GML                       | monthly |
| emissions   | Global fossil CO₂ emissions              | Global Carbon Project via OWID | annual  |
| electricity | Electricity demand, US + World           | Ember via OWID                 | annual  |
| electricity_eia | US net generation (optional)         | EIA API v2 (`EIA_API_KEY`)     | monthly |
| gistemp     | Global surface temperature anomaly       | NASA GISTEMP v4                | monthly |
| sst         | Global ocean surface temp anomaly        | NOAA NCEI Climate at a Glance  | monthly |
| ohc         | Ocean heat content 0–700 m               | NOAA NCEI                      | annual  |
| sealevel    | Global mean sea level (altimetry)        | NOAA STAR (OWID fallback)      | ~monthly|
| seaice      | Arctic September sea ice extent          | NSIDC Sea Ice Index            | annual  |
| icesheets   | Ice sheet cumulative mass change         | IMBIE / NASA via OWID          | annual+ |

**Baselines are per-dataset and stated on each chart** — the app deliberately does
not re-baseline published anomalies. The 1.5 °C / 2.0 °C horizons on the temperature
chart are drawn relative to GISTEMP's own 1880–1900 mean as a stated approximation
of the pre-industrial (1850–1900) reference.

Optional: `EIA_API_KEY=<key> python3 scripts/fetch_data.py` adds monthly US
generation (free key at eia.gov/opendata). Without it the annual OWID series is used.

## Deploy

```bash
cd web && npm run build        # output in web/dist/
```

Vercel: set root directory to `web/`, framework Vite. Netlify: base `web`,
publish `web/dist`. A monthly GitHub Action that refreshes the data and commits
is in `.github/workflows/update-data.yml` (git-integration deploys pick up the commit).

## Layout

```
scripts/fetch_data.py        download + validate raw sources (stdlib only)
scripts/process_data.py      raw -> web/public/data/*.json + meta.json
scripts/make_sample_data.py  synthetic fixtures; end-to-end parser test
data/raw/                    downloaded raw files + fetch_report.json (gitignored)
web/                         Vite + React + Tailwind v4 + Recharts frontend
web/public/data/             the JSON the app reads (committed so deploys are static)
```
