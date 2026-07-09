//chickens5 ~ July 8 2026

import Section from "../components/Section.jsx";
import MissingSource from "../components/MissingSource.jsx";
import TimeSeriesChart from "../components/TimeSeriesChart.jsx";
import { meanBetween } from "../lib/useData.js";

function mergeSheets(gl, an) {
  const map = new Map();
  (gl || []).forEach((p) => map.set(p.d, { d: p.d, gl: p.v }));
  (an || []).forEach((p) => map.set(p.d, { ...(map.get(p.d) || { d: p.d }), an: p.v }));
  return [...map.values()].sort((a, b) => a.d.localeCompare(b.d));
}

export default function Thresholds({ series, meta }) {
  const { seaice, icesheets } = series;
  const baseline = seaice ? meanBetween(seaice.points, 1981, 2010) : null;
  const sheets = icesheets ? mergeSheets(icesheets.greenland, icesheets.antarctica) : null;

  return (
    <Section
      id="thresholds" act="III" title="Thresholds"
      thesis="Some parts of the system don't respond linearly — they have states they can fall out of. Arctic summer sea ice and the great ice sheets are the two most visible: both are in sustained decline, and both carry feedbacks (albedo loss, marine ice-sheet instability) that make recovery harder the further they go."
    >
      {seaice ? (
        <TimeSeriesChart
          title="Arctic sea ice — September minimum extent (NSIDC)"
          caption="September is the annual minimum, when the summer melt ends. The dashed line is the 1981–2010 average. Less ice means a darker ocean absorbing more sunlight — the albedo feedback that makes this a threshold system rather than a thermostat."
          data={seaice.points} unit={seaice.unit}
          refLines={baseline !== null ? [{ y: +baseline.toFixed(2), label: "1981–2010 mean", color: "#7fd8ea" }] : []}
          lines={[{ key: "v", name: "September extent", color: "#7fd8ea", width: 2.25 }]}
        />
      ) : <MissingSource id="seaice" name="Arctic sea ice" meta={meta} />}

      {sheets ? (
        <TimeSeriesChart
          title="Ice sheet mass change — Greenland and Antarctica (IMBIE / NASA)"
          caption="Cumulative mass change from satellite gravimetry and altimetry, centered at zero in 2002. Every 360 Gt lost is roughly 1 mm of global sea level. Both slopes are steepening."
          data={sheets} unit={icesheets.unit} legend
          lines={[
            { key: "gl", name: "Greenland", color: "#7fd8ea", width: 2.25 },
            { key: "an", name: "Antarctica", color: "#5e8fef", width: 2.25 },
          ]}
        />
      ) : <MissingSource id="icesheets" name="Ice sheets" meta={meta} />}
    </Section>
  );
}
