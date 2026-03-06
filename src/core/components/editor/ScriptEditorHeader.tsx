import { useRef, useLayoutEffect, useState } from 'react'
import type { PlotBox } from '@/types/sw'

interface ScriptEditorHeaderProps {
  displayPlots: PlotBox[]
  plotBoxesSorted: PlotBox[]
  plotBoxIndex: number
  plotBox: PlotBox | undefined
  editingPlotTitle: boolean
  setEditingPlotTitle: (v: boolean) => void
  episodeId: string
  activePlotBoxId: string | null
  updatePlotBox: (episodeId: string, plotBoxId: string, patch: Partial<PlotBox>) => void
  setPalettePosition: (pos?: { x: number; y: number; above?: boolean }) => void
  openCommandPalette: () => void
  /** 스크롤 시 현재 보이는 플롯 세그먼트 인덱스 (2개 이상 확정 시 pill 호버용) */
  visibleSegmentIndices?: number[]
  uiScalePercent?: number
}

export function ScriptEditorHeader({
  displayPlots,
  plotBoxesSorted,
  plotBoxIndex,
  plotBox,
  editingPlotTitle,
  setEditingPlotTitle,
  episodeId,
  activePlotBoxId,
  updatePlotBox,
  setPalettePosition,
  openCommandPalette,
  visibleSegmentIndices = [],
  uiScalePercent = 100,
}: ScriptEditorHeaderProps) {
  const plotLabelRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null)

  const effectiveVisible =
    displayPlots.length >= 2
      ? visibleSegmentIndices.length > 0
        ? visibleSegmentIndices
        : Array.from({ length: displayPlots.length }, (_, i) => i)
      : []
  const showPill = effectiveVisible.length > 0

  useLayoutEffect(() => {
    if (!showPill || effectiveVisible.length === 0) {
      setPillStyle(null)
      return
    }
    let cancelled = false
    const measure = () => {
      const refs = plotLabelRefs.current
      const first = effectiveVisible[0]
      const last = effectiveVisible[effectiveVisible.length - 1]
      const firstEl = refs[first]
      const lastEl = refs[last]
      if (cancelled || !firstEl || !lastEl) return
      const pad = 2
      const left = firstEl.offsetLeft - pad
      const width = lastEl.offsetLeft + lastEl.offsetWidth - firstEl.offsetLeft + pad * 2
      if (!cancelled) setPillStyle({ left, width })
    }
    measure()
    const rafId = requestAnimationFrame(measure)
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [showPill, effectiveVisible.join(','), displayPlots.length, uiScalePercent])

  return (
    <div className="h-8 px-3 border-b border-border flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {displayPlots.length >= 2 ? (
          <div className="relative flex items-center gap-1.5 shrink-0">
            {showPill && pillStyle && pillStyle.width > 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 h-5 rounded-full border border-border bg-muted/90 pointer-events-none transition-[left,width] duration-200 ease-out scenario-header-pill"
                style={{ left: pillStyle.left, width: Math.max(pillStyle.width, 4) }}
                aria-hidden
              />
            )}
            {displayPlots.map((p, i) => (
              <span
                key={p.id}
                ref={(el) => { plotLabelRefs.current[i] = el }}
                className="relative z-10 text-xs font-medium text-muted-foreground"
              >
                P{plotBoxesSorted.findIndex(x => x.id === p.id) + 1}
              </span>
            ))}
          </div>
        ) : (
          <>
            <span className="text-xs font-medium shrink-0">P{plotBoxIndex + 1}</span>
            {editingPlotTitle ? (
              <input
                type="text"
                value={plotBox?.title || ''}
                onChange={(e) => activePlotBoxId && updatePlotBox(episodeId, activePlotBoxId, { title: e.target.value })}
                onBlur={() => setEditingPlotTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') setEditingPlotTitle(false)
                }}
                className="text-[10px] text-foreground outline-none bg-transparent w-32 border-0 rounded-none"
                placeholder="제목 없음"
                autoFocus
              />
            ) : (
              <span
                className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setEditingPlotTitle(true)}
              >
                {plotBox?.title || '제목 없음'}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
