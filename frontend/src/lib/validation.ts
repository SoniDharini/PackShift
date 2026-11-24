import { isCorrugatedBoard } from './packMaterial.ts'
import type { Fragility, Mode, ParsedProject, ProductForm } from '../types/packaging.ts'
import { CATEGORIES } from '../types/packaging.ts'

export type FieldErrors = Partial<Record<keyof ProductForm | 'form', string>>

export type ParseResult = { ok: true; value: ParsedProject } | { ok: false; errors: FieldErrors }

const FRAGILITY: Fragility[] = ['low', 'medium', 'high']

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function readNumber(
  raw: string,
  label: string,
  min: number,
  max: number,
  options: { integer?: boolean; allowZero?: boolean } = {},
): { value: number } | { error: string } {
  const text = raw.trim()
  if (!text) return { error: `Enter ${label}.` }
  const pattern = options.integer ? /^\d+$/ : /^\d+(\.\d+)?$/
  if (!pattern.test(text)) return { error: `Enter ${label} as a plain number.` }
  const value = Number(text)
  const floor = options.allowZero ? 0 : 0
  if (!options.allowZero && value <= 0) return { error: `${capitalize(label)} must be greater than 0.` }
  if (options.allowZero && value < floor) return { error: `${capitalize(label)} cannot be negative.` }
  if (value < min || value > max) {
    return { error: `${capitalize(label)} must be between ${min} and ${max}.` }
  }
  return { value }
}

export function parseForm(form: ProductForm, mode: Mode): ParseResult {
  const errors: FieldErrors = {}
  const name = form.name.trim().replace(/\s+/g, ' ')
  if (!name) errors.name = 'Enter a product name.'
  else if (name.length > 80) errors.name = 'Keep the product name under 80 characters.'

  if (!CATEGORIES.includes(form.category as (typeof CATEGORIES)[number])) {
    errors.category = 'Choose a category.'
  }
  if (!FRAGILITY.includes(form.fragility)) errors.fragility = 'Choose a fragility level.'

  const length = readNumber(form.length, 'a length in mm', 1, 2500)
  const width = readNumber(form.width, 'a width in mm', 1, 2500)
  const height = readNumber(form.height, 'a height in mm', 1, 2500)
  const weight = readNumber(form.weight, 'a weight in grams', 0.1, 100000)
  const clearance = readNumber(form.clearance, 'clearance in mm', 0, 200, { allowZero: true })
  const quantity = readNumber(form.quantity, 'a quantity', 1, 100000, { integer: true })

  if ('error' in length) errors.length = length.error
  if ('error' in width) errors.width = width.error
  if ('error' in height) errors.height = height.error
  if ('error' in weight) errors.weight = weight.error
  if ('error' in clearance) errors.clearance = clearance.error
  if ('error' in quantity) errors.quantity = quantity.error

  let existing: ParsedProject['existing'] = null
  if (mode === 'redesign') {
    const side = form.existingBasis === 'internal' ? 'inside' : form.existingBasis === 'external' ? 'outside' : 'box'
    const existingLength = readNumber(form.existingLength, `the ${side} length in mm`, 1, 2500)
    const existingWidth = readNumber(form.existingWidth, `the ${side} width in mm`, 1, 2500)
    const existingHeight = readNumber(form.existingHeight, `the ${side} height in mm`, 1, 2500)
    const existingUnitCost = readNumber(form.existingUnitCost, 'the stated unit cost', 0, 100000, { allowZero: true })
    const material = form.existingMaterial.trim().replace(/\s+/g, ' ')
    if ('error' in existingLength) errors.existingLength = existingLength.error
    if ('error' in existingWidth) errors.existingWidth = existingWidth.error
    if ('error' in existingHeight) errors.existingHeight = existingHeight.error
    if ('error' in existingUnitCost) errors.existingUnitCost = existingUnitCost.error
    if (!material) errors.existingMaterial = 'Name the current material.'
    else if (material.length > 80) errors.existingMaterial = 'Keep the material name under 80 characters.'
    const basis = form.existingBasis
    const corrugated = isCorrugatedBoard(material)
    if (basis !== 'internal' && basis !== 'external') {
      errors.existingBasis = 'Choose Outside dimensions or Inside dimensions so the current box can be checked.'
    } else if (basis === 'external' && material && !corrugated) {
      errors.existingBasis = `PackShift can only work out the inside space from outside measurements for corrugated board. For ${material}, choose Inside dimensions and measure the space where the product sits.`
    }
    let thicknessMm: number | null = null
    if (basis === 'external' && corrugated && !form.existingThickness.trim()) {
      errors.existingThickness = 'Enter the wall thickness of your current box. It is needed to work out the inside space from the outside size.'
    } else if (corrugated && (basis === 'external' || basis === 'internal') && form.existingThickness.trim()) {
      const thickness = readNumber(form.existingThickness, 'a wall thickness in mm', 0.2, 15)
      if ('error' in thickness) errors.existingThickness = thickness.error
      else if (
        basis === 'external' &&
        !('error' in existingLength) &&
        !('error' in existingWidth) &&
        !('error' in existingHeight) &&
        2 * thickness.value >= Math.min(existingLength.value, existingWidth.value, existingHeight.value)
      ) {
        errors.existingThickness = 'Two walls of this thickness would leave no space inside. Check the thickness or the outside measurements.'
      } else thicknessMm = thickness.value
    }

    if (
      !('error' in existingLength) &&
      !('error' in existingWidth) &&
      !('error' in existingHeight) &&
      !('error' in existingUnitCost) &&
      !errors.existingBasis &&
      !errors.existingThickness &&
      material &&
      material.length <= 80
    ) {
      existing = {
        length: existingLength.value,
        width: existingWidth.value,
        height: existingHeight.value,
        material,
        unitCost: existingUnitCost.value,
        basis,
        thicknessMm,
      }
    }
  }

  if (
    errors.name ||
    errors.category ||
    errors.fragility ||
    errors.length ||
    errors.width ||
    errors.height ||
    errors.weight ||
    errors.clearance ||
    errors.quantity ||
    (mode === 'redesign' && !existing)
  ) {
    return { ok: false, errors }
  }

  if ('error' in length || 'error' in width || 'error' in height || 'error' in weight || 'error' in clearance || 'error' in quantity) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      mode,
      name,
      category: form.category,
      length: length.value,
      width: width.value,
      height: height.value,
      weight: weight.value,
      fragility: form.fragility,
      clearance: clearance.value,
      quantity: quantity.value,
      existing,
    },
  }
}
