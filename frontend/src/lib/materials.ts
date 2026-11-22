import type { MaterialOption } from '../types/packaging.ts'

export const DEFAULT_MATERIALS: MaterialOption[] = [
  {
    id: 'standard',
    name: 'Standard corrugated board',
    description: 'Single-wall kraft board for a regular slotted carton. A plain baseline for small goods.',
    texture: 'kraft',
    flute: 'C-flute nominal',
    thickness: 4,
    pricePerM2: 72,
    conversion: 16,
    insertName: null,
    insertCost: 0,
    compatibility: 'Useful when the clearance is only an air gap and the product is not highly fragile.',
    summary: 'Board only. No protective insert.',
  },
  {
    id: 'recycled',
    name: 'Recycled-content corrugated board',
    description: 'Single-wall board assumed to use recycled fibre and a slightly thicker sheet. Recycled content is not certified here.',
    texture: 'recycled',
    flute: 'C-flute nominal',
    thickness: 5,
    pricePerM2: 66,
    conversion: 16,
    insertName: null,
    insertCost: 0,
    compatibility: 'Same carton style as the standard board. The thicker sheet is an assumption you can edit.',
    summary: 'Same structure, thicker assumed sheet, lower board price.',
  },
  {
    id: 'insert',
    name: 'Corrugated board + protective insert',
    description: 'The standard RSC plus a molded-fiber insert assumed to sit in the clearance around the product.',
    texture: 'light',
    flute: 'C-flute nominal',
    thickness: 4,
    pricePerM2: 72,
    conversion: 16,
    insertName: 'Molded fiber tray',
    insertCost: 28,
    compatibility: 'Relevant for fragile goods. The insert price is a placeholder, not a tested cushion.',
    summary: 'Board plus one molded fiber insert inside the same clearance.',
  },
]

export function cloneMaterials() {
  return DEFAULT_MATERIALS.map((material) => ({ ...material }))
}
