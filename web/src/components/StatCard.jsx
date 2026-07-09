export default function StatCard({ label, value, unit, note, tone = "steel" }) {
  const tones = {
    ember: "text-ember", amber: "text-amber", ice: "text-ice", steel: "text-steel",
  };
  if (value === null || value === undefined) return null;
  return (
    <div className="rounded-lg border border-hairline bg-panel px-4 py-3">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-medium ${tones[tone]}`}>
        {value}<span className="ml-1 text-sm text-faint">{unit}</span>
      </div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  );
}
