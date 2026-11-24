import type { PackagingDesign } from '../../types/packaging.ts'

export function WhyDesign({ design }: { design: PackagingDesign }) {
  return (
    <div>
      <p className="text-sm leading-6 text-secondary">
        These lines use the last generated measurements and the selected board prices. They are not a second packaging design.
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Formulas</h3>
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
    </div>
  )
}
