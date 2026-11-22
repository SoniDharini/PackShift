import { useEffect, useState } from 'react'
import { BeforeAfter } from '../components/compare/BeforeAfter.tsx'
import { ComparisonTable } from '../components/compare/ComparisonTable.tsx'
import { MaterialBoard } from '../components/compare/MaterialBoard.tsx'
import { WhyDesign } from '../components/compare/WhyDesign.tsx'
import { WorkspaceHeader } from '../components/layout/WorkspaceHeader.tsx'
import { DirtyNotice } from '../components/studio/DirtyNotice.tsx'
import { ButtonLink } from '../components/ui/Button.tsx'
import { formatLitres, formatMoney, formatPct, formatReduction } from '../lib/format.ts'
import { cn } from '../lib/cn.ts'
import { useDesign } from '../state/DesignContext.tsx'

function Metric({ label, value, detail, wide = false }: { label: string; value: string; detail: string; wide?: boolean }) {
  return (
    <article className={cn('rise rounded-2xl border border-line bg-white p-4 shadow-card', wide && 'sm:col-span-2 xl:col-span-1')}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-secondary">{detail}</p>
    </article>
  )
}

function SharedNumber({
  label,
  value,
  suffix,
  onCommit,
}: {
  label: string
  value: string
  suffix: string
  onCommit: (value: string) => void
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-secondary">{label}</span>
      <span className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3">
        <input
          value={text}
          inputMode="decimal"
          className="w-full bg-transparent text-sm tabular-nums outline-none"
          onChange={(event) => {
            const next = event.target.value
            if (!/^\d*\.?\d{0,2}$/.test(next)) return
            setText(next)
            if (next !== '' && next !== '.') onCommit(next)
          }}
          onBlur={() => setText(value)}
        />
        <span className="text-xs text-secondary">{suffix}</span>
      </span>
    </label>
  )
}

export function OptimisePage() {
  const { committedDesign: design, comparisons, updateCommittedFields } = useDesign()
  useEffect(() => {
    document.title = 'Optimisation — PackShift'
  }, [])

  return (
    <div className="min-h-dvh bg-cream">
      <WorkspaceHeader />
      <main id="main" className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-deep">Optimisation</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Compare the pack, not a slogan.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
              Volume, sheet area, and cost for the last generated specification. Change a price or a thickness and the figures update.
            </p>
          </div>
          <ButtonLink to="/studio" variant="secondary">
            Back to studio
          </ButtonLink>
        </div>
        <DirtyNotice />
        {design ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {design.existing ? (
                <>
                  <Metric label="Existing volume" value={formatLitres(design.existing.volume)} detail="Stated pack, as entered" />
                  <Metric label="Proposed volume" value={formatLitres(design.externalVolume)} detail="Outer box of the selected board" />
                  <Metric label="Volume change" value={formatReduction(design.volumeReductionPct)} detail="Proposed outer versus stated pack" />
                  <Metric label="Cost per unit" value={formatMoney(design.unitCost)} detail="Board, conversion, and insert" />
                  <Metric
                    label="Difference per order"
                    value={design.orderCostDelta === null ? '—' : formatMoney(design.orderCostDelta)}
                    detail={
                      design.orderCostDelta === null
                        ? 'No existing cost'
                        : design.orderCostDelta < 0
                          ? `${formatMoney(Math.abs(design.orderCostDelta))} lower on ${design.quantity} packs`
                          : `${formatMoney(design.orderCostDelta)} higher on ${design.quantity} packs`
                    }
                  />
                </>
              ) : (
                <>
                  <Metric label="Product volume" value={formatLitres(design.productVolume)} detail="From the entered measurements" />
                  <Metric label="Proposed volume" value={formatLitres(design.externalVolume)} detail="Outer box" />
                  <Metric label="Unused inner volume" value={formatPct(design.emptySpacePct)} detail="Product versus internal box" />
                  <Metric label="Cost per unit" value={formatMoney(design.unitCost)} detail="Board, conversion, and insert" />
                  <Metric label="Order cost" value={formatMoney(design.orderCost)} detail={`${design.quantity} packs at the estimated unit cost`} />
                </>
              )}
            </section>
            <div className="grid items-start gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <BeforeAfter design={design} />
              <WhyDesign design={design} />
            </div>
            <div className="grid gap-3 rounded-2xl border border-line bg-white p-4 shadow-card sm:grid-cols-3">
              <SharedNumber
                label="Order quantity"
                suffix="packs"
                value={String(design.quantity)}
                onCommit={(value) => updateCommittedFields({ quantity: value })}
              />
              {design.mode === 'redesign' ? (
                <SharedNumber
                  label="Existing unit cost"
                  suffix="INR"
                  value={design.existing ? String(design.existing.unitCost) : ''}
                  onCommit={(value) => updateCommittedFields({ existingUnitCost: value })}
                />
              ) : (
                <p className="self-end text-sm leading-6 text-secondary">Switch the studio to redesign to enter a current pack and cost.</p>
              )}
              <p className="self-end text-sm leading-6 text-secondary">
                Quantity and the existing cost update the comparison immediately. Product measurements update when you generate.
              </p>
            </div>
            <MaterialBoard designs={comparisons} />
            <ComparisonTable designs={comparisons} selectedId={design.material.id} />
          </>
        ) : (
          <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-card">
            <h2 className="font-display text-2xl font-semibold">Generate a specification first.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">
              The comparison uses the last valid design from the studio. The ceramic mug example is ready when you open it.
            </p>
            <ButtonLink to="/studio" className="mt-5">
              Open the design studio
            </ButtonLink>
          </div>
        )}
        <p className="sr-only">{design ? 'Comparison ready' : 'No comparison yet'}</p>
      </main>
    </div>
  )
}
