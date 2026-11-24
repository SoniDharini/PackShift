import { calculateDesign } from './calculations.ts'
import { DEFAULT_MATERIALS } from './materials.ts'
import type { Mode, ProductForm } from '../types/packaging.ts'
import { parseForm } from './validation.ts'

export const EXAMPLE_MODE: Mode = 'redesign'

export const EXAMPLE_FORM: ProductForm = {
  name: 'Ceramic Mug',
  category: 'Drinkware',
  length: '120',
  width: '100',
  height: '100',
  weight: '340',
  fragility: 'high',
  clearance: '20',
  quantity: '240',
  existingLength: '250',
  existingWidth: '220',
  existingHeight: '180',
  existingBasis: 'external',
  existingThickness: '4',
  existingMaterial: 'Single-wall corrugated',
  existingUnitCost: '95',
}

export function getExampleDesign() {
  const parsed = parseForm(EXAMPLE_FORM, EXAMPLE_MODE)
  if (!parsed.ok) throw new Error('The ceramic mug example is invalid.')
  return calculateDesign(parsed.value, DEFAULT_MATERIALS[0])
}
