import { cents, formatArea, formatLitres, formatMm, formatMoney, formatNumber, formatPct, formatReduction } from './format.ts'
import type { FormulaLine, MaterialOption, PackagingDesign, ParsedProject, Size3 } from '../types/packaging.ts'

export const GLUE_FLAP_MM = 35
export const STRUCTURE_NAME = 'Regular slotted carton · FEFCO 0201'

function volumeOf(size: Size3) {
  return size.l * size.w * size.h
}

function sheetFromPanels(length: number, width: number, height: number) {
  const blankLength = GLUE_FLAP_MM + 2 * length + 2 * width
  const blankWidth = height + width
  return {
    blankLength,
    blankWidth,
    areaM2: (blankLength * blankWidth) / 1_000_000,
  }
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

/**
 * Deterministic RSC estimator.
 * The future `POST /api/design` response should use this same contract.
 */
export function calculateDesign(project: ParsedProject, material: MaterialOption): PackagingDesign {
  const internal: Size3 = {
    l: project.length + 2 * project.clearance,
    w: project.width + 2 * project.clearance,
    h: project.height + 2 * project.clearance,
  }
  const thickness = material.thickness
  const external: Size3 = {
    l: internal.l + 2 * thickness,
    w: internal.w + 2 * thickness,
    h: internal.h + 2 * thickness,
  }
  const glueFlap = GLUE_FLAP_MM
  const flapDepth = internal.w / 2
  const slotWidth = round1(Math.min(Math.max(8, thickness * 2), Math.min(internal.l, internal.w) / 3))
  const slotDepth = round1(Math.min(12, internal.h / 5))
  const blank = sheetFromPanels(internal.l, internal.w, internal.h)
  const product: Size3 = { l: project.length, w: project.width, h: project.height }
  const productVolume = volumeOf(product)
  const internalVolume = volumeOf(internal)
  const externalVolume = volumeOf(external)
  const emptySpacePct = internalVolume > 0 ? ((internalVolume - productVolume) / internalVolume) * 100 : 0

  const boardCost = blank.areaM2 * material.pricePerM2
  const conversionCost = material.conversion
  const insertCost = material.insertName ? material.insertCost : 0
  const unitCost = cents(boardCost + conversionCost + insertCost)
  const orderCost = cents(unitCost * project.quantity)

  let existing: PackagingDesign['existing'] = null
  if (project.existing) {
    const size = {
      l: project.existing.length,
      w: project.existing.width,
      h: project.existing.height,
    }
    const existingVolume = volumeOf(size)
    const existingSheet = sheetFromPanels(size.l, size.w, size.h)
    const existingOrder = cents(project.existing.unitCost * project.quantity)
    existing = {
      size,
      volume: existingVolume,
      emptySpacePct: existingVolume > 0 ? ((existingVolume - productVolume) / existingVolume) * 100 : 0,
      unitCost: project.existing.unitCost,
      materialLabel: project.existing.material,
      basis: project.existing.basis,
      thicknessMm: project.existing.thicknessMm,
      estimatedBlankAreaM2: existingSheet.areaM2,
      blankLength: existingSheet.blankLength,
      blankWidth: existingSheet.blankWidth,
      orderCost: existingOrder,
    }
  }

  const volumeReductionPct = existing ? ((existing.volume - externalVolume) / existing.volume) * 100 : null
  const sheetReductionPct = existing ? ((existing.estimatedBlankAreaM2 - blank.areaM2) / existing.estimatedBlankAreaM2) * 100 : null
  const unitCostDelta = existing ? cents(unitCost - existing.unitCost) : null
  const orderCostDelta = existing ? cents(orderCost - existing.orderCost) : null

  const formulae: FormulaLine[] = [
    {
      label: 'Internal length',
      expression: `${formatNumber(project.length)} + 2 × ${formatNumber(project.clearance)} = ${formatMm(internal.l)}`,
    },
    {
      label: 'Internal width',
      expression: `${formatNumber(project.width)} + 2 × ${formatNumber(project.clearance)} = ${formatMm(internal.w)}`,
    },
    {
      label: 'Internal height',
      expression: `${formatNumber(project.height)} + 2 × ${formatNumber(project.clearance)} = ${formatMm(internal.h)}`,
    },
    {
      label: 'Outer length',
      expression: `${formatNumber(internal.l)} + 2 × ${formatNumber(thickness)} = ${formatMm(external.l)}`,
    },
    {
      label: 'Outer width',
      expression: `${formatNumber(internal.w)} + 2 × ${formatNumber(thickness)} = ${formatMm(external.w)}`,
    },
    {
      label: 'Outer height',
      expression: `${formatNumber(internal.h)} + 2 × ${formatNumber(thickness)} = ${formatMm(external.h)}`,
    },
    {
      label: 'Blank length',
      expression: `${formatNumber(glueFlap)} glue + 2 × ${formatNumber(internal.l)} + 2 × ${formatNumber(internal.w)} = ${formatMm(blank.blankLength)}`,
    },
    {
      label: 'Blank width',
      expression: `${formatNumber(internal.h)} body + ${formatNumber(internal.w)} flaps = ${formatMm(blank.blankWidth)}`,
    },
    {
      label: 'Sheet area',
      expression: `${formatNumber(blank.blankLength)} × ${formatNumber(blank.blankWidth)} mm = ${formatArea(blank.areaM2)}`,
    },
    {
      label: 'Unit cost',
      expression: `${formatArea(blank.areaM2)} × ${formatMoney(material.pricePerM2)} + ${formatMoney(conversionCost)} + ${formatMoney(insertCost)} = ${formatMoney(unitCost)} after paise rounding`,
    },
  ]

  if (existing && volumeReductionPct !== null && sheetReductionPct !== null) {
    formulae.push({
      label: 'Volume change',
      expression:
        existing.basis === 'external'
          ? `(${formatLitres(existing.volume)} − ${formatLitres(externalVolume)}) ÷ ${formatLitres(existing.volume)} = ${formatReduction(volumeReductionPct)}`
          : 'Not compared. The stated size is not confirmed as the outside size of the current box.',
    })
    formulae.push({
      label: 'Sheet change',
      expression: `(${formatArea(existing.estimatedBlankAreaM2)} − ${formatArea(blank.areaM2)}) ÷ ${formatArea(existing.estimatedBlankAreaM2)} = ${formatReduction(sheetReductionPct)}`,
    })
  }

  const notes: string[] = [
    'Conceptual RSC study. A converter still has to confirm scores, slots, flap relief, and the final sheet.',
  ]
  if (project.fragility === 'high' && !material.insertName) {
    notes.push('High fragility is recorded, but this configuration has no insert. The clearance is empty space, not a tested cushion.')
  } else if (project.fragility === 'high' && material.insertName) {
    notes.push(`${material.insertName} is priced in. That does not confirm drop protection or a finished pack test.`)
  } else if (project.fragility === 'medium') {
    notes.push('Medium fragility is recorded for the specification. It does not add material by itself.')
  } else {
    notes.push('Low fragility is recorded. The clearance is still only a dimensional gap.')
  }
  if (project.weight >= 5000) {
    notes.push('At this weight, flute and edge-crush rating need a packaging engineer. They are not selected here.')
  } else {
    notes.push('Weight is recorded and does not change the blank. Board grade is not checked against it.')
  }
  if (emptySpacePct > 55) {
    notes.push(
      `${formatPct(emptySpacePct)} of the inner box is unused. Clearance is added on every face, so it increases volume faster than the product.`,
    )
  }
  if (existing && (project.length > existing.size.l || project.width > existing.size.w || project.height > existing.size.h)) {
    notes.push('The product is larger than the stated pack on at least one axis.')
  }
  if (volumeReductionPct !== null && volumeReductionPct < 0) {
    notes.push('The proposed outer box is larger than the stated pack, because the clearance does not fit inside it.')
  }

  const assumptions = [
    'Internal size adds the clearance to both ends of each product dimension.',
    `Outer size adds ${formatMm(thickness)} of board on every face. That is a planning allowance, not a factory score allowance.`,
    `The blank is an RSC with a ${formatMm(glueFlap)} glue flap, two length panels, two width panels, and flaps of half the internal width.`,
    'Sheet area is blank length times blank width. The drawn slots sit inside that sheet.',
    `Board price ${formatMoney(material.pricePerM2)} per m², conversion ${formatMoney(material.conversion)} per unit, and insert ${formatMoney(insertCost)} are assumptions, not quotes.`,
    existing
      ? 'Existing volume uses the stated size as entered. Existing sheet area runs those dimensions through the same RSC formula. That sheet figure is not a blank for plastic or other non-carton packs, and the volume-change line is an outer-volume reduction only when the stated size is the outer size.'
      : 'No existing pack was entered, so there is no volume or cost comparison.',
    'Strength, transit protection, recycled-content claims, and carbon figures are outside this calculation.',
  ]

  return {
    mode: project.mode,
    productName: project.name,
    category: project.category,
    fragility: project.fragility,
    weight: project.weight,
    clearance: project.clearance,
    quantity: project.quantity,
    product,
    internal,
    external,
    thickness,
    glueFlap,
    flapDepth,
    slotWidth,
    slotDepth,
    blankLength: blank.blankLength,
    blankWidth: blank.blankWidth,
    blankAreaM2: blank.areaM2,
    productVolume,
    internalVolume,
    externalVolume,
    emptySpacePct,
    existing,
    volumeReductionPct,
    sheetReductionPct,
    material,
    boardCost,
    conversionCost,
    insertCost,
    unitCost,
    orderCost,
    unitCostDelta,
    orderCostDelta,
    structure: STRUCTURE_NAME,
    notes,
    assumptions,
    formulae,
  }
}
