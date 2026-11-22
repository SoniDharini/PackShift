import { useDesign } from '../../state/DesignContext.tsx'
import { Button } from '../ui/Button.tsx'

export function DirtyNotice({ compact = false }: { compact?: boolean }) {
  const { isDirty, generate, status } = useDesign()
  if (!isDirty) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/70 bg-[#FBF6EC] px-3 py-3 text-sm text-forest">
      <p>{compact ? 'Measurements changed since the last specification.' : 'Measurements changed. This page still uses the last generated specification.'}</p>
      <Button size="sm" onClick={() => void generate()} disabled={status === 'loading'}>
        {status === 'loading' ? 'Generating' : 'Generate Packaging Design'}
      </Button>
    </div>
  )
}

export function focusInvalidField() {
  window.setTimeout(() => {
    const field = document.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (!field) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    field.focus()
    field.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }, 0)
}
