import {
  Download,
  Eye,
  Grid3x3,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Move3d,
  PenLine,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { buildDieline } from '../../lib/dieline.ts'
import { buildDimensions } from '../../lib/drawings.ts'
import { downloadSvg, type VectorDrawing } from '../../lib/svg.ts'
import { formatDims, formatNumber, slugify } from '../../lib/format.ts'
import { centredPlacement, statedPackTooSmall } from '../../lib/sceneLayout.ts'
import { cn } from '../../lib/cn.ts'
import { useDesign } from '../../state/DesignContext.tsx'
import type { PackagingDesign } from '../../types/packaging.ts'
import type { CameraView, PackagingSceneHandle, ShadeMode } from './PackagingScene.tsx'

const PackagingScene = lazy(() => import('./PackagingScene.tsx'))

type Sheet = '3d' | 'dieline' | 'dimensions'

function VectorStage({ drawing, zoom }: { drawing: VectorDrawing; zoom: number }) {
  return (
    <div className="relative h-full overflow-auto">
      <svg
        viewBox={drawing.viewBox}
        role="img"
        aria-label={drawing.label}
        className="mx-auto h-auto max-w-none"
        style={{ width: `${Math.round(zoom * 100)}%` }}
        dangerouslySetInnerHTML={{ __html: drawing.inner }}
      />
    </div>
  )
}

export function DesignCanvas() {
  const { liveDesign, committedDesign, mode, status, isDirty } = useDesign()
  const lastLive = useRef<PackagingDesign | null>(liveDesign)
  if (liveDesign) lastLive.current = liveDesign
  const shown = liveDesign ?? lastLive.current ?? committedDesign
  const [sheet, setSheet] = useState<Sheet>('3d')
  const [cameraView, setCameraView] = useState<CameraView>('iso')
  const [viewSignal, setViewSignal] = useState(0)
  const [shade, setShade] = useState<ShadeMode>('solid')
  const [showOutline, setShowOutline] = useState(true)
  const [svgZoom, setSvgZoom] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<PackagingSceneHandle>(null)
  const rawId = useId().replace(/:/g, '')
  const placement = shown ? centredPlacement(shown.product, shown.internal, shown.external) : null
  const dieline = useMemo(() => (shown ? buildDieline(shown, `${rawId}d`) : null), [shown, rawId])
  const dimensions = useMemo(() => (shown ? buildDimensions(shown, `${rawId}m`) : null), [shown, rawId])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const chooseView = (view: CameraView) => {
    setCameraView(view)
    setViewSignal((value) => value + 1)
  }

  const zoom = (direction: 'in' | 'out') => {
    if (sheet === '3d') sceneRef.current?.zoomBy(direction === 'in' ? 0.82 : 1.18)
    else setSvgZoom((value) => Math.min(2.2, Math.max(0.7, Math.round((value + (direction === 'in' ? 0.15 : -0.15)) * 100) / 100)))
  }

  const reset = () => {
    setCameraView('iso')
    setViewSignal((value) => value + 1)
    setSvgZoom(1)
    setShade('solid')
  }

  const toggleFullscreen = () => {
    const node = frameRef.current
    if (!node) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void node.requestFullscreen()
  }

  const download = () => {
    if (!shown) return
    const drawing = sheet === 'dimensions' ? dimensions : dieline
    if (!drawing) return
    const kind = sheet === 'dimensions' ? 'dimensions' : 'dieline'
    downloadSvg(`packshift-${slugify(shown.productName)}-${kind}.svg`, drawing)
  }

  return (
    <div ref={frameRef} className="flex h-full min-h-0 flex-col bg-[#F3F5F0]">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-white/95 px-3 py-2">
        <div className="flex rounded-lg bg-cream p-1" role="tablist" aria-label="Drawing views">
          {(
            [
              ['3d', '3D Preview', Move3d],
              ['dieline', '2D Dieline', PenLine],
              ['dimensions', 'Dimensions', Grid3x3],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={sheet === id}
              onClick={() => setSheet(id)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold',
                sheet === id ? 'bg-white text-forest shadow-sm' : 'text-secondary hover:text-forest',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {sheet === '3d' ? (
          <div className="flex rounded-lg bg-cream p-1" role="group" aria-label="Camera">
            {(
              [
                ['iso', 'Isometric'],
                ['front', 'Front'],
                ['top', 'Aerial'],
                ['side', 'Side'],
              ] as const
            ).map(([view, label]) => (
              <button
                key={view}
                type="button"
                aria-pressed={cameraView === view}
                onClick={() => chooseView(view)}
                className={cn(
                  'h-8 rounded-md px-2.5 text-xs font-semibold',
                  cameraView === view ? 'bg-white text-forest shadow-sm' : 'text-secondary hover:text-forest',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {sheet === '3d' ? (
            <>
              {(
                [
                  ['solid', 'Solid'],
                  ['ghost', 'Ghosted'],
                  ['wire', 'Wire'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={shade === id}
                  onClick={() => setShade(id)}
                  className={cn(
                    'h-8 rounded-lg px-2.5 text-xs font-semibold',
                    shade === id ? 'bg-white text-forest shadow-sm' : 'text-secondary hover:bg-white',
                  )}
                >
                  {label}
                </button>
              ))}
              {mode === 'redesign' ? (
                <button
                  type="button"
                  aria-pressed={showOutline}
                  onClick={() => {
                    setShowOutline((value) => !value)
                    setViewSignal((value) => value + 1)
                  }}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold',
                    showOutline ? 'bg-white text-forest shadow-sm' : 'text-secondary hover:bg-white',
                  )}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  Existing
                </button>
              ) : null}
            </>
          ) : null}
          <IconButton label="Zoom out" onClick={() => zoom('out')}>
            <ZoomOut className="h-4 w-4" />
          </IconButton>
          <IconButton label="Zoom in" onClick={() => zoom('in')}>
            <ZoomIn className="h-4 w-4" />
          </IconButton>
          <IconButton label="Reset view" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
          </IconButton>
          <IconButton label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </IconButton>
          <button
            type="button"
            onClick={download}
            disabled={!shown}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-forest px-2.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            SVG
          </button>
        </div>
      </div>
      <div className={cn('relative min-h-0 flex-1 overflow-hidden', sheet === '3d' ? 'technical-grid' : 'bg-[#F7F8F4]')}>
        <span className="pointer-events-none absolute left-3 top-3 z-10 h-4 w-4 border-l border-t border-forest/25" />
        <span className="pointer-events-none absolute right-3 top-3 z-10 h-4 w-4 border-r border-t border-forest/25" />
        <span className="pointer-events-none absolute bottom-3 left-3 z-10 h-4 w-4 border-b border-l border-forest/25" />
        <span className="pointer-events-none absolute bottom-3 right-3 z-10 h-4 w-4 border-b border-r border-forest/25" />
        {shown && sheet === '3d' ? (
          <div className="pointer-events-none absolute left-5 top-5 z-10 hidden max-w-[16rem] sm:block">
            <p className="font-display text-sm font-semibold">{shown.productName}</p>
            <p className="text-xs text-secondary">Product {formatDims(shown.product)}</p>
            <p className="text-xs text-secondary">Internal {formatDims(shown.internal)}</p>
            <p className="text-xs text-secondary">Outer {formatDims(shown.external)}</p>
            <p className="text-xs text-secondary">
              Clearance {placement ? `${formatNumber(placement.clearanceMm.l)} / ${formatNumber(placement.clearanceMm.w)} / ${formatNumber(placement.clearanceMm.h)} mm` : ''}, product centered
            </p>
            {shown.existing && statedPackTooSmall(shown.product, shown.existing.size) ? (
              <p className="mt-1 text-xs text-danger">The stated pack is smaller than the product. The product is not scaled down.</p>
            ) : null}
            {isDirty && liveDesign ? <p className="mt-1 text-xs text-secondary">Uncommitted preview</p> : null}
            {!liveDesign ? <p className="mt-1 text-xs text-danger">Preview paused until the measurements are valid.</p> : null}
          </div>
        ) : null}
        {sheet === '3d' && shown ? (
          <div className={cn('absolute inset-0', 'cursor-grab active:cursor-grabbing')}>
            <Suspense
              fallback={
                <div className="grid h-full place-items-center text-sm text-secondary">
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Preparing the 3D preview
                  </span>
                </div>
              }
            >
              <PackagingScene
                imperativeRef={sceneRef}
                design={shown}
                shade={shade}
                cameraView={cameraView}
                viewSignal={viewSignal}
                showDimensions
                showOutline={showOutline && mode === 'redesign'}
              />
            </Suspense>
          </div>
        ) : null}
        {sheet === 'dieline' && dieline ? <VectorStage drawing={dieline} zoom={svgZoom} /> : null}
        {sheet === 'dimensions' && dimensions ? <VectorStage drawing={dimensions} zoom={svgZoom} /> : null}
        {status === 'loading' ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-white/55 backdrop-blur-[1px]">
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm shadow-card">
              <LoaderCircle className="h-4 w-4 animate-spin text-emerald-deep" aria-hidden="true" />
              Calculating blank size, outer dimensions, and cost.
            </div>
          </div>
        ) : null}
        {sheet === '3d' ? (
          <p className="pointer-events-none absolute bottom-4 left-5 z-10 text-[11px] text-secondary">Drag to rotate · scroll to zoom</p>
        ) : null}
      </div>
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-forest hover:bg-white"
    >
      {children}
    </button>
  )
}
