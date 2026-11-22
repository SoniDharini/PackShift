import { Info } from 'lucide-react'
import { useId, type ReactNode } from 'react'

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="group inline-flex rounded-full text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-deep"
        aria-label={label}
        aria-describedby={id}
      >
        {children}
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-lg bg-forest px-3 py-2 text-left text-xs font-normal normal-case leading-5 tracking-normal text-white opacity-0 shadow-float transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {label}
        </span>
      </button>
    </span>
  )
}

export function InfoTip({ label }: { label: string }) {
  return (
    <Tooltip label={label}>
      <Info className="h-3.5 w-3.5" aria-hidden="true" />
    </Tooltip>
  )
}
