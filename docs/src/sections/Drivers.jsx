//chickens5 ~ July 8 2026
//Native React components for the Climate Driver section.
import Section from "../components/Section.jsx";
import MissingSource from "../components/MissingSource.jsx";
import TimeSeriesChart from "../components/TimeSeriesChart.jsx";

function mergeAnnual(us, world) {
  const map = new Map();
  (us || []).forEach((p) => map.set(p.d, { d: p.d, us: p.v }));
  (world || []).forEach((p) => map.set(p.d, { ...(map.get(p.d) || { d: p.d }), world: p.v }));
  return [...map.values()].sort((a, b) => a.d.localeCompare(b.d));
}

export default function Drivers({ series, meta }) {
  const { co2, emissions, electricity } = series;
  const elec = electricity ? mergeAnnual(electricity.us_annual, electricity.world_annual) : null;

  return (
    <Section
      id="drivers" act="I" title="Drivers"
      thesis="The forcing is not slowing down. Atmospheric CO₂ climbs the Keeling curve without pause, annual emissions remain near record highs, and — after fifteen flat years — electricity demand is inflecting upward again, led by data centers and electrification."
    >
      {co2 ? (
        <TimeSeriesChart
          title="Atmospheric CO₂ — Mauna Loa"
          caption="Monthly mean with the seasonal cycle (plants breathing) around the deseasonalized trend. Pre-industrial level was ~280 ppm; the curve has never bent downward in the 68-year record."
          data={co2.points} unit={co2.unit}
          lines={[
            { key: "v", name: "monthly mean", color: "#f5a83c", width: 1.25 },
            { key: "t", name: "deseasonalized", color: "#ff6b4a", width: 2.25 },
          ]}
          legend
        />
      ) : <MissingSource id="co2" name="Mauna Loa CO₂" meta={meta} />}

      {emissions ? (
        <TimeSeriesChart
          title="Global fossil CO₂ emissions"
          caption="Annual emissions from fossil fuels and industry (Global Carbon Project). Dips mark the 2009 financial crisis and 2020 pandemic — both erased within two years."
          data={emissions.points} unit={emissions.unit}
          lines={[{ key: "v", name: "emissions", color: "#f5a83c", width: 2.25 }]}
        />
      ) : <MissingSource id="emissions" name="Global emissions" meta={meta} />}

      {elec ? (
        <TimeSeriesChart
          title="Electricity demand — United States and World"
          caption="US demand was essentially flat from ~2005 to ~2020, then turned upward with data-center buildout and electrification. New demand's emissions impact depends entirely on what supplies it. (Note: data centers are a growing but still small share of total global emissions — the story here is the demand trajectory, not attribution of the Keeling curve.)"
          data={elec} unit={electricity.unit} legend
          lines={[
            { key: "us", name: "United States", color: "#7fd8ea", width: 2.25 },
            { key: "world", name: "World", color: "#5e8fef", width: 1.5, dash: "5 4" },
          ]}
        />
      ) : <MissingSource id="electricity" name="Electricity demand" meta={meta} />}

      {electricity?.us_monthly && (
        <TimeSeriesChart
          title="US net generation, monthly (EIA)"
          caption="Monthly resolution from the EIA API, with the trailing 12-month mean showing the post-2020 inflection."
          data={electricity.us_monthly} unit="TWh / month"
          lines={[
            { key: "v", name: "monthly", color: "#7fd8ea", width: 1 },
            { key: "t", name: "12-month mean", color: "#5e8fef", width: 2.25 },
          ]}
          legend
        />
      )}
    </Section>
  );
}
