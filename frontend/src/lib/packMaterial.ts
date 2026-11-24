import { DEFAULT_MATERIALS } from './materials.ts'

export function catalogueThickness(label: string) {
  const name = label.trim().replace(/\s+/g, ' ').toLowerCase()
  const match = DEFAULT_MATERIALS.find((material) => material.name.toLowerCase() === name)
  return match ? { name: match.name, thickness: match.thickness } : null
}

export function isCorrugatedBoard(label: string) {
  const name = label.toLowerCase()
  if (/\b(pet|plastic|polymer|hdpe|pvc|bottle|pouch)\b/.test(name)) return false
  return /corrugat|cardboard|kraft|flute|rsc|paperboard|carton/.test(name)
}
