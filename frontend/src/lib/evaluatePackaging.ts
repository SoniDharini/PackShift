import { internalFromOuter, outerFromInternal } from './calculations.ts'
import { evaluateCost, type CostEvaluation } from './costEvaluation.ts'
import { formatDims, formatMoney, formatNumber, formatPct } from './format.ts'
import { isCorrugatedBoard } from './packMaterial.ts'
import type { PackagingDesign, Size3 } from '../types/packaging.ts'

/**
 * Per-axis matching tolerance, used for both "too small" and "larger than required".
 * It absorbs floating-point error and sizes shown to 0.1 mm; it is not a size allowance.
 */
export const FIT_TOLERANCE_MM = 0.5

export type DimensionStatus = 'SUITABLE' | 'OVERSIZED' | 'UNDERSIZED' | 'INSUFFICIENT_INFORMATION' | 'NEW_DESIGN'

export const HEADINGS = {
  SUITABLE: 'Your Current Box Size Is Suitable',
  OVERSIZED: 'Your Current Box Is Larger Than Required',
  UNDERSIZED: 'Your Current Box Is Too Small',
  INSUFFICIENT_INFORMATION: 'Current Box Size Cannot Be Verified',
  NEW_DESIGN: 'Your New Carton Size',
  KEEP: 'Keep Existing Packaging',
} as const

export interface PackagingEvaluation {
  dimensionStatus: DimensionStatus
  headline: string
  needsChange: string
  why: string
  sizeLine: string
  volumeValue: string
  existingOuterKnown: boolean
  existingInner: Size3 | null
  existingOuter: Size3 | null
  requiredInner: Size3
  proposedOuter: Size3
  volumeChangePercent: number | null
}

export interface PackagingAdvice extends PackagingEvaluation {
  cost: CostEvaluation
  recommendationTitle: string
  recommendation: string
  next: string
}

const AXES = [
  ['length', 'l'],
  ['width', 'w'],
  ['height', 'h'],
] as const

function shorter(current: Size3, required: Size3) {
  return AXES.some(([, key]) => current[key] + FIT_TOLERANCE_MM < required[key])
}

function excess(current: Size3, required: Size3) {
  return AXES.some(([, key]) => current[key] > required[key] + FIT_TOLERANCE_MM)
}

function internalShortfall(current: Size3, required: Size3, product: Size3) {
  const gaps = AXES.filter(([, key]) => current[key] + FIT_TOLERANCE_MM < required[key])
  const needs = gaps.map(([axis, key]) => `${formatNumber(required[key] - current[key])} mm more internal ${axis}`).join(', ')
  const sentence = `The box needs ${needs} to meet your required clearance.`
  const blocked = gaps.filter(([, key]) => current[key] + FIT_TOLERANCE_MM < product[key])
  if (blocked.length) {
    const detail = blocked
      .map(([axis, key]) => `the inside ${axis} is ${formatNumber(current[key])} mm and the product is ${formatNumber(product[key])} mm`)
      .join(', ')
    return `The product cannot physically fit: ${detail}. ${sentence}`
  }
  return `The product fits, but without the clearance you specified. ${sentence}`
}

function statedShortfall(stated: Size3, required: Size3) {
  return AXES.filter(([, key]) => stated[key] + FIT_TOLERANCE_MM < required[key])
    .map(([axis, key]) => `the stated ${axis} of ${formatNumber(stated[key])} mm is already below the ${formatNumber(required[key])} mm inside size`)
    .join('; ')
}

function outerChange(existingOuter: Size3, proposedOuter: Size3) {
  const current = existingOuter.l * existingOuter.w * existingOuter.h
  const proposed = proposedOuter.l * proposedOuter.w * proposedOuter.h
  if (current <= 0) return null
  return ((proposed - current) / current) * 100
}

