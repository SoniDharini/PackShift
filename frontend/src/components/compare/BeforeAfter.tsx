import { formatDims, formatLitres, formatReduction } from '../../lib/format.ts'
import type { PackagingDesign } from '../../types/packaging.ts'
import { boundsOf, existingPalette, isoBox, proposedPalette } from '../visual/IsoBox.tsx'

export function BeforeAfter({ design }: { design: PackagingDesign }) {
  const existing = design.existing
  if (!existing) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="font-display text-xl font-semibold">Proposed carton</h2>
        <p className="mt-2 text-sm leading-6 text-secondary">
          No existing pack was entered, so there is no before-and-after. The proposed outer size is {formatDims(design.external)}.
        </p>
      </div>
    )
  }

  const gap = Math.max(existing.size.l, design.external.l) * 0.4 + 140
  const before = isoBox(existing.size.l, existing.size.w, existing.size.h, 0, existingPalette)
  const after = isoBox(
    design.external.l,
    design.external.w,
    design.external.h,
    existing.size.l + existing.size.w + gap,
    proposedPalette,
  )
  const points: [number, number][] = [
    ...before.points,
    ...after.points,
    [before.label[0], before.label[1] + 78],
    [after.label[0], after.label[1] + 78],
  ]
  const bounds = boundsOf(points, 18)
  const font = Math.max(14, bounds.width * 0.028)
  const stroke = Math.max(1.4, font * 0.08)

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Before and after</h2>
          <p className="mt-1 text-sm text-secondary">Same scale. Grey is the stated pack. The kraft carton is the proposal.</p>
        </div>
        <p className="text-sm font-semibold text-emerald-deep">{formatReduction(design.volumeReductionPct)}</p>
      </div>
      <svg viewBox={bounds.viewBox} role="img" aria-label="Existing and proposed cartons drawn to the same scale" className="mt-4 h-auto w-full">
        {[before, after].map((model) =>
          model.faces.map((face) => (
            <path key={`${model.label[0]}-${face.id}`} d={face.d} fill={face.fill} stroke={model.stroke} strokeWidth={stroke} strokeLinejoin="round" />
          )),
        )}
        <text x={before.label[0]} y={before.label[1] + font * 1.4} textAnchor="middle" fontSize={font} fill="#142923" fontFamily="Inter, sans-serif">
          Stated pack
        </text>
        <text x={before.label[0]} y={before.label[1] + font * 2.6} textAnchor="middle" fontSize={font * 0.82} fill="#4A5C54" fontFamily="Inter, sans-serif">
          {formatDims(existing.size)} · {formatLitres(existing.volume)}
        </text>
        <text x={after.label[0]} y={after.label[1] + font * 1.4} textAnchor="middle" fontSize={font} fill="#142923" fontFamily="Inter, sans-serif">
          Proposed
        </text>
        <text x={after.label[0]} y={after.label[1] + font * 2.6} textAnchor="middle" fontSize={font * 0.82} fill="#4A5C54" fontFamily="Inter, sans-serif">
          {formatDims(design.external)} · {formatLitres(design.externalVolume)}
        </text>
      </svg>
    </section>
  )
}
