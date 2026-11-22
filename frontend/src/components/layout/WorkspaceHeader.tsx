import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn.ts'
import { useDesign } from '../../state/DesignContext.tsx'
import { Logo } from '../brand/Logo.tsx'

export function WorkspaceHeader() {
  const { form } = useDesign()
  const name = form.name.trim() || 'Untitled pack'
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn('rounded-lg px-3 py-1.5 text-sm font-medium', isActive ? 'bg-cream text-forest' : 'text-secondary hover:text-forest')

  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-white/95 px-3 backdrop-blur sm:px-4">
      <div className="flex min-w-0 items-center gap-4">
        <Logo />
        <nav className="flex items-center gap-1" aria-label="Workspace">
          <NavLink to="/studio" className={linkClass}>
            <span className="hidden sm:inline">Design Studio</span>
            <span className="sm:hidden">Studio</span>
          </NavLink>
          <NavLink to="/optimise" className={linkClass}>
            <span className="hidden sm:inline">Optimisation</span>
            <span className="sm:hidden">Compare</span>
          </NavLink>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden max-w-[14rem] truncate text-sm text-secondary md:inline">{name}</span>
        <span className="rounded-full bg-[#FBF6EC] px-2.5 py-1 text-[11px] font-semibold text-forest">Conceptual</span>
      </div>
    </header>
  )
}
