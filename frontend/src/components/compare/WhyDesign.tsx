import type { PackagingDesign } from '../../types/packaging.ts'

export function WhyDesign({ design }: { design: PackagingDesign }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h2 className="font-display text-xl font-semibold">Why this design?</h2>
      <p className="mt-2 text-sm leading-6 text-secondary">
        The size and cost below are calculated from the committed measurements, the selected board, and the prices in the cards.
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Calculation</h3>
          <dl className="mt-3 space-y-3">
            {design.formulae.map((line) => (
              <div key={line.label}>
                <dt className="text-xs font-medium text-forest">{line.label}</dt>
                <dd className="mt-0.5 text-sm leading-5 text-secondary tabular-nums">{line.expression}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Assumptions and limits</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-secondary">
            {design.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Notes for this product</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-forest">
            {design.notes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
