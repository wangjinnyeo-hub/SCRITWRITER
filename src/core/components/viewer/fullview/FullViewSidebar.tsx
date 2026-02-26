import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { PlotBox } from '@/types'
import type { ViewFormat, ScriptTypeFilter } from './types'

interface FullViewSidebarProps {
  viewFormat: ViewFormat
  setViewFormat: (f: ViewFormat) => void
  plotBoxes: PlotBox[]
  selectedPlotIds: Set<string>
  allPlotsSelected: boolean
  togglePlot: (id: string) => void
  toggleAllPlots: () => void
  selectedTypes: Set<ScriptTypeFilter>
  toggleType: (type: ScriptTypeFilter) => void
  toggleAllTypes: () => void
  propertyLabels: Record<string, string>
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

export function FullViewSidebar({
  viewFormat,
  setViewFormat,
  plotBoxes,
  selectedPlotIds,
  allPlotsSelected,
  togglePlot,
  toggleAllPlots,
  selectedTypes,
  toggleType,
  toggleAllTypes,
  propertyLabels,
  collapsed = false,
  onToggleCollapsed,
}: FullViewSidebarProps) {
  const showPlotFilter = true
  const showTypeFilter = true
  const [formatOpen, setFormatOpen] = useState(true)
  const [plotOpen, setPlotOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(true)

  const toggleBtn = (
    <button
      type="button"
      onClick={onToggleCollapsed}
      className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(collapsed && 'rotate-180')}
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  )

  if (collapsed) {
  return (
    <div className="w-8 shrink-0 border-r border-border flex flex-col items-center py-1 bg-[var(--sidebar-bg)]">
      {toggleBtn}
    </div>
  )
  }

  return (
    <div className="w-48 border-r border-border overflow-auto shrink-0 flex flex-col bg-[var(--sidebar-bg)]">
      <div className="shrink-0 h-7 flex items-center justify-between border-b border-border px-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">사이드바</span>
        {onToggleCollapsed && toggleBtn}
      </div>
      {/* View Format Selector */}
      <div className="border-b border-border">
        <div className="px-2 py-1 flex items-center justify-between gap-1 min-w-0">
          <button type="button" onClick={() => setFormatOpen(!formatOpen)} className="flex items-center gap-1 min-w-0 text-left hover:bg-muted/50 rounded transition-colors py-0.5">
            <svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor" className={cn('shrink-0 transition-transform', formatOpen ? 'rotate-90' : '')} aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="text-[10px] font-medium uppercase tracking-wide truncate">보기 형식</span>
          </button>
        </div>
        {formatOpen && (
        <div className="p-1 space-y-0.5">
          {([
            { value: 'pdf' as const, label: 'PDF 형식' },
            { value: 'script' as const, label: '시나리오' },
            { value: 'plot-script' as const, label: '플롯 + 시나리오' },
            { value: 'episode' as const, label: '에피소드' },
          ]).map(format => (
            <button
              key={format.value}
              onClick={() => setViewFormat(format.value)}
              className={cn(
                'w-full px-2 py-1 min-h-[28px] rounded text-[10px] text-left transition-colors',
                viewFormat === format.value
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {format.label}
            </button>
          ))}
        </div>
        )}
      </div>

      {showPlotFilter && (
        <div className="border-b border-border">
          <div className="px-2 py-1 flex items-center justify-between gap-1 min-w-0">
            <button type="button" onClick={() => setPlotOpen(!plotOpen)} className="flex items-center gap-1 min-w-0 text-left hover:bg-muted/50 rounded transition-colors py-0.5">
              <svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor" className={cn('shrink-0 transition-transform', plotOpen ? 'rotate-90' : '')} aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-[10px] font-medium uppercase tracking-wide truncate">플롯 선택</span>
            </button>
            <button
              onClick={toggleAllPlots}
              className="shrink-0 py-0.5 px-1 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={allPlotsSelected ? '플롯 전체 해제' : '플롯 전체 선택'}
            >
              {allPlotsSelected ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          {plotOpen && (
          <>
          <div className="p-1 space-y-0.5">
            {plotBoxes.map((box, index) => (
              <label
                key={box.id}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 min-h-[28px] rounded text-[10px] transition-colors cursor-pointer',
                  selectedPlotIds.has(box.id) ? 'bg-primary/10' : 'hover:bg-muted'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedPlotIds.has(box.id)}
                  onChange={() => togglePlot(box.id)}
                  className="w-3 h-3"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">P{index + 1}</div>
                  {box.title && <div className="text-[10px] text-muted-foreground truncate">{box.title}</div>}
                </div>
              </label>
            ))}
          </div>
          </>
          )}
        </div>
      )}

      {showTypeFilter && (
        <div className="flex-1 overflow-auto">
          <div className="px-2 py-1 flex items-center justify-between gap-1 min-w-0">
            <button type="button" onClick={() => setTypeOpen(!typeOpen)} className="flex items-center gap-1 min-w-0 text-left hover:bg-muted/50 rounded transition-colors py-0.5">
              <svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor" className={cn('shrink-0 transition-transform', typeOpen ? 'rotate-90' : '')} aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-[10px] font-medium uppercase tracking-wide truncate">유형 선택</span>
            </button>
            <button
              onClick={toggleAllTypes}
              className="shrink-0 py-0.5 px-1 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={selectedTypes.has('all') ? '유형 전체 해제' : '유형 전체 선택'}
            >
              {selectedTypes.has('all') ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          {typeOpen && (
          <>
          <div className="p-1 space-y-0.5">
            {(['dialogue', 'action', 'narration', 'background', 'direction', 'character'] as const).map(type => (
              <label
                key={type}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 min-h-[28px] rounded text-[10px] transition-colors cursor-pointer',
                  (selectedTypes.has(type) || selectedTypes.has('all')) ? 'bg-primary/10' : 'hover:bg-muted'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type) || selectedTypes.has('all')}
                  onChange={() => toggleType(type)}
                  className="w-3 h-3"
                />
                <span>{type === 'character' ? (propertyLabels[type] ?? '캐릭터 이름') : (propertyLabels[type] ?? type)}</span>
              </label>
            ))}
          </div>
          </>
          )}
        </div>
      )}
    </div>
  )
}
