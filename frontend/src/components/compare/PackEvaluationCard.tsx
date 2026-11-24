import { describeEvaluation } from '../../lib/evaluationCopy.ts'
import { cn } from '../../lib/cn.ts'
import type { PackagingDesign } from '../../types/packaging.ts'
import type { PackEvaluation } from '../../services/optimiseService.ts'

export function PackEvaluationCard({
  design,
  evaluation,
  checking,
  peers = [],
  compact = false,
}: {
  design: PackagingDesign
  evaluation: PackEvaluation | null
  checking: boolean
  peers?: PackagingDesign[]
  compact?: boolean
}) {
  const view = describeEvaluation(design, evaluation, checking && !evaluation, peers)
  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-deep">Your packaging evaluation</p>
      <h2 className={cn('mt-2 font-display font-semibold tracking-tight', compact ? 'text-xl' : 'text-2xl')}>{view.headline}</h2>
      <dl className="mt-4 space-y-3 text-sm leading-6">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Does it need to change?</dt>
          <dd className="text-forest">{view.answerChange}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">Why?</dt>
          <dd className="text-secondary">{view.answerWhy}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">What could you save?</dt>
          <dd className="text-secondary">{view.answerSaving}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">What to do next</dt>
          <dd className="text-forest">{view.answerNext}</dd>
        </div>
      </dl>
      <div className="mt-4 rounded-xl border border-line bg-cream/50 p-3">
        <p className="text-sm font-semibold text-forest">{view.costHeadline}</p>
        <p className="mt-1 text-sm leading-6 text-secondary">{view.costExplanation}</p>
        <p className="mt-2 text-sm font-medium text-forest">Why is the cost changing?</p>
        <p className="text-sm leading-6 text-secondary">{view.costWhy}</p>
        <ul className="mt-2 space-y-1 text-sm text-secondary">
          {view.costParts.map((part) => (
            <li key={part}>{part}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-secondary">{view.reduceLine}</p>
      </div>
    </section>
  )
}
