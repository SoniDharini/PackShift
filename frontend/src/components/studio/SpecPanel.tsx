import { Link } from 'react-router-dom'
import { formatArea, formatBlank, formatCm3, formatDims, formatLitres, formatMoney, formatMm, formatPct } from '../../lib/format.ts'
import { useDesign } from '../../state/DesignContext.tsx'
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
  const { committedDesign, status, generatedAt, formError } = useDesign()
  const loading = status === 'loading'
  const design = committedDesign
  const time = new Date(generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <aside className="scroll-thin flex h-full min-h-0 flex-col overflow-y-auto bg-white">
      <div className="border-b border-line px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">Specification</p>
        <h2 className="mt-1 font-display text-lg font-semibold">{design?.productName ?? 'No design yet'}</h2>
      </div>
      <div className="space-y-4 px-4 py-4">
        <p className="rounded-xl border border-amber/70 bg-[#FBF6EC] px-3 py-2 text-xs leading-5 text-forest">
          Conceptual layout. Scores, board grade, and protection still need a converter and a pack test.
        </p>
        <DirtyNotice compact />
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        <p className="sr-only" aria-live="polite">
          {loading ? 'Generating packaging design.' : design ? `Specification ready. Internal ${formatDims(design.internal)}.` : ''}
        </p>
        {design ? (
          <>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Internal size</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight">{loading ? '—' : formatDims(design.internal)}</p>
              <p className="mt-1 text-xs text-secondary">{design.structure}</p>
            </div>
            <dl>
              <Row label="Outer size" value={formatDims(design.external)} loading={loading} />
              <Row label="Product volume" value={`${formatLitres(design.productVolume)} · ${formatCm3(design.productVolume)}`} loading={loading} />
              <Row label="Inner box volume" value={formatLitres(design.internalVolume)} loading={loading} />
              <Row label="Outer box volume" value={formatLitres(design.externalVolume)} loading={loading} />
              <Row label="Material" value={design.material.name} loading={loading} />
              <Row label="Board thickness" value={formatMm(design.thickness)} loading={loading} />
              <Row label="Clearance / face" value={formatMm(design.clearance)} loading={loading} />
              <Row label="Blank" value={formatBlank(design.blankLength, design.blankWidth)} loading={loading} />
              <Row label="Sheet area" value={formatArea(design.blankAreaM2)} loading={loading} />
              <Row label="Estimated unit cost" value={formatMoney(design.unitCost)} loading={loading} />
            </dl>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-secondary">Unused inner volume</span>
                <span className="font-medium tabular-nums">{loading ? '—' : formatPct(design.emptySpacePct)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cream" aria-hidden="true">
                <div
                  className={design.emptySpacePct > 50 ? 'h-full rounded-full bg-amber motion-safe:transition-[width] motion-safe:duration-700' : 'h-full rounded-full bg-emerald motion-safe:transition-[width] motion-safe:duration-700'}
                  style={{ width: loading ? '0%' : `${Math.min(100, Math.max(0, design.emptySpacePct))}%` }}
                />
              </div>
            </div>
            {design.existing ? (
              <div className="space-y-2 rounded-xl border border-line p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Against the stated pack</p>
                <CompareBar label="Stated volume" value={formatLitres(design.existing.volume)} width={100} />
                <CompareBar
                  label="Proposed outer"
                  value={formatLitres(design.externalVolume)}
                  width={Math.max(6, (design.externalVolume / design.existing.volume) * 100)}
                  accent
                />
              </div>
            ) : (
              <p className="text-xs leading-5 text-secondary">Create mode has no existing pack, so volume and cost are not compared.</p>
            )}
            <ul className="space-y-2 text-xs leading-5 text-secondary">
              {design.notes.slice(0, 3).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 text-xs text-secondary">
              <span>Generated {time}</span>
              <Link to="/optimise" className="font-semibold text-emerald-deep">
                Open optimisation
              </Link>
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
