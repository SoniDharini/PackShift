import { formatArea, formatBlank, formatCm3, formatDims, formatLitres, formatMoney, formatMm, formatPct } from '../../lib/format.ts'
import { useDesign } from '../../state/DesignContext.tsx'
import { ButtonLink } from '../ui/Button.tsx'
import { PackEvaluationCard } from '../compare/PackEvaluationCard.tsx'
import { DirtyNotice } from './DirtyNotice.tsx'

function Row({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/80 py-2 text-sm last:border-b-0">
      <dt className="text-secondary">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-forest">
        {loading ? <span className="inline-block h-4 w-16 animate-pulse rounded bg-line" /> : value}
      </dd>
    </div>
  )
}

export function SpecPanel() {
  const { committedDesign, comparisons, status, generatedAt, formError, optimiseResult, optimiseLoading } = useDesign()
  const loading = status === 'loading'
  const design = committedDesign
  const time = new Date(generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <aside className="scroll-thin relative flex h-full min-h-0 flex-col overflow-y-auto bg-white">
      <div className="border-b border-line px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">Specification</p>
        <h2 className="mt-1 font-display text-lg font-semibold">{design?.productName ?? 'No design yet'}</h2>
      </div>
      <div className="space-y-4 px-4 py-4">
        <DirtyNotice compact />
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        <p className="sr-only" aria-live="polite">
          {loading ? 'Generating packaging design.' : design ? `Specification ready. Internal ${formatDims(design.internal)}.` : ''}
        </p>
        {design ? (
          <>
            <PackEvaluationCard design={design} evaluation={optimiseResult?.evaluation ?? null} checking={optimiseLoading} peers={comparisons} compact />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Packaging specification</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight">{loading ? '—' : formatDims(design.internal)}</p>
              <p className="mt-1 text-xs text-secondary">Inside size · {design.structure}</p>
            </div>
            <dl>
              <Row label="Outside size" value={formatDims(design.external)} loading={loading} />
              <Row label="Material" value={design.material.name} loading={loading} />
              <Row label="Board thickness" value={formatMm(design.thickness)} loading={loading} />
              <Row label="Clearance each side" value={formatMm(design.clearance)} loading={loading} />
              <Row label="Price per package" value={formatMoney(design.unitCost)} loading={loading} />
            </dl>
            {design.existing && design.existing.basis === 'external' ? (
              <div className="space-y-2 rounded-xl border border-line p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Outer volume</p>
                <CompareBar label="Existing outer" value={formatLitres(design.existing.volume)} width={100} />
                <CompareBar
                  label="Proposed outer"
                  value={formatLitres(design.externalVolume)}
                  width={Math.max(6, (design.externalVolume / design.existing.volume) * 100)}
                  accent
                />
              </div>
            ) : design.existing ? (
              <p className="text-xs leading-5 text-secondary">
                The stated size is not confirmed as the outer volume, so it is not drawn as a reduction against the proposed carton.
              </p>
            ) : (
              <p className="text-xs leading-5 text-secondary">Create mode has no existing pack, so volume and cost are not compared.</p>
            )}
            <details className="rounded-xl border border-line px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-forest">View Calculation Details</summary>
              <div className="mt-3 space-y-3 text-xs leading-5 text-secondary">
                <p>Product volume {formatLitres(design.productVolume)} · {formatCm3(design.productVolume)}. Inner box {formatLitres(design.internalVolume)}. Outer box {formatLitres(design.externalVolume)}.</p>
                <p>Blank {formatBlank(design.blankLength, design.blankWidth)}. Sheet area {formatArea(design.blankAreaM2)}. Unused space inside the new carton {formatPct(design.emptySpacePct)}. That unused space is not a saving.</p>
                {design.formulae.map((line) => (
                  <p key={line.label}>
                    <span className="font-medium text-forest">{line.label}. </span>
                    {line.expression}
                  </p>
                ))}
                {design.assumptions.map((item) => (
                  <p key={item}>{item}</p>
                ))}
                {design.notes.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </details>
            <div className="space-y-3">
              <p className="text-xs text-secondary">Generated {time}</p>
              <ButtonLink to="/optimise" className="w-full">
                Open Optimisation
              </ButtonLink>
            </div>
          </>
        ) : (
          <p className="text-sm leading-6 text-secondary">Generate a design to see internal size, sheet area, and cost.</p>
        )}
      </div>
    </aside>
  )
}

function CompareBar({ label, value, width, accent = false }: { label: string; value: string; width: number; accent?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-secondary">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-cream">
        <div
          className={accent ? 'h-full rounded-full bg-emerald motion-safe:transition-[width] motion-safe:duration-700' : 'h-full rounded-full bg-[#C5D0C8]'}
          style={{ width: `${Math.min(100, width)}%` }}
        />
      </div>
    </div>
  )
}
