# Global Warming Monitor

Planetary vital signs, 1958–present, told in three acts: the **drivers** of warming
(CO₂, emissions, electricity demand), the Earth system's **response** (surface and
ocean temperature, ocean heat content, sea level), and the **threshold** systems in
sustained decline (Arctic September sea ice, the Greenland and Antarctic ice sheets).

Static site — no backend, no ML. Python fetches and pre-processes nine public data
series into small JSON files; a Vite + React + Recharts frontend renders them.


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
