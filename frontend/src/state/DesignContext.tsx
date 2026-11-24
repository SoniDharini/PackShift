import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { calculateDesign } from '../lib/calculations.ts'
import { EXAMPLE_FORM, EXAMPLE_MODE } from '../lib/example.ts'
import { cloneMaterials } from '../lib/materials.ts'
import { generatedCartonForm, parseForm, type FieldErrors } from '../lib/validation.ts'
import { generateDesign } from '../services/designService.ts'
import { fetchOptimisation, optimiseRequest, type OptimisePreference, type OptimiseResult } from '../services/optimiseService.ts'
import type { MaterialId, MaterialOption, Mode, PackagingDesign, ProductForm } from '../types/packaging.ts'

type Status = 'ready' | 'loading' | 'error'
type SharedKey = 'quantity' | 'existingUnitCost' | 'existingMaterial'

interface DesignContextValue {
  mode: Mode
  form: ProductForm
  materials: MaterialOption[]
  selectedMaterialId: MaterialId
  status: Status
  showErrors: boolean
  errors: FieldErrors
  formError: string | null
  generatedAt: string
  isDirty: boolean
  liveDesign: PackagingDesign | null
  committedDesign: PackagingDesign | null
  comparisons: PackagingDesign[]
  optimisePreference: OptimisePreference
  optimiseResult: OptimiseResult | null
  optimiseError: string | null
  optimiseLoading: boolean
  setOptimisePreference: (preference: OptimisePreference) => void
  setMode: (mode: Mode) => void
  setField: (key: keyof ProductForm, value: string) => void
  selectMaterial: (id: MaterialId) => void
  updateMaterial: (id: MaterialId, patch: Partial<Pick<MaterialOption, 'thickness' | 'pricePerM2' | 'conversion' | 'insertCost'>>) => void
  updateCommittedFields: (partial: Partial<Pick<ProductForm, SharedKey>>) => void
  resetMaterials: () => void
  resetExample: () => void
  applyGeneratedCarton: () => void
  generate: () => Promise<boolean>
}

const DesignContext = createContext<DesignContextValue | null>(null)

