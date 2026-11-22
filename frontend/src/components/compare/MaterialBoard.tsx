import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatArea, formatDims, formatMoney, formatMm } from '../../lib/format.ts'
import { cn } from '../../lib/cn.ts'
import { useDesign } from '../../state/DesignContext.tsx'
import type { MaterialId, MaterialOption, PackagingDesign } from '../../types/packaging.ts'
import { Button } from '../ui/Button.tsx'

const textures: Record<MaterialOption['texture'], string> = {
  kraft: 'repeating-linear-gradient(90deg, #C8A56E 0 2px, #E7CFA4 2px 7px)',
  recycled: 'repeating-linear-gradient(90deg, #A89868 0 2px, #D5C396 2px 7px)',
  light: 'repeating-linear-gradient(90deg, #D8C093 0 2px, #F3E6C8 2px 7px)',
}

function NumberAssumption({
  label,
  value,
  suffix,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  suffix: string
  min: number
  max: number
  onChange: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])

  return (
    <label className="block">
      <span className="text-[11px] font-medium text-secondary">{label}</span>
      <span className="mt-1 flex h-9 items-center gap-2 rounded-lg border border-line bg-cream/60 px-2 focus-within:border-emerald-deep">
        <input
          value={text}
          inputMode="decimal"
          aria-label={label}
          className="w-full bg-transparent text-sm tabular-nums outline-none"
          onFocus={() => {
            focused.current = true
          }}
          onBlur={() => {
            focused.current = false
            const next = Number(text)
            const safe = Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : min
            onChange(safe)
            setText(String(safe))
          }}
          onChange={(event) => {
            const next = event.target.value
            if (!/^\d*\.?\d{0,2}$/.test(next)) return
            setText(next)
            if (next === '' || next === '.') return
            const parsed = Number(next)
            if (parsed >= min && parsed <= max) onChange(parsed)
          }}
        />
        <span className="shrink-0 text-[11px] text-secondary">{suffix}</span>
      </span>
    </label>
  )
}

export function MaterialBoard({ designs }: { designs: PackagingDesign[] }) {
  const { selectedMaterialId, selectMaterial, updateMaterial, resetMaterials } = useDesign()
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Material configurations</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
            Sheet area stays with the internal panels. Thickness changes the outer box. Prices are assumptions, not quotes.
          </p>
        </div>
        <button type="button" onClick={resetMaterials} className="text-sm font-semibold text-emerald-deep">
          Reset material assumptions
        </button>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {designs.map((design, index) => {
          const material = design.material
          const selected = material.id === selectedMaterialId
          return (
            <article
              key={material.id}
              className={cn(
                'rise flex flex-col rounded-2xl border bg-white p-4 shadow-card',
                selected ? 'border-emerald ring-2 ring-emerald/25' : 'border-line',
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="h-16 rounded-xl border border-line" style={{ backgroundImage: textures[material.texture] }} />
              <h3 className="mt-4 font-display text-lg font-semibold">{material.name}</h3>
              <p className="mt-1 text-sm leading-6 text-secondary">{material.description}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-secondary">Sheet</dt>
                  <dd className="font-medium tabular-nums">{formatArea(design.blankAreaM2)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-secondary">Outer</dt>
                  <dd className="text-right font-medium tabular-nums">{formatDims(design.external)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-secondary">Cushioning</dt>
                  <dd className="text-right font-medium">{material.insertName ?? `${formatMm(design.clearance)} air gap`}</dd>
                </div>
              </dl>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <NumberAssumption
                  label="Board price"
                  suffix="₹ / m²"
                  min={0}
                  max={10000}
                  value={material.pricePerM2}
                  onChange={(value) => updateMaterial(material.id, { pricePerM2: value })}
                />
                <NumberAssumption
                  label="Conversion"
                  suffix="₹ / unit"
                  min={0}
                  max={10000}
                  value={material.conversion}
                  onChange={(value) => updateMaterial(material.id, { conversion: value })}
                />
                <NumberAssumption
                  label="Thickness"
                  suffix="mm"
                  min={1}
                  max={15}
                  value={material.thickness}
                  onChange={(value) => updateMaterial(material.id, { thickness: value })}
                />
                {material.insertName ? (
                  <NumberAssumption
                    label="Insert"
                    suffix="₹ / unit"
                    min={0}
                    max={10000}
                    value={material.insertCost}
                    onChange={(value) => updateMaterial(material.id, { insertCost: value })}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-line px-2 py-2 text-xs leading-5 text-secondary">No insert in this configuration.</div>
                )}
              </div>
              <p className="mt-4 font-display text-2xl font-semibold tabular-nums">{formatMoney(design.unitCost)}</p>
              <p className="text-xs text-secondary">Estimated cost per unit, rounded to the paisa.</p>
              <p className="mt-3 text-sm leading-6 text-secondary">{material.compatibility}</p>
              <Button
                className="mt-4"
                fullWidth
                variant={selected ? 'secondary' : 'primary'}
                aria-pressed={selected}
                onClick={() => selectMaterial(material.id as MaterialId)}
              >
                {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                {selected ? 'Selected' : 'Select configuration'}
              </Button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
