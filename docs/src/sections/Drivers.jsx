//chickens5 ~ July 8 2026
//Native React components for the Climate Driver section.
import Section from "../components/Section.jsx";
import MissingSource from "../components/MissingSource.jsx";
import TimeSeriesChart from "../components/TimeSeriesChart.jsx";

export default function Drivers({ series }) {
  const { co2, emissions, emissions_by_ind } = series;

  return (
    <Section
      id="drivers" act="I" title="Drivers"
      thesis="Humans drive climate change through excess pollution, consumption, and electricity. After 15 years of intense yet steady electricity use, 
      the development of nonrenewable AI data power plants resumes the keeling curve."
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
      ) : <MissingSource id="co2" name="Mauna Loa CO₂" />}

      {emissions ? (
        <TimeSeriesChart
          title="Global fossil CO₂ emissions"
          caption="Annual emissions from fossil fuels and industry (Global Carbon Project). Dips mark the 2009 financial crisis and 2020 pandemic — both erased within two years."
          data={emissions.points} unit={emissions.unit}
          lines={[{ key: "v", name: "emissions", color: "#f5a83c", width: 2.25 }]}
        />
      ) : <MissingSource id="emissions" name="Global emissions" />}

      {emissions_by_ind ? (
        <TimeSeriesChart
          title="US electricity-sector CO₂ by fuel (EIA)"
          caption="Annual CO₂ from US power generation, broken out by fuel type. Coal's decline after 2007 is partially offset by natural gas growth, while total sector emissions have fallen ~40% from their peak."
          data={emissions_by_ind.points} unit={emissions_by_ind.unit} legend
          lines={[
            { key: "coal",      name: "Coal",        color: "#8b6f47", width: 2.25 },
            { key: "gas",       name: "Natural gas",  color: "#f5a83c", width: 2.25 },
            { key: "petroleum", name: "Petroleum",    color: "#ff6b4a", width: 1.5 },
            { key: "other",     name: "Other",        color: "#5e8fef", width: 1.5, dash: "5 4" },
          ]}
        />
      ) : <MissingSource id="emissions_by_ind" name="US electricity-sector emissions by fuel" />}
    </Section>
  );
}