function formKey(form: ProductForm, mode: Mode) {
  return JSON.stringify({ form, mode })
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function DesignProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(EXAMPLE_MODE)
  const [form, setForm] = useState<ProductForm>({ ...EXAMPLE_FORM })
  const [materials, setMaterials] = useState<MaterialOption[]>(cloneMaterials)
  const [selectedMaterialId, setSelectedMaterialId] = useState<MaterialId>('standard')
  const [committedForm, setCommittedForm] = useState<ProductForm>({ ...EXAMPLE_FORM })
  const [committedMode, setCommittedMode] = useState<Mode>(EXAMPLE_MODE)
  const [status, setStatus] = useState<Status>('ready')
  const [showErrors, setShowErrors] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString())
  const [optimisePreference, setOptimisePreference] = useState<OptimisePreference>('balanced')
  const [optimiseResult, setOptimiseResult] = useState<OptimiseResult | null>(null)
  const [optimiseError, setOptimiseError] = useState<string | null>(null)
  const [optimiseLoading, setOptimiseLoading] = useState(false)
  const requestId = useRef(0)
  const committedRef = useRef(committedForm)
  const committedModeRef = useRef(committedMode)
  committedRef.current = committedForm
  committedModeRef.current = committedMode

  const selectedMaterial = materials.find((material) => material.id === selectedMaterialId) ?? materials[0]

  const liveDesign = useMemo(() => {
    const parsed = parseForm(form, mode)
    if (!parsed.ok) return null
    return calculateDesign(parsed.value, selectedMaterial)
  }, [form, mode, selectedMaterial])

  const committedDesign = useMemo(() => {
    const parsed = parseForm(committedForm, committedMode)
    if (!parsed.ok) return null
    return calculateDesign(parsed.value, selectedMaterial)
  }, [committedForm, committedMode, selectedMaterial])

  const comparisons = useMemo(() => {
    const parsed = parseForm(committedForm, committedMode)
    if (!parsed.ok) return []
    return materials.map((material) => calculateDesign(parsed.value, material))
  }, [committedForm, committedMode, materials])

  const errors = useMemo(() => {
    if (!showErrors) return {}
    const parsed = parseForm(form, mode)
    return parsed.ok ? {} : parsed.errors
  }, [form, mode, showErrors])

  const setField = useCallback((key: keyof ProductForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }) as ProductForm)
    if (key === 'quantity' || key === 'existingUnitCost' || key === 'existingMaterial') {
      const next = { ...committedRef.current, [key]: value }
      if (parseForm(next, committedModeRef.current).ok) setCommittedForm(next)
    }
  }, [])

  const updateMaterial = useCallback(
    (id: MaterialId, patch: Partial<Pick<MaterialOption, 'thickness' | 'pricePerM2' | 'conversion' | 'insertCost'>>) => {
      setMaterials((current) =>
        current.map((material) => {
          if (material.id !== id) return material
          return {
            ...material,
            thickness: patch.thickness === undefined ? material.thickness : clamp(patch.thickness, 1, 15),
            pricePerM2: patch.pricePerM2 === undefined ? material.pricePerM2 : clamp(patch.pricePerM2, 0, 10000),
            conversion: patch.conversion === undefined ? material.conversion : clamp(patch.conversion, 0, 10000),
            insertCost: patch.insertCost === undefined ? material.insertCost : clamp(patch.insertCost, 0, 10000),
          }
        }),
      )
    },
    [],
  )

  const updateCommittedFields = useCallback((partial: Partial<Pick<ProductForm, SharedKey>>) => {
    const current = committedRef.current
    const next = { ...current, ...partial }
    if (!parseForm(next, committedModeRef.current).ok) return
    setCommittedForm(next)
    setForm((draft) => {
      const merged = { ...draft }
      let changed = false
      if (partial.quantity !== undefined && draft.quantity === current.quantity && draft.quantity !== partial.quantity) {
        merged.quantity = partial.quantity
        changed = true
      }
      if (
        partial.existingUnitCost !== undefined &&
        draft.existingUnitCost === current.existingUnitCost &&
        draft.existingUnitCost !== partial.existingUnitCost
      ) {
        merged.existingUnitCost = partial.existingUnitCost
        changed = true
      }
      if (
        partial.existingMaterial !== undefined &&
        draft.existingMaterial === current.existingMaterial &&
        draft.existingMaterial !== partial.existingMaterial
      ) {
        merged.existingMaterial = partial.existingMaterial
        changed = true
      }
      return changed ? merged : draft
    })
  }, [])

  const resetMaterials = useCallback(() => {
    const next = cloneMaterials()
    setMaterials(next)
    setSelectedMaterialId('standard')
  }, [])

  const resetExample = useCallback(() => {
    requestId.current += 1
    setMode(EXAMPLE_MODE)
    setForm({ ...EXAMPLE_FORM })
    setMaterials(cloneMaterials())
    setSelectedMaterialId('standard')
    setCommittedForm({ ...EXAMPLE_FORM })
    setCommittedMode(EXAMPLE_MODE)
    setShowErrors(false)
    setFormError(null)
    setStatus('ready')
    setGeneratedAt(new Date().toISOString())
  }, [])

  const generate = useCallback(async () => {
    const parsed = parseForm(form, mode)
    setShowErrors(true)
    if (!parsed.ok) {
      setStatus('error')
      setFormError(null)
      return false
    }
    const id = requestId.current + 1
    requestId.current = id
    setStatus('loading')
    setFormError(null)
    try {
      await generateDesign(parsed.value, selectedMaterial)
      if (id !== requestId.current) return false
      setCommittedForm({ ...form })
      setCommittedMode(mode)
      setGeneratedAt(new Date().toISOString())
      setStatus('ready')
      return true
    } catch {
      if (id !== requestId.current) return false
      setStatus('error')
      setFormError('The design could not be calculated. Check the measurements and try again.')
      return false
    }
  }, [form, mode, selectedMaterial])

  const optimiseKey = useMemo(() => {
    if (!committedDesign) return ''
    const body = optimiseRequest(committedDesign, optimisePreference)
    return body ? JSON.stringify(body) : ''
  }, [committedDesign, optimisePreference])
  const geometryKey = useMemo(() => {
    if (!optimiseKey) return ''
    const body = JSON.parse(optimiseKey) as {
      quantity?: number
      preference?: string
      current_packaging?: { cost_per_unit_inr?: number }
    }
    const pack = body.current_packaging
    return JSON.stringify({
      product: (body as { product?: unknown }).product,
      current_packaging: pack
        ? { dimensions_mm: (pack as { dimensions_mm?: unknown }).dimensions_mm, dimension_type: (pack as { dimension_type?: unknown }).dimension_type, board_thickness_mm: (pack as { board_thickness_mm?: unknown }).board_thickness_mm, material_name: (pack as { material_name?: unknown }).material_name }
        : null,
    })
  }, [optimiseKey])
  const geometryRef = useRef('')
  const optimiseRequestId = useRef(0)
  const committedDesignRef = useRef(committedDesign)
  committedDesignRef.current = committedDesign

  const applyGeneratedCarton = useCallback(() => {
    const design = committedDesignRef.current
    if (!design) return
    setMode('redesign')
    setForm((current) => generatedCartonForm(committedRef.current, design, current.existingUnitCost))
  }, [])

  useEffect(() => {
    const design = committedDesignRef.current
    if (!optimiseKey || !design) {
      geometryRef.current = ''
      setOptimiseResult(null)
      setOptimiseError(null)
      setOptimiseLoading(false)
      return
    }
    if (geometryRef.current !== geometryKey) {
      geometryRef.current = geometryKey
      setOptimiseResult(null)
    }
    const id = optimiseRequestId.current + 1
    optimiseRequestId.current = id
    setOptimiseLoading(true)
    setOptimiseError(null)
    fetchOptimisation(design, optimisePreference)
      .then((body) => {
        if (id !== optimiseRequestId.current) return
        setOptimiseResult(body)
        setOptimiseError(null)
      })
      .catch((caught: unknown) => {
        if (id !== optimiseRequestId.current) return
        setOptimiseResult(null)
        setOptimiseError(caught instanceof Error ? caught.message : 'The optimisation service is unavailable.')
      })
      .finally(() => {
        if (id === optimiseRequestId.current) setOptimiseLoading(false)
      })
  }, [optimiseKey, geometryKey, optimisePreference])

  const value = useMemo<DesignContextValue>(
    () => ({
      mode,
      form,
      materials,
      selectedMaterialId,
      status,
      showErrors,
      errors,
      formError,
      generatedAt,
      isDirty: formKey(form, mode) !== formKey(committedForm, committedMode),
      liveDesign,
      committedDesign,
      comparisons,
      optimisePreference,
      optimiseResult,
      optimiseError,
      optimiseLoading,
      setOptimisePreference,
      setMode,
      setField,
      selectMaterial: setSelectedMaterialId,
      updateMaterial,
      updateCommittedFields,
      resetMaterials,
      resetExample,
      applyGeneratedCarton,
      generate,
    }),
    [
      mode,
      form,
      materials,
      selectedMaterialId,
      status,
      showErrors,
      errors,
      formError,
      generatedAt,
      committedForm,
      committedMode,
      liveDesign,
      committedDesign,
      comparisons,
      optimisePreference,
      optimiseResult,
      optimiseError,
      optimiseLoading,
      setField,
      updateMaterial,
      updateCommittedFields,
      resetMaterials,
      resetExample,
      applyGeneratedCarton,
      generate,
    ],
  )

  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>
}

export function useDesign() {
  const value = useContext(DesignContext)
  if (!value) throw new Error('useDesign must be used within DesignProvider')
  return value
}
