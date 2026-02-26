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
}: ScriptEditorHeaderProps) {
  return (
    <div className="h-8 px-3 border-b border-border flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {displayPlots.length >= 2 ? (
          <span className="text-xs font-medium text-muted-foreground shrink-0">
            {displayPlots.map(p => 'P' + (plotBoxesSorted.findIndex(x => x.id === p.id) + 1)).join(' ')}
          </span>
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