function sizeFromChange(change: number | null, existingOuter: Size3 | null, proposedOuter: Size3): { sizeLine: string; volumeValue: string } {
  const recommended = `Recommended outer size ${formatDims(proposedOuter)}.`
  if (change === null || !existingOuter) {
    return {
      sizeLine: `${recommended} Outer volume change needs the wall thickness or outside size of the current box.`,
      volumeValue: 'Outer size needed',
    }
  }
  const sizes = `Current outer size ${formatDims(existingOuter)}. ${recommended}`
  if (Math.abs(change) <= 0.05) {
    return { sizeLine: `${sizes} Size change: 0%.`, volumeValue: '0%' }
  }
  if (change > 0) {
    return {
      sizeLine: `${sizes} The recommended carton is ${formatPct(change)} larger so the product and clearance fit. This is not a saving.`,
      volumeValue: `${formatPct(change)} larger`,
    }
  }
  return { sizeLine: `${sizes} ${formatPct(Math.abs(change))} less packaging volume.`, volumeValue: `${formatPct(Math.abs(change))} smaller` }
}

function excessLine(current: Size3, required: Size3) {
  const words = { length: 'longer', width: 'wider', height: 'taller' } as const
  const parts = AXES.filter(([, key]) => current[key] > required[key] + FIT_TOLERANCE_MM).map(
    ([axis, key]) => `${formatNumber(current[key] - required[key])} mm ${words[axis]}`,
  )
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]
  return `The inside is ${list} than the ${formatDims(required)} required.`
}

/** The single size decision used by Design Studio, Redesign and Optimisation. */
export function evaluatePackagingDimensions(design: PackagingDesign): PackagingEvaluation {
  const requiredInner = design.internal
  const proposedOuter = design.external
  const base = {
    requiredInner,
    proposedOuter,
    existingInner: null as Size3 | null,
    existingOuter: null as Size3 | null,
    existingOuterKnown: false,
    volumeChangePercent: null as number | null,
  }
  const existing = design.existing
  if (!existing || design.mode !== 'redesign') {
    return {
      ...base,
      dimensionStatus: 'NEW_DESIGN',
      headline: HEADINGS.NEW_DESIGN,
      needsChange: 'This is a new carton, so there is no current box to check.',
      why: `The inside size is the product plus ${formatNumber(design.clearance)} mm clearance on every face. The outside size adds ${formatNumber(design.thickness)} mm of board on every face.`,
      sizeLine: `Recommended inside size ${formatDims(requiredInner)}. Recommended outer size ${formatDims(proposedOuter)}.`,
      volumeValue: 'New carton',
    }
  }

  const corrugated = isCorrugatedBoard(existing.materialLabel)
  let existingInner: Size3 | null = null
  let existingOuter: Size3 | null = null
  let missing = "The existing box's inside measurements or wall thickness are needed to confirm whether it provides enough room."

  if (existing.basis === 'internal') {
    existingInner = existing.size
    if (corrugated && existing.thicknessMm !== null) existingOuter = outerFromInternal(existing.size, existing.thicknessMm)
  } else if (existing.basis === 'external') {
    existingOuter = existing.size
    if (corrugated && existing.thicknessMm !== null) {
      const inner = internalFromOuter(existing.size, existing.thicknessMm)
      if (inner.l <= 0 || inner.w <= 0 || inner.h <= 0) {
        missing = 'The wall thickness is not smaller than the outside size, so the inside space cannot be estimated.'
      } else {
        existingInner = inner
      }
    } else if (!corrugated && shorter(existing.size, requiredInner)) {
      const change = outerChange(existing.size, proposedOuter)
      return {
        ...base,
        dimensionStatus: 'UNDERSIZED',
        headline: HEADINGS.UNDERSIZED,
        needsChange: 'Yes. The box needs to become larger.',
        why: `Your current packaging does not provide enough space for the product and specified clearance: ${statedShortfall(existing.size, requiredInner)}.`,
        existingOuter,
        existingOuterKnown: true,
        volumeChangePercent: change,
        ...sizeFromChange(change, existingOuter, proposedOuter),
      }
    } else if (!corrugated) {
      missing = `${existing.materialLabel} is not corrugated board, so a wall thickness cannot be used to find the inside space. Enter the inside size if you know it.`
    } else {
      missing = "The existing box's wall thickness is needed to confirm whether it provides enough room. You can enter the inside size instead."
    }
  } else {
    missing = 'Say whether those measurements are the outside size or the inside size of your current box.'
  }

  const change = existingOuter ? outerChange(existingOuter, proposedOuter) : null
  const shared = { ...base, existingInner, existingOuter, existingOuterKnown: existingOuter !== null, volumeChangePercent: change }
  const sized = sizeFromChange(change, existingOuter, proposedOuter)

  if (!existingInner) {
    return {
      ...shared,
      dimensionStatus: 'INSUFFICIENT_INFORMATION',
      headline: HEADINGS.INSUFFICIENT_INFORMATION,
      needsChange: 'We cannot tell yet.',
      why: missing,
      sizeLine: 'Size improvement cannot yet be calculated.',
      volumeValue: 'Not calculated',
    }
  }

  if (shorter(existingInner, requiredInner)) {
    return {
      ...shared,
      dimensionStatus: 'UNDERSIZED',
      headline: HEADINGS.UNDERSIZED,
      needsChange: 'Yes. The box needs to become larger.',
      why: `Your current packaging does not provide enough space for the product and specified clearance. ${internalShortfall(existingInner, requiredInner, design.product)}`,
      ...sized,
    }
  }

  if (excess(existingInner, requiredInner)) {
    return {
      ...shared,
      dimensionStatus: 'OVERSIZED',
      headline: HEADINGS.OVERSIZED,
      needsChange: 'Yes. The box could become smaller.',
      why: `Your current packaging has more space than the calculated requirement. A smaller carton may reduce packaging volume. ${excessLine(existingInner, requiredInner)}`,
      ...sized,
    }
  }

  return {
    ...shared,
    dimensionStatus: 'SUITABLE',
    headline: HEADINGS.SUITABLE,
    needsChange: 'No. No dimensional redesign is necessary.',
    why: 'Your existing packaging already provides the required space for the product and the specified clearance. No dimensional redesign is necessary.',
    ...sized,
  }
}

