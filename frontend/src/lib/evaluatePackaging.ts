import { evaluateCost, type CostEvaluation } from './costEvaluation.ts'
import { formatDims, formatMoney, formatNumber, formatPct } from './format.ts'
import { isCorrugatedBoard } from './packMaterial.ts'
import type { PackagingDesign, Size3 } from '../types/packaging.ts'

const TOLERANCE_MM = 0.5
const AXIS_EXCESS_MM = 10

export type DimensionStatus = 'SUITABLE' | 'OVERSIZED' | 'UNDERSIZED' | 'INSUFFICIENT_INFORMATION'

export const HEADINGS = {
  SUITABLE: 'Your Current Box Size Is Suitable',
  OVERSIZED: 'Your Current Box Is Larger Than Required',
  UNDERSIZED: 'Your Current Box Is Too Small',
  INSUFFICIENT_INFORMATION: 'Current Box Size Cannot Be Verified',
  KEEP: 'Keep Your Existing Packaging',
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
  return AXES.some(([, key]) => current[key] + TOLERANCE_MM < required[key])
}

function excess(current: Size3, required: Size3) {
  return AXES.some(([, key]) => current[key] > required[key] + AXIS_EXCESS_MM)
}

function internalShortfall(current: Size3, required: Size3, product: Size3) {
  const gaps = AXES.filter(([, key]) => current[key] + TOLERANCE_MM < required[key])
  const needs = gaps.map(([axis, key]) => `${formatNumber(required[key] - current[key])} mm more internal ${axis}`).join(', ')
  const sentence = `The box needs ${needs} to meet your required clearance.`
  const blocked = gaps.filter(([, key]) => current[key] + TOLERANCE_MM < product[key])
  if (blocked.length) {
    const detail = blocked
      .map(([axis, key]) => `the inside ${axis} is ${formatNumber(current[key])} mm and the product is ${formatNumber(product[key])} mm`)
      .join(', ')
    return `The product cannot physically fit: ${detail}. ${sentence}`
  }
  return `The product fits, but without the clearance you specified. ${sentence}`
}

function statedShortfall(stated: Size3, required: Size3) {
  return AXES.filter(([, key]) => stated[key] + TOLERANCE_MM < required[key])
    .map(([axis, key]) => `the stated ${axis} of ${formatNumber(stated[key])} mm is already below the ${formatNumber(required[key])} mm inside size`)
    .join('; ')
}

function outerChange(existingOuter: Size3, proposedOuter: Size3) {
  const current = existingOuter.l * existingOuter.w * existingOuter.h
  const proposed = proposedOuter.l * proposedOuter.w * proposedOuter.h
  if (current <= 0) return null
  return ((proposed - current) / current) * 100
}

function sizeFromChange(change: number | null, proposedOuter?: Size3): { sizeLine: string; volumeValue: string } {
  if (change === null) {
    return {
      sizeLine: 'Outer volume change needs the outside size of the current box.',
      volumeValue: 'Outer size needed',
    }
  }
  if (Math.abs(change) <= 0.05) {
    return {
      sizeLine: 'Both packaging designs occupy the same outer space. Volume change: 0%.',
      volumeValue: '0%',
    }
  }
  if (change > 0) {
    return { sizeLine: `Proposed carton is ${formatPct(change)} larger. This is not a saving.`, volumeValue: `${formatPct(change)} larger` }
  }
  const candidate = proposedOuter ? ` with a ${formatDims(proposedOuter)} carton` : ''
  return { sizeLine: `${formatPct(Math.abs(change))} less packaging volume${candidate}.`, volumeValue: `${formatPct(Math.abs(change))} smaller` }
}

export function evaluateDimensions(design: PackagingDesign): PackagingEvaluation {
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
      dimensionStatus: 'INSUFFICIENT_INFORMATION',
      headline: HEADINGS.INSUFFICIENT_INFORMATION,
      needsChange: 'There is no current box to check.',
      why: 'Switch to redesign and enter the box you use today.',
      sizeLine: 'No current box to compare.',
      volumeValue: 'Not compared',
    }
  }

  const corrugated = isCorrugatedBoard(existing.materialLabel)
  let existingInner: Size3 | null = null
  let existingOuter: Size3 | null = null
  let missing = "The existing box's inside measurements or wall thickness are needed to confirm whether it provides enough room."

  if (existing.basis === 'internal') {
    existingInner = existing.size
    if (corrugated && existing.thicknessMm !== null) {
      const thickness = existing.thicknessMm
      existingOuter = { l: existing.size.l + 2 * thickness, w: existing.size.w + 2 * thickness, h: existing.size.h + 2 * thickness }
    }
  } else if (existing.basis === 'external') {
    existingOuter = existing.size
    if (corrugated && existing.thicknessMm !== null) {
      const thickness = existing.thicknessMm
      const inner = { l: existing.size.l - 2 * thickness, w: existing.size.w - 2 * thickness, h: existing.size.h - 2 * thickness }
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
        why: `Your existing box does not provide enough space for your product and its required clearance: ${statedShortfall(existing.size, requiredInner)}.`,
        existingOuter,
        existingOuterKnown: true,
        volumeChangePercent: change,
        ...sizeFromChange(change),
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
      why: `Your existing box does not provide enough space for your product and its required clearance. ${internalShortfall(existingInner, requiredInner, design.product)}`,
      ...sizeFromChange(change),
    }
  }

  if (excess(existingInner, requiredInner)) {
    const sized = sizeFromChange(change, proposedOuter)
    return {
      ...shared,
      dimensionStatus: 'OVERSIZED',
      headline: HEADINGS.OVERSIZED,
      needsChange: 'Yes. The box could become smaller.',
      why: 'Your existing box has more space than necessary. A smaller carton may reduce packaging space.',
      sizeLine: change === null ? 'A smaller carton may reduce packaging space. The outer-volume change needs the wall thickness or outside size of the current box.' : sized.sizeLine,
      volumeValue: sized.volumeValue,
    }
  }

  return {
    ...shared,
    dimensionStatus: 'SUITABLE',
    headline: HEADINGS.SUITABLE,
    needsChange: 'No. No dimensional redesign is needed.',
    why: 'Your current box already provides enough space for the product and the required clearance. No dimensional redesign is needed.',
    ...sizeFromChange(change),
  }
}

export function evaluatePackaging(design: PackagingDesign, peers: PackagingDesign[] = []): PackagingAdvice {
  const size = evaluateDimensions(design)
  const cost = evaluateCost(design, peers)
  const perUnit = cost.perUnitDifference
  let recommendationTitle: string
  let recommendation: string

  if (size.dimensionStatus === 'INSUFFICIENT_INFORMATION') {
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
      'Keep your current box dimensions. At the current prices, replacing your existing packaging would increase costs. Explore a lower-cost board or manufacturing supplier before changing.'
  } else {
    recommendationTitle = HEADINGS.KEEP
    recommendation = 'Your current packaging meets the evaluated requirements, and no supported alternative currently offers a worthwhile improvement. Keep your existing box dimensions. Explore material or manufacturing improvements if you want to reduce costs.'
  }

  const next = recommendationTitle === HEADINGS.KEEP ? `${HEADINGS.KEEP}. ${recommendation}` : recommendation
  return { ...size, cost, recommendationTitle, recommendation, next }
}
