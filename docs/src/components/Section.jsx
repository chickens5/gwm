export default function Section({ id, act, title, thesis, children }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-hairline pt-10 pb-14">
      <div className="mb-6 flex items-baseline gap-4">
        <span className="font-mono text-sm text-faint">ACT {act}</span>
        <h2 className="text-2xl font-medium sm:text-3xl">{title}</h2>
      </div>
      <p className="mb-8 max-w-2xl leading-relaxed text-muted">{thesis}</p>
      <div className="space-y-6">{children}</div>
    </section>
  );
}