export function evaluatePackaging(design: PackagingDesign, peers: PackagingDesign[] = []): PackagingAdvice {
  const size = evaluatePackagingDimensions(design)
  const cost = evaluateCost(design, peers)
  const perUnit = cost.perUnitDifference
  let recommendationTitle: string
  let recommendation: string

  if (size.dimensionStatus === 'NEW_DESIGN') {
    recommendationTitle = 'Use This Carton Size'
    recommendation = `Use ${formatDims(size.proposedOuter)} as the outer size of the new carton. To check a box you already use, switch to Redesign existing packaging.`
  } else if (size.dimensionStatus === 'INSUFFICIENT_INFORMATION') {
    recommendationTitle = 'More Information Needed'
    recommendation = design.existing
      ? 'Provide the inside measurements or the wall thickness of your current box, then generate again. The cost comparison is still shown.'
      : 'Enter the box you use today, then generate again.'
  } else if (size.dimensionStatus === 'UNDERSIZED') {
    recommendationTitle = 'Correct Insufficient Space'
    recommendation = 'Your box needs more space to meet the specified clearance. Correct the dimensions before evaluating cost savings.'
  } else if (size.dimensionStatus === 'OVERSIZED') {
    recommendationTitle = 'Resize Packaging'
    recommendation = 'Your box could be smaller. The proposed dimensions reduce packaging volume, but we also need to compare costs before recommending a change.'
    if (perUnit !== null && perUnit > 0) {
      recommendation += ` On the current prices the smaller carton costs ${formatMoney(perUnit)} more per package, so the size change alone does not save money.`
    } else if (perUnit !== null && perUnit < 0) {
      recommendation += ` On the current prices the smaller carton is also ${formatMoney(Math.abs(perUnit))} cheaper per package, before protection testing.`
    }
  } else if (cost.cheapest) {
    recommendationTitle = 'Explore Cheaper Material'
    recommendation = 'A lower-cost material option is available. Review its estimated savings and protection requirements before switching.'
  } else if (perUnit !== null && perUnit > 0) {
    recommendationTitle = HEADINGS.KEEP
    recommendation =
      'Keep your existing carton dimensions. The proposed replacement costs more, so explore cheaper suitable materials or manufacturing methods. The current carton already meets the geometric requirements, and no lower-cost suitable replacement has been established.'
  } else {
    recommendationTitle = HEADINGS.KEEP
    recommendation = 'Keep your current box dimensions. You can still explore cost, material and manufacturing improvements.'
  }

  const next = recommendationTitle === HEADINGS.KEEP ? `${HEADINGS.KEEP}. ${recommendation}` : recommendation
  return { ...size, cost, recommendationTitle, recommendation, next }
}
