import { Link } from 'react-router-dom'

export function Logo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const ink = tone === 'light' ? '#F7F8F4' : '#142923'
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-deep">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 3.6 28 9.4v13.2L16 28.4 4 22.6V9.4L16 3.6Z" fill="none" stroke="#229C78" strokeWidth="1.7" />
        <path d="M16 16.2 28 9.4M16 16.2 4 9.4M16 16.2v12.2" fill="none" stroke={ink} strokeWidth="1.6" />
        <path d="m16 16.2 6.4 3.2" fill="none" stroke="#E9B969" strokeWidth="1.7" />
      </svg>
      <span className="font-display text-[1.05rem] font-semibold tracking-tight" style={{ color: ink }}>
        PackShift
      </span>
    </Link>
  )
}
