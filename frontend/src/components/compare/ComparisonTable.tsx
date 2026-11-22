import { formatArea, formatDims, formatLitres, formatMoney, formatPct } from '../../lib/format.ts'
import { cn } from '../../lib/cn.ts'
import type { PackagingDesign } from '../../types/packaging.ts'

export function ComparisonTable({ designs, selectedId }: { designs: PackagingDesign[]; selectedId: string }) {
  const existing = designs[0]?.existing ?? null
  const rows = [
    {
      label: 'Outer size',
      existing: existing ? formatDims(existing.size) : '—',
      cell: (design: PackagingDesign) => formatDims(design.external),
    },
    {
      label: 'Volume',
      existing: existing ? formatLitres(existing.volume) : '—',
      cell: (design: PackagingDesign) => formatLitres(design.externalVolume),
    },
    {
      label: 'Unused volume',
      existing: existing ? formatPct(existing.emptySpacePct) : '—',
      cell: (design: PackagingDesign) => formatPct(design.emptySpacePct),
    },
    {
      label: 'Sheet / unit',
      existing: existing ? formatArea(existing.estimatedBlankAreaM2) : '—',
      cell: (design: PackagingDesign) => formatArea(design.blankAreaM2),
    },
    {
      label: 'Insert',
      existing: 'Not entered',
      cell: (design: PackagingDesign) => design.material.insertName ?? 'None',
    },
    {
      label: 'Unit cost',
      existing: existing ? formatMoney(existing.unitCost) : '—',
      cell: (design: PackagingDesign) => formatMoney(design.unitCost),
    },
    {
      label: 'Order cost',
      existing: existing ? formatMoney(existing.orderCost) : '—',
      cell: (design: PackagingDesign) => formatMoney(design.orderCost),
    },
  ]

  return (
    <section className="rounded-2xl border border-line bg-white shadow-card">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display text-xl font-semibold">Comparison</h2>
        <p className="mt-1 text-sm text-secondary">
          Existing cost is the figure you entered. Proposed costs are estimated from sheet area and the editable prices.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-secondary">
            <tr className="border-b border-line">
              <th className="px-5 py-3 font-semibold">Measure</th>
              <th className="px-4 py-3 font-semibold">Existing</th>
              {designs.map((design) => (
                <th
                  key={design.material.id}
                  className={cn('px-4 py-3 font-semibold', design.material.id === selectedId && 'bg-emerald/10 text-forest')}
                >
                  {design.material.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line/80 last:border-0">
                <th className="px-5 py-3 font-medium text-forest">{row.label}</th>
                <td className="px-4 py-3 tabular-nums text-secondary">{row.existing}</td>
                {designs.map((design) => (
                  <td
                    key={design.material.id}
                    className={cn('px-4 py-3 tabular-nums', design.material.id === selectedId && 'bg-emerald/10 font-medium')}
                  >
                    {row.cell(design)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
