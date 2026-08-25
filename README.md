# Welcome

**I built this to monitor Climate Change variables and for ML analysis on Climate tipping points in combination with emissions and Climate data.**

### The Climate Crisis is depicted through three features:
 **drivers** show warming (CO₂, emissions, electricity demand) of the Earth system's 
 in which the **response** can be seen with (surface and ocean temperature, ocean heat content, sea level). Lastly, the **threshold** represents the vital Climate systems in danger of tipping (Arctic September sea ice, the Greenland and Antarctic ice sheets).

## Data sources

## | id  |      Series       | Provider    |    Frequency+URL    |
#### ---------------------------------------------------------------------------------------------------------
| co2_gml  | Atmospheric CO₂, Mauna Loa  | [NOAA GML](https://gml.noaa.gov/ccgg/trends/data.html) | yearly & country indices XLSX 

| emissions_owid | Global fossil CO₂ emissions | Global Carbon Project via OWID | monthly & yearly ~ https://ourworldindata.org/grapher/annual-co2-emissions-per-country.csv?v=1&csvType=full&useColumnShortNames=true 

| eia_monyear | US net generation (optional) | EIA | monyear ~ https://www.eia.gov/electricity/data.php |

| gistemp | Global surface temperature anomaly  | NASA GISTEMP v4 | monyear ~ https://data.giss.nasa.gov/gistemp/data_v4.html |

| seaice_sh_extent  | Arctic September sea ice extent | [NSIDC Sea Ice Index](https://nsidc.org/sea-ice-today/sea-ice-tools) | annual   |

| *not used* seaice_roc | Ice sheet cumulative mass change | IMBIE / NASA via OWID | annual ~ https://noaadata.apps.nsidc.org/NOAA/G02135/seaice_analysis/  |


# References 
NOAA GML ~ Mauna Loa Trends in CO2, CH4, N2O, SF6 | Dr. Xin Lan, NOAA/GML (gml.noaa.gov/ccgg/trends/) and Dr. Ralph Keeling, Scripps Institution of Oceanography (scrippsco2.ucsd.edu/).


