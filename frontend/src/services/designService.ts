import { calculateDesign } from '../lib/calculations.ts'
import type { MaterialOption, PackagingDesign, ParsedProject } from '../types/packaging.ts'

export const DESIGN_ENDPOINT = '/api/design'
export const COMPARE_ENDPOINT = '/api/compare'

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/**
 * Stand-in for the FastAPI service.
 * Replace the body of `generateDesign` with `POST /api/design`.
 * A comparison endpoint can live at `POST /api/compare` and return one design per material.
 * Until then, both paths use the local calculator so the studio and the future API share one contract.
 */
export async function generateDesign(project: ParsedProject, material: MaterialOption): Promise<PackagingDesign> {
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  await wait(reduced ? 40 : 680)
  return calculateDesign(project, material)
}
