import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '../ui/Button.tsx'
import { Logo } from '../brand/Logo.tsx'

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          <a href="#method" className="text-sm font-medium text-secondary hover:text-forest">
            How it works
          </a>
          <Link to="/studio" className="text-sm font-medium text-secondary hover:text-forest">
            Design Studio
          </Link>
          <Link to="/optimise" className="text-sm font-medium text-secondary hover:text-forest">
            Optimisation
          </Link>
        </nav>
        <div className="hidden md:block">
          <ButtonLink to="/studio">Start Designing</ButtonLink>
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-white md:hidden"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-line bg-cream px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            <a href="#method" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2 text-sm font-medium">
              How it works
            </a>
            <Link to="/studio" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2 text-sm font-medium">
              Design Studio
            </Link>
            <Link to="/optimise" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2 text-sm font-medium">
              Optimisation
            </Link>
            <ButtonLink to="/studio" className="mt-2">
              Start Designing
            </ButtonLink>
          </div>
        </div>
      ) : null}
    </header>
  )
}
