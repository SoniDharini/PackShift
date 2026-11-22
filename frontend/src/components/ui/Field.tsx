import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { InfoTip } from './Tooltip.tsx'

const fieldClass =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-forest outline-none transition placeholder:text-muted focus:border-emerald-deep focus:ring-2 focus:ring-emerald/20'

export function Field({
  label,
  name,
  value,
  onChange,
  error,
  tooltip,
  unit,
  inputMode = 'decimal',
  placeholder,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  error?: string
  tooltip?: string
  unit?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
  placeholder?: string
}) {
  const errorId = `${name}-error`
  return (
    <label className="block min-w-0" htmlFor={name}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-forest">
        {label}
        {tooltip ? <InfoTip label={tooltip} /> : null}
      </span>
      <span className="relative block">
        <input
          id={name}
          name={name}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onWheel={(event) => event.currentTarget.blur()}
          className={cn(fieldClass, unit && 'pr-12', error && 'border-danger focus:border-danger focus:ring-danger/15')}
        />
        {unit ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary">{unit}</span>
        ) : null}
      </span>
      {error ? (
        <span id={errorId} className="mt-1 block text-xs text-danger">
          {error}
        </span>
      ) : null}
    </label>
  )
}

export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
}) {
  return (
    <label className="block" htmlFor={name}>
      <span className="mb-1.5 block text-xs font-medium text-forest">{label}</span>
      <span className="relative block">
        <select
          id={name}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(fieldClass, 'appearance-none pr-8')}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary">▾</span>
      </span>
    </label>
  )
}

export function Segmented<T extends string>({
  label,
  name,
  value,
  onChange,
  options,
  columns = 2,
}: {
  label: string
  name: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode }[]
  columns?: 2 | 3
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-1 rounded-xl bg-cream p-1', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}
    >
      {options.map((option) => (
        <label key={option.value} className="min-w-0 cursor-pointer">
          <input
            className="peer sr-only"
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span className="flex min-h-10 items-center justify-center rounded-lg px-2 py-2 text-center text-xs font-semibold leading-4 text-secondary peer-checked:bg-white peer-checked:text-forest peer-checked:shadow-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-deep">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  )
}
