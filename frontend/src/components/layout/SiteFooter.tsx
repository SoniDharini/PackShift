import { Link } from 'react-router-dom'
import { Logo } from '../brand/Logo.tsx'

export function SiteFooter() {
  return (
    <footer className="bg-forest text-[#D5E0DA]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-sm text-sm leading-6">
            Design Smarter. Pack Greener. Dimensions, dielines, and costs are calculated in the browser from the measurements you enter.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber">Workspace</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-white" to="/studio">Design Studio</Link></li>
            <li><Link className="hover:text-white" to="/optimise">Optimisation</Link></li>
            <li><a className="hover:text-white" href="#method">How it works</a></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber">Limit</p>
          <p className="mt-3 text-sm leading-6">
            Conceptual packaging studies for early design. Not production drawings, certified pack tests, or environmental claims.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-[#D5E0DA]/80 sm:px-6">
        © {new Date().getFullYear()} PackShift
      </div>
    </footer>
  )
}
