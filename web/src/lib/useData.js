//chickens5 ~ July 8 2026

import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL;


const SERIES_IDS = [
  "co2", "emissions", "electricity",
  "gistemp", "sst", "ohc", "sealevel",
  "seaice", "icesheets",
];



// ---------------------------------------------------------------------------
// Data parsed from local files sourced from NOAA, IEA, and NASA
// ---------------------------------------------------------------------------

const CSV_SOURCES = {
  co2:         { file: "data/co2_mm_mlo.csv",              parse: parseCo2 },
  gistemp:     { file: "data/gistemp_glb.csv",             parse: parseGistemp },
  emissions:   { file: "data/owid_co2_emissions.csv",      parse: parseEmissions },
  electricity: { file: "data/owid_electricity_demand.csv", parse: parseElectricity },
};


// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchText(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchJson(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// CSV parsers
// ---------------------------------------------------------------------------

/**
 * NOAA GML co2_mm_mlo.csv
 * Header: year,month,decimal date,average,deseasonalized,ndays,sdev,unc
 * Comment lines start with '#'. The header row is skipped because
 * parseInt('year') === NaN.
 * v = average monthly ppm, t = deseasonalized trend
 */
function parseCo2(text) {
  const points = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const cols = line.split(",");
    if (cols.length < 5) continue;
    const year  = parseInt(cols[0], 10);
    const month = parseInt(cols[1], 10);
    const avg   = parseFloat(cols[3]);
    const deseas = parseFloat(cols[4]);
    if (!isFinite(year) || !isFinite(month)) continue; // skips header row
    if (!isFinite(avg) || avg <= 0) continue;           // skips -9.99 sentinel
    const point = { d: `${year}-${String(month).padStart(2, "0")}`, v: avg };
    if (isFinite(deseas) && deseas > 0) point.t = deseas;
    points.push(point);
  }
  return points.length >= 100 ? { id: "co2", unit: "ppm", points } : null;
}

/**
 * NASA GISTEMP GLB.Ts+dSST.csv (wide format)
 * Line 0: title. Line 1: "Year,Jan,...,Dec,J-D,..."
 * Missing values: "***"
 *
 * v  = individual monthly anomaly
 * t  = J-D (Jan-Dec annual mean) for complete years — the most significant
 *      annual summary in this dataset. For the current partial year where
 *      J-D is "***", t = mean of the months available so far.
 */
function parseGistemp(text) {
  const lines = text.split("\n");
  let hi = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("Year,")) { hi = i; break; }
  }
  if (hi < 0) return null;

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  const header    = lines[hi].split(",");
  const jdCol     = header.findIndex(h => h.trim() === "J-D");
  const monthCols = MONTHS.map(m => header.findIndex(h => h.trim() === m));
  if (monthCols.some(c => c < 0)) return null;

  const points = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",");
    const year = parseInt(cols[0], 10);
    if (!isFinite(year)) continue;

    const monthVals = monthCols.map(col => {
      const s = (col >= 0 && col < cols.length) ? cols[col].trim() : "";
      if (!s || s === "***") return null;
      const v = parseFloat(s);
      return isFinite(v) ? v : null;
    });

    // t = J-D for complete years; mean of available months for partial years
    let tVal = null;
    if (jdCol >= 0 && jdCol < cols.length) {
      const s = cols[jdCol].trim();
      if (s && s !== "***") { const jd = parseFloat(s); if (isFinite(jd)) tVal = jd; }
    }
    if (tVal === null) {
      const avail = monthVals.filter(v => v !== null);
      if (avail.length > 0)
        tVal = +(avail.reduce((a, b) => a + b, 0) / avail.length).toFixed(4);
    }

    for (let mi = 0; mi < 12; mi++) {
      if (monthVals[mi] === null) continue;
      const point = { d: `${year}-${String(mi + 1).padStart(2, "0")}`, v: monthVals[mi] };
      if (tVal !== null) point.t = tVal;
      points.push(point);
    }
  }
  return points.length >= 100
    ? { id: "gistemp", unit: "\u00b0C vs 1951\u20131980", points }
    : null;
}

/**
 * OWID owid_co2_emissions.csv
 * Columns: entity, code, year, emissions_total  (tonnes CO2)
 * Keeps only entity === "World"; divides by 1e9 to get Gt CO2.
 */
