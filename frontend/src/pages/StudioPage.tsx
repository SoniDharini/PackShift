import { useEffect, useState } from 'react'
import { WorkspaceHeader } from '../components/layout/WorkspaceHeader.tsx'
import { DesignCanvas } from '../components/studio/DesignCanvas.tsx'
import { InputPanel } from '../components/studio/InputPanel.tsx'
import { SpecPanel } from '../components/studio/SpecPanel.tsx'
import { cn } from '../lib/cn.ts'
import { formatDims } from '../lib/format.ts'
import { useDesign } from '../state/DesignContext.tsx'

type Tab = 'inputs' | 'canvas' | 'specs'

export function StudioPage() {
  const [tab, setTab] = useState<Tab>('canvas')
  const { liveDesign, committedDesign } = useDesign()
  useEffect(() => {
    document.title = 'Design Studio — PackShift'
  }, [])

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-cream">
      <WorkspaceHeader />
      <div className="grid grid-cols-3 border-b border-line bg-white xl:hidden" role="tablist" aria-label="Studio panels">
        {(
          [
            ['inputs', 'Inputs'],
            ['canvas', 'Canvas'],
            ['specs', 'Specification'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('h-11 text-sm font-semibold', tab === id ? 'border-b-2 border-emerald text-forest' : 'text-secondary')}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="main" className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] xl:grid-cols-[30%_minmax(0,1fr)_20%]">
        <div className={cn('min-h-0 border-line xl:border-r', tab !== 'inputs' && 'hidden xl:block')} role="tabpanel">
          <InputPanel onGenerated={() => setTab('canvas')} />
        </div>
        <div className={cn('min-h-0', tab !== 'canvas' && 'hidden xl:block')} role="tabpanel">
          <DesignCanvas />
        </div>
        <div className={cn('min-h-0 border-line xl:border-l', tab !== 'specs' && 'hidden xl:block')} role="tabpanel">
          <SpecPanel />
        </div>
      </div>
      <footer className="hidden h-8 shrink-0 items-center justify-between border-t border-line bg-white px-4 text-[11px] text-secondary xl:flex">
        <span>Millimetres · FEFCO 0201 · Conceptual study</span>
        <span className="tabular-nums">
          {liveDesign ? `Preview ${formatDims(liveDesign.external)}` : 'Preview paused'}
          {committedDesign ? ` · Spec ${formatDims(committedDesign.external)}` : ''}
        </span>
      </footer>
    </div>
  )
}
