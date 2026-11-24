import { describeEvaluation } from '../../lib/evaluationCopy.ts'
import { formatArea, formatBlank, formatMoney, formatNumber, formatPct } from '../../lib/format.ts'
import { type OptimiseCandidate, type OptimisePreference, type PackEvaluation } from '../../services/optimiseService.ts'
import type { PackagingDesign } from '../../types/packaging.ts'
import { useDesign } from '../../state/DesignContext.tsx'
import { Button } from '../ui/Button.tsx'

const PREFERENCES: { id: OptimisePreference; label: string }[] = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'lowest_cost', label: 'Lowest cost' },
  { id: 'lowest_material', label: 'Lowest material usage' },
]

function sizeText(size: { length: number; width: number; height: number }) {
  return `${formatNumber(size.length)} × ${formatNumber(size.width)} × ${formatNumber(size.height)} mm`
}

function moneyOr(value: number | null, fallback: string) {
  return value === null ? fallback : formatMoney(value)
}

function directionText(direction: string, difference: number | null) {
  if (direction === 'increase' && difference !== null) return `${formatMoney(difference)} higher`
  if (direction === 'decrease' && difference !== null) return `${formatMoney(Math.abs(difference))} lower`
  if (direction === 'unchanged') return 'Same cost'
  if (direction === 'unavailable') return 'Cost unavailable — pricing data required'
  return 'No existing cost to compare'
}

function Opportunity({
  title,
  status,
  summary,
  benefit,
  action,
  missing,
}: {
  title: string
  status: string
  summary: string
  benefit: string
  action: string
  missing?: string
}) {
  return (
    <article className="rounded-xl border border-line p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">{title}</p>
      <p className="mt-2 text-sm font-semibold text-forest">{status}</p>
      <p className="mt-2 text-sm leading-6 text-secondary">{summary}</p>
      <p className="mt-2 text-sm text-forest">{benefit}</p>
      <p className="mt-2 text-xs leading-5 text-secondary">Next: {action}</p>
      {missing ? <p className="mt-2 text-xs leading-5 text-secondary">Missing: {missing}</p> : null}
    </article>
  )
}

function EvaluationBoard({ design, evaluation, peers }: { design: PackagingDesign; evaluation: PackEvaluation; peers: PackagingDesign[] }) {
  const view = describeEvaluation(design, evaluation, false, peers)
  const fit = evaluation.dimensional
  const impact = evaluation.sustainability
  const making = evaluation.manufacturing
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Opportunity
          title="Can your box be smaller?"
          status={view.headline}
          summary={view.answerWhy}
          benefit={view.sizeLine}
          action={
            view.headline === 'Your Current Box Is Larger Than Required'
              ? 'Compare the smaller study carton. Do not treat it as a tested pack.'
              : view.headline === 'Your Current Box Is Too Small'
                ? 'Correct the size. Do not describe the change as a saving.'
                : view.headline === 'Your Current Box Size Is Suitable'
                  ? 'No dimensional redesign is needed. Keep the current size and review the other three areas.'
                  : 'Add the internal size, or the outer size and board thickness.'
          }
          missing={view.headline === 'Current Box Size Cannot Be Verified' ? view.answerWhy : `Required clearance ${sizeText(fit.required_clearance_mm)}.`}
        />
        <Opportunity
          title="Can you use a better or cheaper material?"
          status={view.cheaperNote}
          summary={view.alternativesLine}
          benefit={view.materialLine}
          action={evaluation.material.keeps_internal_dimensions ? 'Keep the inside size while you compare board prices.' : 'Price other boards on the space the product needs, not on an unconfirmed current cavity.'}
          missing={evaluation.material.strength_evidence ? undefined : 'A strength rating. A thinner board is not treated as suitable without one.'}
        />
        <Opportunity
          title="Can your packaging be made more cheaply?"
          status={making.code === 'MANUFACTURING_OPTIMISATION_AVAILABLE' ? 'Figures supplied' : 'Not estimated'}
          summary={
            making.purchased_sheet_m2 === null && making.supplier_unit_quote_inr === null
              ? `${view.manufacturingLine} Lower supplier conversion charges, better nesting, less waste, quantity price tiers and simpler printing are not estimated until supplier figures are entered. Edit the conversion charge in the material settings to test a supplier rate.`
              : making.summary
          }
          benefit={
            making.purchased_sheet_m2 === null
              ? `Finished blank ${formatArea(making.finished_blank_m2)}. No purchased-sheet saving is calculated.`
              : `Purchased sheet ${formatArea(making.purchased_sheet_m2)}. Scrap ${formatArea(making.scrap_m2 ?? 0)}. Potential figure — validation required.`
          }
          action="Supply a nesting yield or a supplier quote if you want a manufacturing comparison. The finished carton size stays as generated."
          missing={making.purchased_sheet_m2 === null && making.supplier_unit_quote_inr === null ? 'Nesting yield and supplier quote.' : undefined}
        />
        <Opportunity
          title="Can your packaging create less waste?"
          status={impact.carbon_kg === null ? 'Not quantified' : 'Factor supplied'}
          summary={impact.carbon_kg === null && impact.proposed_mass_g === null ? 'Environmental savings cannot yet be measured with the available material information.' : impact.message}
          benefit={impact.proposed_mass_g === null ? 'Material savings need additional information.' : `Proposed mass ${formatNumber(impact.proposed_mass_g)} g from the supplied grammage. The current pack's mass is unknown, so this is not a saving yet.`}
          action="Do not treat a change of material as an environmental improvement without mass and a stated factor."
          missing={impact.carbon_kg === null ? `Grammage and an emission factor for ${impact.current_material}.` : undefined}
        />
      </div>
      <p className="text-sm leading-6 text-secondary">{evaluation.protection.summary}</p>
    </div>
  )
}

