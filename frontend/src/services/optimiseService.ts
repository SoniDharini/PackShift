import type { PackagingDesign } from '../types/packaging.ts'

export type OptimisePreference = 'balanced' | 'lowest_cost' | 'lowest_material'

export interface OptimiseCandidate {
  id: string
  board_name: string
  flute: string
  thickness_mm: number
  geometry_label: string
  geometry_id: string
  orientation: string
  feasibility: 'eligible' | 'needs_validation' | 'rejected'
  feasibility_reasons: string[]
  internal_dimensions_mm: { length: number; width: number; height: number }
  outer_dimensions_mm: { length: number; width: number; height: number }
  outer_dimension_note: string
  blank: {
    length_mm: number
    width_mm: number
    area_m2: number
    flap_depth_mm: number
    joint_mm: number
    score_allowance_total_mm: number
    flap_relief_mm: number
    scope: string
  }
  volumes: {
    internal_litres: number
    outer_litres_display: number
    unused_internal_percent: number
  }
  mass_g: number | null
  mass_status: string
  cost: {
    status: string
    message: string | null
    unit_cost_inr: number | null
    order_cost_inr: number | null
    board_cost_inr: number | null
    conversion_cost_inr: number | null
    cutting_cost_inr: number | null
    printing_cost_inr: number | null
    joining_cost_inr: number | null
    cushioning_cost_inr: number | null
    difference_per_unit_inr: number | null
    order_difference_inr: number | null
    change_percent: number | null
    direction: string
    price_basis: string
    printing_note: string
  }
  on_pareto_front: boolean
  preference_focus: boolean
  dominated: boolean
  dominance_note: string | null
  data_gaps: string[]
  environmental_data: string
  protection: { safe_to_ship: boolean; clearance_meaning: string }
}

export interface OptimiseResult {
  status: string
  preference: OptimisePreference
  decision: { id: string; title: string; summary: string; safe_to_ship: boolean }
  objective_note: string
  current_generated: OptimiseCandidate
  existing_packaging: {
    material_name: string
    dimensions_mm: { length: number; width: number; height: number }
    volume_litres: number
    cost_per_unit_inr: number | null
    order_cost_inr: number | null
  }
  comparison: {
    existing_order_cost_inr: number | null
    proposed_order_cost_inr: number | null
    order_cost_difference_inr: number | null
    change_percent: number | null
    direction: string
    basis: string
  }
  candidates: OptimiseCandidate[]
  warnings: string[]
  assumptions: string[]
  evaluation?: PackEvaluation
}

export interface PackEvaluation {
  dimensional: {
    fit: string
    code: string
    summary: string
    required_internal_mm: { length: number; width: number; height: number }
    current_internal_mm: { length: number; width: number; height: number } | null
    available_clearance_mm: { length: number; width: number; height: number } | null
    required_clearance_mm: { length: number; width: number; height: number }
    internal_source: string
    shortfalls?: { axis: string; current_mm: number; required_mm: number; shortage_mm: number; basis: string }[]
  }
  advisor?: {
    fit: string
    recommendation: string
    needs_change: string
    why: string
    next: string
    size_line: string
    outer_volume_reduction_percent: number | null
    shortfalls: { axis: string; current_mm: number; required_mm: number; shortage_mm: number; basis: string }[]
  }
  material: { code: string; summary: string; strength_evidence: boolean; keeps_internal_dimensions: boolean }
  manufacturing: {
    code: string
    summary: string
    finished_blank_m2: number
    purchased_sheet_m2: number | null
    scrap_m2: number | null
    supplier_unit_quote_inr: number | null
    finished_dimensions_change: boolean
  }
  sustainability: {
    code: string
    summary: string
    message: string
    current_material: string
    current_mass_g: number | null
    proposed_mass_g: number | null
    scrap_mass_g: number | null
    carbon_kg: number | null
  }
  protection: { status: string; safe_to_ship: boolean; summary: string }
  primary: { id: string; title: string; summary: string; safe_to_ship: boolean }
  codes: string[]
}

export function optimiseRequest(design: PackagingDesign, preference: OptimisePreference) {
  if (!design.existing) return null
  return {
    product: {
      name: design.productName,
      category: design.category,
      dimensions_mm: { length: design.product.l, width: design.product.w, height: design.product.h },
      weight_g: design.weight,
      fragility: design.fragility,
      clearance_mm: { length: design.clearance, width: design.clearance, height: design.clearance },
      orientation_constraint: 'declared_only' as const,
    },
    current_packaging: {
      dimensions_mm: { length: design.existing.size.l, width: design.existing.size.w, height: design.existing.size.h },
      dimension_type: design.existing.basis,
      board_thickness_mm: design.existing.thicknessMm,
      material_name: design.existing.materialLabel,
      cost_per_unit_inr: design.existing.unitCost,
      role: 'current',
    },
    quantity: design.quantity,
    preference,
  }
}

/** Empty in local dev, where Vite proxies `/api`. Set to the Render API origin in production. */
export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? ''
  return `${base}${path}`
}

export async function fetchOptimisation(design: PackagingDesign, preference: OptimisePreference): Promise<OptimiseResult> {
  const body = optimiseRequest(design, preference)
  if (!body) throw new Error('Enter the current packaging before running optimisation.')
  const response = await fetch(apiUrl('/api/optimise'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as OptimiseResult & { status?: string; errors?: { message: string }[] }
  if (!response.ok) {
    const message = payload.errors?.map((item) => item.message).join(' ') || 'The optimisation service rejected this specification.'
    throw new Error(message)
  }
  return payload
}
