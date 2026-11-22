import { ArrowRight, Box, Download, Layers, Ruler, Scale } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo } from 'react'
import { SiteFooter } from '../components/layout/SiteFooter.tsx'
import { SiteHeader } from '../components/layout/SiteHeader.tsx'
import { ButtonLink } from '../components/ui/Button.tsx'
import { getExampleDesign } from '../lib/example.ts'
import { formatArea, formatDims, formatMoney, formatReduction } from '../lib/format.ts'

const PackagingScene = lazy(() => import('../components/studio/PackagingScene.tsx'))

const features = [
  {
    icon: Ruler,
    title: 'Dimension-driven layouts',
    body: 'Internal size, outer size, and an RSC blank come from the measurements and clearance you enter.',
  },
  {
    icon: Layers,
    title: 'Material configurations',
    body: 'Compare standard board, a thicker recycled-content board, and board with a protective insert.',
  },
  {
    icon: Scale,
    title: 'Cost comparison',
    body: 'Sheet area, conversion, and insert cost use prices you can edit. They are assumptions, not quotes.',
  },
  {
    icon: Download,
    title: 'Dieline export',
    body: 'Download a dimensioned SVG of the blank or the orthographic views for a converter discussion.',
  },
]

export function LandingPage() {
  const example = useMemo(() => getExampleDesign(), [])
  useEffect(() => {
    document.title = 'PackShift — Design Smarter. Pack Greener.'
  }, [])

  const steps = [
    {
      number: '01',
      title: 'Measure the product',
      body: 'Enter length, width, height, weight, fragility, and the clearance you want on each face. The studio opens with a 120 × 100 × 100 mm ceramic mug.',
    },
    {
      number: '02',
      title: 'Generate the carton',
      body: `PackShift sizes a regular slotted carton, draws the blank, and previews the box. For the mug, that is an internal ${formatDims(example.internal)}.`,
    },
    {
      number: '03',
      title: 'Compare and export',
      body: 'Review sheet area and assumed cost against the pack you use today, then download the dieline. Production still needs a converter.',
    },
  ]

  return (
    <div className="bg-cream">
      <SiteHeader />
      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="rise">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-deep">Design smarter. Pack greener.</p>
            <h1 className="mt-4 max-w-xl font-display text-5xl font-semibold leading-[1.02] tracking-tight text-forest sm:text-6xl">
              Better Packaging Begins with Better Design.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-secondary sm:text-lg">
              PackShift turns product measurements into a right-sized regular slotted carton, a dimensioned dieline, and a board-cost comparison. It is a packaging workspace, not a chat window.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/studio" size="lg">
                Start Designing
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <a
                href="#method"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-white px-5 text-base font-medium text-forest hover:border-[#C5D1CA]"
              >
                Explore How It Works
              </a>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-secondary">Volume</dt>
                <dd className="mt-1 font-display text-lg font-semibold tabular-nums">{formatReduction(example.volumeReductionPct)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-secondary">Sheet</dt>
                <dd className="mt-1 font-display text-lg font-semibold tabular-nums">{formatArea(example.blankAreaM2)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-secondary">Unit cost</dt>
                <dd className="mt-1 font-display text-lg font-semibold tabular-nums">{formatMoney(example.unitCost)}</dd>
              </div>
            </dl>
          </div>
          <div className="rise relative" style={{ animationDelay: '80ms' }}>
            <div className="technical-grid relative h-[520px] overflow-hidden rounded-[28px] border border-line bg-white shadow-float">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.78),transparent_68%)]" />
              <Suspense fallback={<div className="grid h-full place-items-center text-sm text-secondary">Preparing the carton preview</div>}>
                <PackagingScene design={example} shade="solid" cameraView="iso" viewSignal={0} showDimensions={false} showOutline hero />
              </Suspense>
              <div className="pointer-events-none absolute left-4 top-4 z-10 hidden max-w-[12rem] rounded-2xl border border-line bg-white/90 px-3 py-2 shadow-card backdrop-blur-sm lg:block float-slow">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary">Internal</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{formatDims(example.internal)}</p>
              </div>
              <div className="pointer-events-none absolute right-4 top-4 z-10 hidden rounded-2xl border border-line bg-white/90 px-3 py-2 shadow-card backdrop-blur-sm lg:block float-slower">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary">Board</p>
                <p className="mt-1 text-sm font-semibold">{example.material.flute}</p>
                <p className="text-xs text-secondary">{example.thickness} mm allowance</p>
              </div>
              <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden rounded-2xl border border-line bg-white/90 px-3 py-2 shadow-card backdrop-blur-sm lg:block">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary">Vs stated pack</p>
                <p className="mt-1 text-sm font-semibold">{formatReduction(example.volumeReductionPct)} volume</p>
              </div>
              <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden max-w-[12rem] rounded-2xl border border-line bg-white/90 px-3 py-2 shadow-card backdrop-blur-sm lg:block">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary">Outer</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{formatDims(example.external)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-secondary">
              Example study. The solid carton is the proposed mug pack. Grey edges are the stated 250 × 220 × 180 mm carton, drawn to the same scale.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 lg:hidden">
              <div className="rounded-xl border border-line bg-white px-3 py-2">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-secondary">Internal</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">{formatDims(example.internal)}</dd>
              </div>
              <div className="rounded-xl border border-line bg-white px-3 py-2">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-secondary">Outer</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">{formatDims(example.external)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-deep">Workspace</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">From a product envelope to a carton you can discuss.</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
              <article key={feature.title} className="rise rounded-2xl border border-line bg-white p-5 shadow-card" style={{ animationDelay: `${index * 60}ms` }}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream text-emerald-deep">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-secondary">{feature.body}</p>
              </article>
              )
            })}
          </div>
        </section>

        <section id="method" className="bg-forest text-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber">How PackShift works</p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">Three steps from a measurement to a comparable pack.</h2>
            <ol className="mt-10 grid gap-4 lg:grid-cols-3">
              {steps.map((step) => (
                <li key={step.number} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <p className="font-display text-sm font-semibold text-amber">{step.number}</p>
                  <h3 className="mt-4 font-display text-xl font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#D5E0DA]">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 rounded-[28px] border border-line bg-white px-6 py-8 shadow-card sm:px-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-2 text-emerald-deep">
                <Box className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">Example loaded</span>
              </div>
              <h2 className="font-display text-3xl font-semibold tracking-tight">Open the studio with the mug.</h2>
              <p className="mt-3 text-sm leading-6 text-secondary">
                120 × 100 × 100 mm product, a 250 × 220 × 180 mm current carton, and 20 mm of clearance. Change any figure and generate again.
              </p>
            </div>
            <ButtonLink to="/studio" size="lg">
              Start Designing
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
