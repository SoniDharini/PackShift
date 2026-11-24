import { evaluatePackaging } from './evaluatePackaging.ts'
import { formatMoney, formatPct } from './format.ts'
import { isCorrugatedBoard } from './packMaterial.ts'
import type { PackagingDesign } from '../types/packaging.ts'
import type { PackEvaluation } from '../services/optimiseService.ts'
import type { CostOption } from './costEvaluation.ts'

export type EvaluationStatus =
  | 'Your Current Box Size Is Suitable'
  | 'Your Current Box Is Larger Than Required'
  | 'Your Current Box Is Too Small'
  | 'Current Box Size Cannot Be Verified'

export interface EvaluationView {
  status: EvaluationStatus
  explanation: string
  nextAction: string
  headline: string
  recommendationTitle: string
  recommendation: string
  answerChange: string
  answerWhy: string
  answerSaving: string
  answerNext: string
  sizeLine: string
  costHeadline: string
  costExplanation: string
  costWhy: string
  costParts: string[]
  reduceLine: string
  manufacturingLine: string
  cheaperNote: string
  alternativesLine: string
  costOptions: CostOption[]
  dimensionalValue: string
  dimensionalDetail: string
  materialLine: string
  costValue: string
  costDetail: string
  existingOuterKnown: boolean
  showExistingSheet: boolean
  showExistingUnused: boolean
}

export function existingCartonSheetApplies(design: PackagingDesign) {
  const existing = design.existing
  if (!existing || existing.basis !== 'internal') return false
  return isCorrugatedBoard(existing.materialLabel)
}

function materialLine(evaluation: PackEvaluation | null) {
  const current = evaluation?.sustainability.current_mass_g
  const proposed = evaluation?.sustainability.proposed_mass_g
  if (current == null || proposed == null || current <= 0) return 'Material savings need additional information.'
  const pct = ((current - proposed) / current) * 100
  if (pct > 0.05) return `${formatPct(pct)} less packaging material by mass. This still needs the supplied grammage to be confirmed.`
  if (pct < -0.05) return `The proposed pack uses ${formatPct(Math.abs(pct))} more material by mass.`
  return 'No material-mass reduction.'
}

/**
 * Presents the shared evaluation. The API result only adds material mass;
 * it never changes the size status, cost figures or recommendation.
 */
export function describeEvaluation(
  design: PackagingDesign,
  evaluation: PackEvaluation | null,
  _checking: boolean,
  peers: PackagingDesign[] = [],
): EvaluationView {
  const advice = evaluatePackaging(design, peers)
  const cost = advice.cost
  const material = materialLine(evaluation)
  const status = advice.headline as EvaluationStatus
  const alternatives = cost.options
    .map((item) => {
      const delta =
        item.perUnitDifference === null
          ? ''
          : item.perUnitDifference === 0
            ? ' (same as today)'
            : ` (${formatMoney(Math.abs(item.perUnitDifference))} ${item.perUnitDifference > 0 ? 'more' : 'less'})`
      return `${item.name} ${formatMoney(item.unitCost)}${delta}`
    })
    .join('; ')
  return {
    status,
    headline: status,
    recommendationTitle: advice.recommendationTitle,
    recommendation: advice.recommendation,
    explanation: `${advice.needsChange} ${advice.why}`,
    nextAction: advice.next,
    answerChange: advice.needsChange,
    answerWhy: advice.why,
    answerSaving: `${advice.sizeLine} ${cost.savingLine}`,
    answerNext: advice.next,
    sizeLine: advice.sizeLine,
    costHeadline: cost.headline,
    costExplanation: cost.difference,
    costWhy: cost.perUnitDifference !== null && cost.perUnitDifference > 0 ? `${cost.reason} ${cost.manufacturing}` : cost.reason,
    costParts: cost.breakdown,
    reduceLine: cost.reduce,
    manufacturingLine: cost.manufacturing,
    cheaperNote: cost.cheapest ? 'A lower-cost option is available' : 'No lower-cost option found',
    alternativesLine: `${alternatives}. All use the required inside size. None has a protection test yet. ${cost.furtherOptions.join(' ')}`,
    costOptions: cost.options,
    dimensionalValue: advice.volumeValue,
    dimensionalDetail: advice.sizeLine,
    existingOuterKnown: advice.existingOuterKnown,
    materialLine: material,
    costValue: cost.shortValue,
    costDetail: cost.shortDetail,
    showExistingSheet: existingCartonSheetApplies(design),
    showExistingUnused: design.existing?.basis === 'internal' && advice.existingInner !== null,
  }
}
