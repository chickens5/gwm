# Welcome

__I built this to monitor Climate Change variables and to eventually implement js based ML for predicting Climate tipping points.__

The Climate Crisis depicted through three features:
 **drivers** show warming (CO₂, emissions, electricity demand) of the Earth system's 
 in which the **response** can be seen with (surface and ocean temperature, ocean heat content, sea level).
 Lastly, the **threshold** represents the vital Climate systems in danger of tipping (Arctic September sea ice, the Greenland and Antarctic ice sheets).




## Data sources

| id          | Series                                   | Provider                       | Cadence |       URL         |
|-------------|------------------------------------------|--------------------------------|---------|--------------------
| co2         | Atmospheric CO₂, Mauna Loa               | NOAA GML                       | monthly | https://gml.noaa.gov/ccgg/trends/data.html
| emissions   | Global fossil CO₂ emissions              | Global Carbon Project via OWID | annual  | https://ourworldindata.org/grapher/annual-co2-emissions-per-country.csv?v=1&csvType=full&useColumnShortNames=true 

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

*Don't forget this in vite config: base: '/'*