function parseEmissions(text) {
  const lines = text.split("\n");
  if (!lines.length) return null;
  const hdr       = lines[0].split(",");
  const entityCol = hdr.findIndex(h => h.trim() === "entity");
  const yearCol   = hdr.findIndex(h => h.trim() === "year");
  const valCol    = hdr.findIndex(h => h.trim() === "emissions_total");
  if (entityCol < 0 || yearCol < 0 || valCol < 0) return null;

  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].trim().split(",");
    if (cols[entityCol]?.trim() !== "World") continue;
    const year = parseInt(cols[yearCol], 10);
    const val  = parseFloat(cols[valCol]);
    if (!isFinite(year) || !isFinite(val)) continue;
    points.push({ d: String(year), v: +(val / 1e9).toFixed(3) });
  }
  if (points.length < 10) return null;
  points.sort((a, b) => a.d.localeCompare(b.d));
  return { id: "emissions", unit: "Gt CO\u2082 / yr", points };
}

/**
 * OWID owid_electricity_demand.csv
 * Returns null if the file contains only one distinct year (cross-sectional
 * snapshot), triggering the synthetic JSON fallback for the time-series chart.
 */
function parseElectricity(text) {
  const lines = text.split("\n");
  if (!lines.length) return null;
  const hdr     = lines[0].split(",");
  const yearCol = hdr.findIndex(h => h.trim() === "year");
  if (yearCol < 0) return null;

  const years = new Set();
  for (let i = 1; i < Math.min(lines.length, 200); i++) {
    const cols = lines[i].trim().split(",");
    if (cols.length > yearCol) years.add(cols[yearCol].trim());
  }
  if (years.size <= 1) return null; // snapshot — unusable as time series

  const entityCol = hdr.findIndex(h => h.trim() === "entity");
  const valCol    = hdr.findIndex(h =>
    h.trim().startsWith("total_demand__twh") && !h.includes("original")
  );
  if (entityCol < 0 || valCol < 0) return null;

  const us = [], world = [];
  for (let i = 1; i < lines.length; i++) {
    const cols   = lines[i].trim().split(",");
    const entity = cols[entityCol]?.trim();
    const year   = parseInt(cols[yearCol], 10);
    const val    = parseFloat(cols[valCol]);
    if (!isFinite(year) || !isFinite(val)) continue;
    if (entity === "United States") us.push({ d: String(year), v: val });
    if (entity === "World")         world.push({ d: String(year), v: val });
  }
  if (!us.length && !world.length) return null;
  us.sort((a, b) => a.d.localeCompare(b.d));
  world.sort((a, b) => a.d.localeCompare(b.d));
  return { id: "electricity", unit: "TWh", us_annual: us, world_annual: world };
}

// ---------------------------------------------------------------------------
// Per-series loader: real CSV → synthetic JSON fallback
// ---------------------------------------------------------------------------

async function loadSeries(name) {
  const src = CSV_SOURCES[name];
  if (src) {
    try {
      const parsed = src.parse(await fetchText(src.file));
      if (parsed) return { data: parsed, source: "csv" };
    } catch { /* fall through */ }
  }
  try {
    const data = await fetchJson(`data/synthetic/${name}.json`);
    return data ? { data, source: "synthetic" } : { data: null, source: null };
  } catch {
    return { data: null, source: null };
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useData() {
  const [state, setState] = useState({ loading: true, meta: null, series: {}, error: null });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let meta = null;
      try { meta = await fetchJson("data/synthetic/meta.json"); } catch { /* ok */ }

      const results = await Promise.all(
        SERIES_IDS.map(async (id) => [id, await loadSeries(id)])
      );
      if (cancelled) return;

      const series   = Object.fromEntries(results.map(([id, r]) => [id, r.data]));
      const anyCsv   = results.some(([, r]) => r.source === "csv");
      const anyValid = Object.values(series).some(Boolean);

      if (anyCsv && meta) {
        meta = { ...meta, mode: "live", generated_at: new Date().toISOString() };
      }

      setState({
        loading: false,
        meta,
        series,
        error: anyValid ? null : "No data files found. Run scripts/fetch_data.py to load real observations.",
      });
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
