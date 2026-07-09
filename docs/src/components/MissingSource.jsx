export default function MissingSource({ name, meta, id }) {
  const note = meta?.sources?.[id]?.note;
  return (
    <div className="rounded-lg border border-dashed border-hairline bg-panel/50 p-4 text-sm text-muted">
      <span className="font-mono text-faint">unavailable — </span>
      {name} didn't load.{note ? ` (${note})` : ""} See data/raw/fetch_report.json,
      then re-run <code className="font-mono text-ice">python3 scripts/fetch_data.py {id}</code>.
    </div>
  );
}
