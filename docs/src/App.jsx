//chickens5 ~ July 8 2026

//Imports data from the NOAA, NASA, & IEA files.
import { useData, latest, latest12m, meanBetween } from "./lib/useData.js";

import StatCard from "./components/StatCard.jsx";
import Drivers from "./sections/Drivers.jsx";
import Response from "./sections/Response.jsx";
import Thresholds from "./sections/Thresholds.jsx";

const NAV = [
  { id: "drivers", label: "I · Drivers" },
  { id: "response", label: "II · Response" },
  { id: "thresholds", label: "III · Thresholds" },
];

export default function App() {
  const { loading, series } = useData();

  if (loading) {
    return <div className="grid min-h-screen place-items-center mono text-sm text-muted">loading vital signs…</div>;
  }

  const { co2, gistemp, seaice, sealevel } = series;
  const co2Now = latest(co2);
  const tempNow = latest12m(gistemp);
  const early = gistemp ? meanBetween(gistemp.points, 1880, 1900) : null;
  const vsPreind = tempNow !== null && early !== null ? (tempNow - early).toFixed(2) : null;
  const iceNow = latest(seaice);
  const iceBase = seaice ? meanBetween(seaice.points, 1981, 2010) : null;
  const slNow = latest12m(sealevel);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">

      <header className="pb-10 pt-12 sm:pt-16">
        <div className="eyebrow mb-3">planetary vital signs · 1958–present</div>
        <h1 className="max-w-3xl text-4xl font-medium leading-tight sm:text-5xl">
          Global Warming Monitor
        </h1>
        {/* the threshold horizon, echoed from the temperature chart */}
        <div className="mt-5 divider-ember" />
        <p className="mt-5 max-w-2xl prose-body">
          One story in three acts: the <span className="text-amber">drivers</span> of warming are
          accelerating, the Earth system's <span className="text-steel">response</span> is tracking
          them, and several <span className="text-ice">threshold</span> systems are moving toward
          states they may not return from.
        </p>

        <nav className="sticky top-0 z-10 -mx-4 mt-8 flex gap-2 overflow-x-auto bg-ink/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6" aria-label="Acts">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`}
              className="nav-pill">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard tone="amber" label="CO₂ now" unit="ppm"
            value={co2Now ? co2Now.v.toFixed(1) : null}
            note={co2Now ? `Mauna Loa, ${co2Now.d}` : null} />
          <StatCard tone="ember" label="warming, 12-mo mean" unit="°C"
            value={vsPreind !== null ? `+${vsPreind}` : null}
            note="vs 1880–1900 mean" />
          <StatCard tone="ice" label="Sept Arctic ice" unit="M km²"
            value={iceNow ? iceNow.v.toFixed(2) : null}
            note={iceNow && iceBase ? `${((iceNow.v / iceBase - 1) * 100).toFixed(0)}% vs 1981–2010` : null} />
          <StatCard tone="steel" label="sea level, 12-mo mean" unit="mm"
            value={slNow !== null ? `+${slNow.toFixed(0)}` : null}
            note="altimetry era, since 1993" />
        </div>
      </header>

      <main>
        <Drivers series={series} />
        <Response series={series} />
        <Thresholds series={series} />
      </main>

      <footer className="border-t border-hairline py-10 text-sm prose-body text-faint">
        <p><strong>
          Data: NOAA GML (CO₂) · Global Carbon Project via Our World in Data (emissions) ·
          Ember via OWID &amp; EIA (electricity) · NASA GISTEMP (temperature) · NOAA NCEI
          (ocean temperature, ocean heat content) · NOAA STAR (sea level) · NSIDC (sea ice) ·
          IMBIE / NASA via OWID (ice sheets).
        </strong></p>
        <p className="mt-2 mono text-xs">
          updates monthly ~ anomaly baselines differ by dataset and are stated per chart
        </p>
      </footer>
    </div>
  );
}
