import { DEFAULT_MATERIALS } from './materials.ts'
import type { MaterialOption } from '../types/packaging.ts'

/** Thickness of a named material configuration, taken from the current (editable) material settings. */
export function catalogueThickness(label: string, materials: readonly MaterialOption[] = DEFAULT_MATERIALS) {
  const name = label.trim().replace(/\s+/g, ' ').toLowerCase()
  const match = materials.find((material) => material.name.toLowerCase() === name)
  return match ? { name: match.name, thickness: match.thickness } : null
}

export function isCorrugatedBoard(label: string) {
  const name = label.toLowerCase()
  if (/\b(pet|plastic|polymer|hdpe|pvc|bottle|pouch)\b/.test(name)) return false
  return /corrugat|cardboard|kraft|flute|rsc|paperboard|carton/.test(name)
}
