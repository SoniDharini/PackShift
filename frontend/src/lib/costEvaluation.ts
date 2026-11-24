import { cents, formatMoney, formatNumber, formatPct } from './format.ts'
import type { PackagingDesign } from '../types/packaging.ts'

const DOMINANT_SHARE = 0.6

export interface CostOption {
  id: string
  name: string
  unitCost: number
  boardCost: number
  conversion: number
  otherCost: number
  perUnitDifference: number | null
  orderDifference: number | null
  maxConversionForTarget: number | null
  fitsRequiredInside: boolean
  protectionTested: boolean
  belowTarget: boolean
  recommendation: string
}

export interface CostEvaluation {
  target: number | null
  existingUnit: number | null
  proposedUnit: number
  perUnitDifference: number | null
  orderDifference: number | null
  changePercent: number | null
  headline: string
  difference: string
  reason: string
  breakdown: string[]
  manufacturing: string
  reduce: string
  savingLine: string
  shortValue: string
  shortDetail: string
  options: CostOption[]
  cheapest: CostOption | null
  lowestPriced: CostOption | null
  furtherOptions: string[]
}

function sameSize(left: PackagingDesign, right: PackagingDesign) {
  return left.internal.l === right.internal.l && left.internal.w === right.internal.w && left.internal.h === right.internal.h
}

export function costReason(board: number, conversion: number, other: number) {
  const total = board + conversion + other
  if (total <= 0) return 'The proposed carton has no priced cost components.'
  if (board / total >= DOMINANT_SHARE) return 'Your proposed packaging costs more mainly because of its board material.'
  if (conversion / total >= DOMINANT_SHARE) return 'Your proposed packaging costs more mainly because of its manufacturing charge.'
  return 'Your proposed packaging costs more because of board material and manufacturing charges.'
}

function option(design: PackagingDesign, base: PackagingDesign, target: number | null): CostOption {
  const boardCost = cents(design.boardCost)
  const otherCost = cents(design.insertCost)
  const perUnitDifference = target === null ? null : cents(design.unitCost - target)
  const fits = sameSize(design, base)
  const below = perUnitDifference !== null && perUnitDifference < 0
  let recommendation = 'No current cost to compare.'
  if (!fits) recommendation = 'Does not match the required inside size.'
  else if (below) recommendation = 'Lower cost on these prices. Test protection before switching.'
  else if (perUnitDifference === 0) recommendation = 'Same cost as your current packaging.'
  else if (perUnitDifference !== null) recommendation = 'Costs more than your current packaging.'
  return {
    id: design.material.id,
    name: design.material.name,
    unitCost: design.unitCost,
    boardCost,
    conversion: design.conversionCost,
    otherCost,
    perUnitDifference,
    orderDifference: perUnitDifference === null ? null : cents(design.orderCost - cents(target! * design.quantity)),
    maxConversionForTarget: target === null ? null : cents(target - boardCost - otherCost),
    fitsRequiredInside: fits,
    protectionTested: false,
    belowTarget: fits && below,
    recommendation,
  }
}

function furtherOptions(design: PackagingDesign) {
  const notes = [
    design.fragility === 'high'
      ? 'A folding paperboard carton is not suggested because the protection level is high.'
      : 'A folding paperboard carton may suit light retail goods, but this version has no folding-carton geometry or prices, so it needs additional design support. FEFCO 0201 formulas are not used for it.',
  ]
  if (design.category.trim().toLowerCase() === 'food') {
    notes.push('A food-safe pouch or wrapper needs food-contact, moisture-barrier and shelf-life data and a price before it can be compared. Being lighter is not enough to recommend it.')
  }
  return notes
}

