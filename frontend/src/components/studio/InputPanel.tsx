import { LoaderCircle, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { CATEGORIES } from '../../types/packaging.ts'
import type { Fragility, Mode } from '../../types/packaging.ts'
import { formatDims } from '../../lib/format.ts'
import { useDesign } from '../../state/DesignContext.tsx'
import { Button } from '../ui/Button.tsx'
import { Field, Segmented, SelectField } from '../ui/Field.tsx'
import { focusInvalidField } from './DirtyNotice.tsx'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">{title}</h2>
      {children}
    </section>
  )
}

export function InputPanel({ onGenerated }: { onGenerated?: () => void }) {
  const { mode, form, errors, status, liveDesign, isDirty, setMode, setField, generate, resetExample } = useDesign()

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-line px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">Project</p>
        <h1 className="mt-1 font-display text-lg font-semibold">Packaging inputs</h1>
      </div>
      <form
        id="design-form"
        className="scroll-thin flex-1 space-y-6 overflow-y-auto px-4 py-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void generate().then((ok) => {
            if (ok) onGenerated?.()
            else focusInvalidField()
          })
        }}
      >
        <Segmented<Mode>
          label="Design mode"
          name="design-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'create', label: 'Create new packaging' },
            { value: 'redesign', label: 'Redesign existing packaging' },
          ]}
        />
        <p className="text-xs leading-5 text-secondary">
          {mode === 'create'
            ? 'Size a new carton from the product and the clearance on each face.'
            : 'Compare a new carton with packaging you already use.'}
        </p>

        <Section title="Product">
          <Field label="Product name" name="name" value={form.name} onChange={(value) => setField('name', value)} error={errors.name} />
          <SelectField label="Category" name="category" value={form.category} onChange={(value) => setField('category', value)} options={CATEGORIES} />
        </Section>

        <Section title="Measurements">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Length" name="length" unit="mm" value={form.length} onChange={(value) => setField('length', value)} error={errors.length} tooltip="The product's longest horizontal side." />
            <Field label="Width" name="width" unit="mm" value={form.width} onChange={(value) => setField('width', value)} error={errors.width} tooltip="The product's shorter horizontal side." />
            <Field label="Height" name="height" unit="mm" value={form.height} onChange={(value) => setField('height', value)} error={errors.height} tooltip="The product's vertical side." />
          </div>
          <Field
            label="Weight"
            name="weight"
            unit="g"
            value={form.weight}
            onChange={(value) => setField('weight', value)}
            error={errors.weight}
            tooltip="Recorded for a board-grade review. It does not change the blank size."
          />
        </Section>

        <Section title="Protection inputs">
          <Segmented<Fragility>
            label="Fragility"
            name="fragility"
            columns={3}
            value={form.fragility}
            onChange={(value) => setField('fragility', value)}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
          />
          <Field
            label="Cushioning clearance"
            name="clearance"
            unit="mm"
            value={form.clearance}
            onChange={(value) => setField('clearance', value)}
            error={errors.clearance}
            tooltip="Added on every face. Internal length = product length + 2 × clearance."
          />
          {liveDesign ? (
            <p className="text-xs leading-5 text-secondary">
              Internal preview {formatDims(liveDesign.internal)}. Outer preview {formatDims(liveDesign.external)}.
            </p>
          ) : null}
        </Section>

        <Section title="Order">
          <Field
            label="Packaging quantity"
            name="quantity"
            inputMode="numeric"
            value={form.quantity}
            onChange={(value) => setField('quantity', value)}
            error={errors.quantity}
            tooltip="Used for the estimated order cost."
          />
          <div className="rounded-lg border border-line bg-cream/70 px-3 py-2.5">
            <p className="text-sm font-medium">Regular slotted carton</p>
            <p className="text-xs text-secondary">FEFCO 0201. Other structures are not in this version.</p>
          </div>
        </Section>

        {mode === 'redesign' ? (
          <Section title="Current packaging">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Length" name="existingLength" unit="mm" value={form.existingLength} onChange={(value) => setField('existingLength', value)} error={errors.existingLength} tooltip="Stated size of the pack you use today." />
              <Field label="Width" name="existingWidth" unit="mm" value={form.existingWidth} onChange={(value) => setField('existingWidth', value)} error={errors.existingWidth} />
              <Field label="Height" name="existingHeight" unit="mm" value={form.existingHeight} onChange={(value) => setField('existingHeight', value)} error={errors.existingHeight} />
            </div>
            <Field label="Material" name="existingMaterial" inputMode="text" value={form.existingMaterial} onChange={(value) => setField('existingMaterial', value)} error={errors.existingMaterial} />
            <Field
              label="Estimated unit cost"
              name="existingUnitCost"
              unit="INR"
              value={form.existingUnitCost}
              onChange={(value) => setField('existingUnitCost', value)}
              error={errors.existingUnitCost}
              tooltip="Your current cost per pack. PackShift does not replace it with a calculated price."
            />
          </Section>
        ) : null}
      </form>
      <div className="space-y-3 border-t border-line p-4">
        {isDirty ? <p className="text-xs leading-5 text-secondary">The canvas can update immediately. Generate to refresh the specification.</p> : null}
        <Button type="submit" form="design-form" variant="accent" size="lg" fullWidth disabled={status === 'loading'}>
          {status === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {status === 'loading' ? 'Generating design' : 'Generate Packaging Design'}
        </Button>
        <button type="button" onClick={resetExample} className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-forest">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Load the ceramic mug example
        </button>
      </div>
    </div>
  )
}
