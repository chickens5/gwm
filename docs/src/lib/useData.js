//chickens5 ~ July 8 2026

import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL;

// ---------------------------------------------------------------------------
// All data is pre-processed by scripts/process_data.py into JSON files.
// The frontend only fetches and displays — no parsing logic lives here.
// ---------------------------------------------------------------------------

// Series IDs that have a processed JSON file. Others render a placeholder.
const JSON_SOURCES = {
  co2:              "json_files/co2.json",
  gistemp:          "json_files/gistemp.json",
  emissions:        "json_files/emissions.json",
  seaice:           "json_files/seaice.json",
  emissions_by_ind: "json_files/emissions_by_ind.json",
};

// All series the app knows about (missing ones show MissingSource placeholder).
const SERIES_IDS = [
  "co2", "emissions", "emissions_by_ind",
  "gistemp", "sst", "ohc", "sealevel",
  "seaice", "icesheets",
];

async function loadSeries(id) {
  const path = JSON_SOURCES[id];
  if (!path) return null;
  try {
    const res = await fetch(BASE + path);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useData() {
  const [state, setState] = useState({ loading: true, series: {} });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        SERIES_IDS.map(async (id) => [id, await loadSeries(id)])
      );
      if (cancelled) return;

      const series = Object.fromEntries(results);
      setState({ loading: false, series });
    })();

    return () => { cancelled = true; };
  }, []);

  return state;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Latest point of a series, or null. */
export function latest(s) {
  return s?.points?.length ? s.points[s.points.length - 1] : null;
}

/** t value (J-D annual mean or deseasonalized) of the newest point, falling back to v. */
export function latest12m(s) {
  const p = latest(s);
  return p ? (p.t ?? p.v) : null;
}

/** Arithmetic mean of v values whose date falls within calendar years [y0, y1]. */
export function meanBetween(points, y0, y1) {
  const vals = (points || [])
    .filter(p => { const y = parseInt(p.d.slice(0, 4), 10); return y >= y0 && y <= y1; })
    .map(p => p.v);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
