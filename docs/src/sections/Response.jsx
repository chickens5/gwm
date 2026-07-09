//chickens5 ~ July 8 2026

import Section from "../components/Section.jsx";
import MissingSource from "../components/MissingSource.jsx";
import TimeSeriesChart from "../components/TimeSeriesChart.jsx";
import { meanBetween } from "../lib/useData.js";

export default function Response({ series, meta }) {
  const { gistemp, sst, ohc, sealevel } = series;

  // Threshold horizons: 1.5/2.0 °C are defined vs pre-industrial (1850–1900).
  // GISTEMP starts in 1880 and is baselined 1951–1980, so we anchor the lines
  // to this dataset's own 1880–1900 mean — self-consistent and stated in the caption.
  const early = gistemp ? meanBetween(gistemp.points, 1880, 1900) : null;
  const refLines = early !== null ? [
    { y: +(early + 1.5).toFixed(2), label: "+1.5 °C" },
    { y: +(early + 2.0).toFixed(2), label: "+2.0 °C" },
  ] : [];

  return (
    <Section
      id="response" act="II" title="Response"
      thesis="The system is answering the forcing. Surface and ocean temperatures track the emissions curve; more than 90% of the trapped energy goes into the ocean, where it shows up as heat content and, through expansion and ice melt, as sea level."
    >
      {gistemp ? (
        <TimeSeriesChart
          title="Global surface temperature anomaly (NASA GISTEMP)"
          caption="Monthly anomaly vs the 1951–1980 baseline, with the 12-month running mean. The dashed horizons mark +1.5 °C and +2.0 °C above this dataset's 1880–1900 mean, an approximation of the pre-industrial reference used in the Paris Agreement."
          data={gistemp.points} unit={gistemp.unit}
          refLines={refLines} height={360} legend
          lines={[
            { key: "v", name: "monthly", color: "#5b6d86", width: 0.75 },
            { key: "t", name: "12-month mean", color: "#ff6b4a", width: 2.5 },
          ]}
        />
      ) : <MissingSource id="gistemp" name="GISTEMP" meta={meta} />}

      {sst ? (
        <TimeSeriesChart
          title="Global ocean surface temperature anomaly (NOAA)"
          caption="The ocean surface is the planet's thermometer with the seasonal noise damped. The 2023–2024 excursion shattered the previous record range."
          data={sst.points} unit={sst.unit} legend
          lines={[
            { key: "v", name: "monthly", color: "#5b6d86", width: 0.75 },
            { key: "t", name: "12-month mean", color: "#5e8fef", width: 2.5 },
          ]}
        />
      ) : <MissingSource id="sst" name="Ocean temperature" meta={meta} />}

      {ohc ? (
        <TimeSeriesChart
          title="Ocean heat content, 0–700 m (NOAA NCEI)"
          caption="Where the energy actually goes: over 90% of the imbalance accumulates in the ocean. This is the least noisy of the vital signs — a nearly monotonic climb."
          data={ohc.points} unit={ohc.unit}
          lines={[{ key: "v", name: "heat content", color: "#5e8fef", width: 2.25 }]}
        />
      ) : <MissingSource id="ohc" name="Ocean heat content" meta={meta} />}

      {sealevel ? (
        <TimeSeriesChart
          title="Global mean sea level (satellite altimetry)"
          caption="Thermal expansion plus land-ice melt, measured by TOPEX/Jason/Sentinel-6 since 1993. The rate itself is increasing — roughly 2 mm/yr in the 1990s, over 4 mm/yr now."
          data={sealevel.points} unit={sealevel.unit}
          lines={[
            { key: "v", name: "monthly", color: "#7fd8ea", width: 1 },
            { key: "t", name: "12-month mean", color: "#5e8fef", width: 2.25 },
          ]}
          legend
        />
      ) : <MissingSource id="sealevel" name="Sea level" meta={meta} />}
    </Section>
  );
}