export function evaluateCost(design: PackagingDesign, peers: PackagingDesign[] = []): CostEvaluation {
  const existing = design.existing
  const target = existing ? existing.unitCost : null
  const designs = peers.some((peer) => peer.material.id === design.material.id) ? peers : [design, ...peers]
  const options = designs.map((peer) => option(peer, design, target))
  const eligible = options.filter((item) => item.belowTarget)
  const cheapest = eligible.length ? [...eligible].sort((left, right) => left.unitCost - right.unitCost)[0] : null
  const priced = options.filter((item) => item.fitsRequiredInside)
  const lowestPriced = priced.length ? [...priced].sort((left, right) => left.unitCost - right.unitCost)[0] : null
  const proposal = option(design, design, target)
  const breakdown = [`Board material: ${formatMoney(proposal.boardCost)}`, `Manufacturing/conversion: ${formatMoney(design.conversionCost)}`]
  if (design.insertCost > 0) breakdown.push(`Cushioning: ${formatMoney(design.insertCost)}`)
  breakdown.push(`Total: ${formatMoney(design.unitCost)}`)
  const quantity = formatNumber(design.quantity)
  const furtherOptionsList = furtherOptions(design)

  if (!existing || target === null) {
    return {
      target,
      existingUnit: null,
      proposedUnit: design.unitCost,
      perUnitDifference: null,
      orderDifference: null,
      changePercent: null,
      headline: `Proposed ${design.material.name}: ${formatMoney(design.unitCost)} Per Unit`,
      difference: `${formatMoney(design.orderCost)} for ${quantity} packages.`,
      reason: 'This price comes from the selected board, the conversion charge, and any insert.',
      breakdown,
      manufacturing: 'Enter your current packaging cost to set a cost target.',
      reduce: 'Enter your current packaging cost to check whether a cheaper option exists.',
      savingLine: 'No current cost to compare.',
      shortValue: formatMoney(design.unitCost),
      shortDetail: `${formatMoney(design.orderCost)} for ${quantity} packs`,
      options,
      cheapest: null,
      lowestPriced,
      furtherOptions: furtherOptionsList,
    }
  }

  const perUnit = proposal.perUnitDifference ?? 0
  const order = design.orderCostDelta ?? 0
  const changePercent = target > 0 ? ((design.unitCost - target) / target) * 100 : null
  const pctText = changePercent === null ? '' : ` (${formatPct(Math.abs(changePercent))} ${perUnit >= 0 ? 'higher' : 'lower'})`
  const headline = `Your Current Packaging Costs ${formatMoney(target)} Per Unit · Proposed ${design.material.name}: ${formatMoney(design.unitCost)} Per Unit`

  let difference: string
  let reason: string
  let shortValue: string
  let shortDetail: string
  if (perUnit > 0) {
    difference = `This carton is ${formatMoney(perUnit)} more expensive per package. For ${quantity} packages, that is ${formatMoney(order)} more${pctText}.`
    reason = costReason(proposal.boardCost, design.conversionCost, proposal.otherCost)
    shortValue = changePercent === null ? formatMoney(perUnit) : `${formatPct(changePercent)} higher`
    shortDetail = `${formatMoney(target)} today, ${formatMoney(design.unitCost)} proposed. This is not a saving.`
  } else if (perUnit < 0) {
    difference = `This carton is ${formatMoney(Math.abs(perUnit))} cheaper per package. For ${quantity} packages, that is ${formatMoney(Math.abs(order))} less${pctText}. These are estimated prices, not a supplier quote.`
    reason = 'The selected board and conversion prices add up to less than your current cost. A lower price is not proof of equal protection.'
    shortValue = changePercent === null ? formatMoney(perUnit) : `${formatPct(Math.abs(changePercent))} lower`
    shortDetail = `${formatMoney(target)} today, ${formatMoney(design.unitCost)} proposed.`
  } else {
    difference = `Both prices are ${formatMoney(design.unitCost)} per package.`
    reason = 'The selected board adds up to the same price you entered.'
    shortValue = 'No cost change'
    shortDetail = `${formatMoney(design.unitCost)} per package.`
  }

  let manufacturing: string
  if (perUnit <= 0) {
    manufacturing = `The proposed carton already meets your ${formatMoney(target)} cost target.`
  } else if (proposal.maxConversionForTarget !== null && proposal.maxConversionForTarget < 0) {
    manufacturing = `The board alone costs ${formatMoney(proposal.boardCost + proposal.otherCost)}, above your ${formatMoney(target)} target, so reducing manufacturing cost alone cannot reach the target.`
  } else {
    manufacturing = `To reach ${formatMoney(target)}, the conversion charge would need to be at most ${formatMoney(proposal.maxConversionForTarget ?? 0)} per unit instead of ${formatMoney(design.conversionCost)}.`
  }

  let reduce: string
  let savingLine: string
  if (cheapest) {
    reduce = `Can we reduce the cost? Yes. ${cheapest.name} is the lowest-cost option that fits the required inside size. Its protection has not been tested.`
    savingLine = `${cheapest.name} could save ${formatMoney(Math.abs(cheapest.perUnitDifference ?? 0))} per package, ${formatMoney(Math.abs(cheapest.orderDifference ?? 0))} on ${quantity} packages, before protection testing.`
  } else {
    const lowest = lowestPriced && lowestPriced.id !== design.material.id
      ? ` The lowest priced option is ${lowestPriced.name} at ${formatMoney(lowestPriced.unitCost)}.`
      : ''
    reduce = `Can we reduce the cost? No lower-cost replacement has been established. Keeping the existing packaging is recommended unless other verified benefits justify a change.${lowest}`
    savingLine = 'No money saving is established on the current prices.'
  }

  return {
    target,
    existingUnit: target,
    proposedUnit: design.unitCost,
    perUnitDifference: perUnit,
    orderDifference: order,
    changePercent,
    headline,
    difference,
    reason,
    breakdown,
    manufacturing,
    reduce,
    savingLine,
    shortValue,
    shortDetail,
    options,
    cheapest,
    lowestPriced,
    furtherOptions: furtherOptionsList,
  }
}
