//chickens5 ~ July 8 2026
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from "recharts";
//https://recharts.github.io/
//https://recharts.github.io/en-US/storybook/
const TICK = { fill: "#8ca0ba", fontSize: 11 };

function fmtTick(d) {
  //Gets a string for data "YYYY-MM" -> "YYYY"
  return String(d).slice(0, 4);
}

function yearTicks(data) {
  //sparses decade 'ticks' so mobile axes stay legible
  const years = [...new Set(data.map((p) => fmtTick(p.d)))];
  const span = years.length;

  const step = span > 90 ? 40 : span > 40 ? 10 : 5;
  return data
    .filter((p) => {
      const [y, m] = String(p.d).split("-");
      return Number(y) % step === 0 && (m === undefined || m === "01");
    })
    .map((p) => p.d);
}

function ChartTooltip({ active, payload, label, unit }) {

  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-hairline bg-panel-2 px-3 py-2 font-mono text-xs shadow-lg">
      <div className="mb-1 text-faint">{label}</div>
      {payload.map((e) => (
        <div key={e.dataKey} style={{ color: e.stroke }}>
          {e.name}: {typeof e.value === "number" ? e.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : e.value}
          {unit ? <span className="text-faint"> {unit}</span> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * lines: [{ key, name, color, width?, dash? }]
 * refLines: [{ y, label, color? }]  — the threshold horizons
 */
export default function TimeSeriesChart({
  title, caption, data, lines, unit,
  refLines = [], yDomain, height = 320, legend = false,
}) {
  if (!data?.length) return null;
  const ticks = yearTicks(data);
  return (
    <figure className="rounded-lg border border-hairline bg-panel p-4 sm:p-5">
      <figcaption className="mb-3">

        <h3 className="font-medium text-body">{title}</h3>
        {caption && <p className="mt-1 text-sm leading-relaxed text-muted">{caption}</p>}
      </figcaption>

      <div className="h-[260px] sm:h-[var(--h)]" style={{ "--h": `${height}px` }}>

        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>

            <CartesianGrid stroke="#000000" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="d" ticks={ticks} tickFormatter={fmtTick}
              tick={TICK} stroke="#1e2d44" tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={TICK} stroke="#1e2d44" tickLine={false} width={52}
              domain={yDomain || ["auto", "auto"]}
              tickFormatter={(v) => v.toLocaleString()} />

            <Tooltip content={<ChartTooltip unit={unit} />} />
            {legend && <Legend wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-mono)" }} />}
            {refLines.map((r) => (
              <ReferenceLine key={r.label} y={r.y}
                stroke={r.color || "#ff6b4a"} strokeDasharray="6 4" strokeOpacity={0.8}
                label={{ value: r.label, position: "insideTopRight",
                  fill: r.color || "#ff6b4a", fontSize: 11, fontFamily: "var(--font-mono)" }} />
            ))}

            {lines.map((l) => (
              <Line key={l.key} type="monotone" dataKey={l.key} name={l.name}
                stroke={l.color} strokeWidth={l.width || 2}
                strokeDasharray={l.dash} dot={false}
                isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {unit && <div className="mt-2 font-mono text-[11px] text-faint">{unit}</div>}
    </figure>
  );
}