function CandidateCard({ candidate }: { candidate: OptimiseCandidate }) {
  return (
    <details className="rounded-xl border border-line bg-cream/60 p-4">
      <summary className="cursor-pointer list-none">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <span className="font-medium text-forest">{candidate.board_name}</span>
            <span className="ml-2 text-sm text-secondary">{candidate.geometry_label}</span>
          </span>
          <span className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
            {candidate.preference_focus ? <span className="rounded-full bg-forest px-2 py-1 text-white">Study focus</span> : null}
            {candidate.on_pareto_front ? <span className="rounded-full bg-white px-2 py-1 text-emerald-deep">Nondominated</span> : null}
            <span className="rounded-full bg-white px-2 py-1 text-secondary">
              {candidate.feasibility === 'needs_validation' ? 'Needs testing' : candidate.feasibility === 'eligible' ? 'Validated' : 'Rejected'}
            </span>
          </span>
        </span>
        <span className="mt-2 block text-sm text-secondary">
          {moneyOr(candidate.cost.unit_cost_inr, candidate.cost.message ?? 'Cost unavailable — pricing data required')}
          {' · '}
          {formatArea(candidate.blank.area_m2)}
          {' · '}
          {formatNumber(candidate.volumes.outer_litres_display)} L outer
        </span>
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-6 text-secondary">
        <p>Internal {sizeText(candidate.internal_dimensions_mm)}. Outer estimate {sizeText(candidate.outer_dimensions_mm)}.</p>
        <p>{candidate.outer_dimension_note}</p>
        <p>
          Blank {formatBlank(candidate.blank.length_mm, candidate.blank.width_mm)}. Joint {formatNumber(candidate.blank.joint_mm)} mm, score allowance{' '}
          {formatNumber(candidate.blank.score_allowance_total_mm)} mm, flap relief {formatNumber(candidate.blank.flap_relief_mm)} mm. {candidate.blank.scope}
        </p>
        <p>
          Unused internal volume {formatPct(candidate.volumes.unused_internal_percent)}. Packaging mass{' '}
          {candidate.mass_g === null ? 'unknown — grammage was not supplied.' : `${formatNumber(candidate.mass_g)} g, estimated from supplied grammage.`}
        </p>
        <p>
          Board {moneyOr(candidate.cost.board_cost_inr, '—')}, converting {moneyOr(candidate.cost.conversion_cost_inr, '—')}, cutting{' '}
          {moneyOr(candidate.cost.cutting_cost_inr, '—')}, printing {candidate.cost.printing_cost_inr === null ? 'omitted' : formatMoney(candidate.cost.printing_cost_inr)}, joining{' '}
          {moneyOr(candidate.cost.joining_cost_inr, '—')}, cushioning {moneyOr(candidate.cost.cushioning_cost_inr, '—')}. Price basis: {candidate.cost.price_basis.replaceAll('_', ' ')}.
        </p>
        <p>{candidate.cost.printing_note}</p>
        <p>Order {moneyOr(candidate.cost.order_cost_inr, 'unavailable')}. {directionText(candidate.cost.direction, candidate.cost.order_difference_inr)}.</p>
        {candidate.dominance_note ? <p>{candidate.dominance_note}</p> : null}
        <ul className="list-disc space-y-1 pl-5">
          {candidate.feasibility_reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p>Missing evidence: {candidate.data_gaps.join(', ') || 'none recorded'}. Environmental data: {candidate.environmental_data}. Protection is not certified.</p>
      </div>
    </details>
  )
}

export function OptimisationEngine() {
  const { committedDesign, comparisons, optimisePreference, setOptimisePreference, optimiseResult: result, optimiseError: error, optimiseLoading: loading } = useDesign()
  const view = committedDesign ? describeEvaluation(committedDesign, result?.evaluation ?? null, false, comparisons) : null

  if (!committedDesign?.existing) {
    return (
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="font-display text-xl font-semibold">Optimisation study</h2>
        <p className="mt-2 text-sm leading-6 text-secondary">Enter the current packaging in the studio before asking for alternatives. A new carton is not compared with a pack that was not supplied.</p>
      </section>
    )
  }

  const proposed = result?.current_generated
  const comparison = result?.comparison
  const ordered = result
    ? [...result.candidates].sort((left, right) => Number(right.preference_focus) - Number(left.preference_focus) || Number(right.on_pareto_front) - Number(left.on_pareto_front))
    : []

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card" aria-busy={loading}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Ways to improve</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            The catalogue study uses the generated product, clearance, quantity and current cost. It does not replace the selected board price above. A study focus is a comparison, not an instruction to switch packs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PREFERENCES.map((item) => (
            <Button key={item.id} size="sm" variant={optimisePreference === item.id ? 'primary' : 'secondary'} onClick={() => setOptimisePreference(item.id)}>
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      {loading ? <p className="text-sm text-secondary">Updating the study…</p> : null}
      {error ? (
        <div className="rounded-xl border border-amber bg-amber/20 p-4 text-sm leading-6 text-forest" role="alert">
          {error} The comparison above still uses the studio calculator. Start the local API on port 8000 and try again.
        </div>
      ) : null}
      {result && proposed && comparison ? (
        <>
          {result.evaluation && committedDesign ? <EvaluationBoard design={committedDesign} evaluation={result.evaluation} peers={comparisons} /> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-line p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Current order</p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{moneyOr(comparison.existing_order_cost_inr, '—')}</p>
              <p className="mt-1 text-xs text-secondary">{result.existing_packaging.material_name}, as entered</p>
            </article>
            <article className="rounded-xl border border-line p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Catalogue C-flute order</p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{moneyOr(comparison.proposed_order_cost_inr, 'Cost unavailable — pricing data required')}</p>
              <p className="mt-1 text-xs text-secondary">Simplified C-flute study, not the selected board if you changed its price or thickness.</p>
            </article>
            <article className="rounded-xl border border-line p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Catalogue difference</p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{directionText(comparison.direction, comparison.order_cost_difference_inr)}</p>
              <p className="mt-1 text-xs text-secondary">{comparison.change_percent === null ? 'Percentage needs both costs' : formatPct(comparison.change_percent)}</p>
            </article>
            <article className="rounded-xl border border-line p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Catalogue carton</p>
              <p className="mt-2 font-display text-lg font-semibold tabular-nums">{sizeText(proposed.outer_dimensions_mm)}</p>
              <p className="mt-1 text-xs text-secondary">Internal {sizeText(proposed.internal_dimensions_mm)}. Unused inner space {formatPct(proposed.volumes.unused_internal_percent)} is not an optimisation score.</p>
            </article>
          </div>
          <p className="text-sm leading-6 text-secondary">
            {result.objective_note} Primary recommendation: {view?.recommendationTitle}. {view?.recommendation}
          </p>
          <div className="space-y-3">
            <h3 className="font-display text-lg font-semibold">Alternative designs</h3>
            {ordered.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
          </div>
          <details className="rounded-xl border border-line px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-forest">View Calculation Details</summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-forest">Warnings</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-secondary">
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-forest">Assumptions</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-secondary">
                  {result.assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        </>
      ) : null}
    </section>
  )
}
