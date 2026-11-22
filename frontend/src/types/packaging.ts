export type Mode = 'create' | 'redesign'
export type Fragility = 'low' | 'medium' | 'high'
export type MaterialId = 'standard' | 'recycled' | 'insert'
export type TextureKind = 'kraft' | 'recycled' | 'light'

export const CATEGORIES = ['Drinkware', 'Electronics', 'Cosmetics', 'Food', 'Apparel', 'General'] as const

export interface Size3 {
  l: number
  w: number
  h: number
}

export interface MaterialOption {
  id: MaterialId
  name: string
  description: string
  texture: TextureKind
  flute: string
  thickness: number
  pricePerM2: number
  conversion: number
  insertName: string | null
  insertCost: number
  compatibility: string
  summary: string
}

export interface ProductForm {
  name: string
  category: string
  length: string
  width: string
  height: string
  weight: string
  fragility: Fragility
  clearance: string
  quantity: string
  existingLength: string
  existingWidth: string
  existingHeight: string
  existingMaterial: string
  existingUnitCost: string
}

export interface ParsedProject {
  mode: Mode
  name: string
  category: string
  length: number
  width: number
  height: number
  weight: number
  fragility: Fragility
  clearance: number
  quantity: number
  existing: {
    length: number
    width: number
    height: number
    material: string
    unitCost: number
  } | null
}

export interface FormulaLine {
  label: string
  expression: string
}

export interface ExistingResult {
  size: Size3
  volume: number
  emptySpacePct: number
  unitCost: number
  materialLabel: string
  estimatedBlankAreaM2: number
  blankLength: number
  blankWidth: number
  orderCost: number
}

export interface PackagingDesign {
  mode: Mode
  productName: string
  category: string
  fragility: Fragility
  weight: number
  clearance: number
  quantity: number
  product: Size3
  internal: Size3
  external: Size3
  thickness: number
  glueFlap: number
  flapDepth: number
  slotWidth: number
  slotDepth: number
  blankLength: number
  blankWidth: number
  blankAreaM2: number
  productVolume: number
  internalVolume: number
  externalVolume: number
  emptySpacePct: number
  existing: ExistingResult | null
  volumeReductionPct: number | null
  sheetReductionPct: number | null
  material: MaterialOption
  boardCost: number
  conversionCost: number
  insertCost: number
  unitCost: number
  orderCost: number
  unitCostDelta: number | null
  orderCostDelta: number | null
  structure: string
  notes: string[]
  assumptions: string[]
  formulae: FormulaLine[]
}
