import { useEffect } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore, selectSelectedPlotBoxIds, selectConfirmedPlotBoxIds } from '@/store/ui/uiStore'
import { useEditorStore } from '@/store/editor/editorStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { useHistoryStore } from '@/store/history/historyStore'
import { Tooltip } from '@/components/ui/Tooltip'

export function StatusBar() {
  const undo = useHistoryStore(state => state.undo)
  const redo = useHistoryStore(state => state.redo)
  const canUndo = useHistoryStore(state => state.canUndo)
  const canRedo = useHistoryStore(state => state.canRedo)
  const file = useProjectStore(state => state.file)
  const isDirty = useProjectStore(state => state.isDirty)
  const fileErrorMessage = useUIStore(state => state.fileErrorMessage)
  const setFileErrorMessage = useUIStore(state => state.setFileErrorMessage)
  const fileOperationLoading = useUIStore(state => state.fileOperationLoading)
  const activeEpisodeId = useUIStore(state => state.activeEpisodeId)
  const activePlotBoxId = useUIStore(state => state.activePlotBoxId)
  const selectedPlotBoxIds = useUIStore(selectSelectedPlotBoxIds)
  const confirmedPlotBoxIds = useUIStore(selectConfirmedPlotBoxIds)
  const currentPropertyType = useEditorStore(state => state.currentPropertyType)
  const currentCharacterId = useEditorStore(state => state.currentCharacterId)
  const propertyLabels = useSettingsStore(state => state.propertyLabels)

  const activeEpisode = file?.episodes.find(e => e.id === activeEpisodeId)
  const plotBoxesSorted = activeEpisode ? [...activeEpisode.plotBoxes].sort((a, b) => a.order - b.order) : []
  const activePlotBox = activeEpisode?.plotBoxes.find(p => p.id === activePlotBoxId)
  const currentCharacter = file?.project.characters.find(c => c.id === currentCharacterId)
  const plotIndex = activeEpisode?.plotBoxes.findIndex(p => p.id === activePlotBoxId) ?? -1
  const totalPlots = plotBoxesSorted.length

  const multiConfirmedCount = confirmedPlotBoxIds.length >= 2 ? confirmedPlotBoxIds.length : 0
  const confirmedIndices = multiConfirmedCount > 0 && plotBoxesSorted.length > 0
    ? confirmedPlotBoxIds
        .map(id => plotBoxesSorted.findIndex(p => p.id === id))
        .filter(i => i >= 0)
        .sort((a, b) => a - b)
    : []
  const confirmedRangeText =
    confirmedIndices.length >= 2
      ? `P${confirmedIndices[0] + 1}–P${confirmedIndices[confirmedIndices.length - 1] + 1}`
      : null

  const multiSelectCount = selectedPlotBoxIds.length >= 2 ? selectedPlotBoxIds.length : 0
  const firstSelectedPlotIndex = multiSelectCount > 0 && plotBoxesSorted.length > 0
    ? plotBoxesSorted.findIndex(p => p.id === selectedPlotBoxIds[0])
    : -1
  const plotStatusText =
    confirmedRangeText ??
    (multiSelectCount > 0 && firstSelectedPlotIndex >= 0 && totalPlots > 0
      ? `P${firstSelectedPlotIndex + 1}/${totalPlots}`
      : null)

  useEffect(() => {
    if (!fileErrorMessage) return
    const t = setTimeout(() => setFileErrorMessage(null), 5000)
    return () => clearTimeout(t)
  }, [fileErrorMessage, setFileErrorMessage])

  return (
    <div className="h-6 border-t border-border bg-muted/30 flex items-center px-3 gap-0 text-[10px] text-muted-foreground select-none shrink-0">
      {activeEpisode && (
        <>
          <span className="px-2">
            {String(activeEpisode.number).padStart(2, '0')}
            {activeEpisode.subtitle ? `: ${activeEpisode.subtitle}` : ''}
          </span>
          <span className="text-border">·</span>
        </>
      )}
      {(activePlotBox != null || plotStatusText != null) && (
        <>
          <span className="px-2">
            {plotStatusText ?? `P${plotIndex + 1}${activePlotBox?.title ? `: ${activePlotBox.title}` : ''}`}
          </span>
          <span className="text-border">·</span>
        </>
      )}
      <span className="px-2">
        {propertyLabels[currentPropertyType] || currentPropertyType}
      </span>
      {currentCharacter && (
        <>
          <span className="text-border">·</span>
          <span className="px-2" style={{ color: currentCharacter.color }}>
            {currentCharacter.name}
          </span>
        </>
      )}
      <div className="flex-1" />
      <StatusBarIconBtn onClick={() => canUndo() && undo()} disabled={!canUndo()} title="되돌아가기">
        <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
      </StatusBarIconBtn>
      <StatusBarIconBtn onClick={() => canRedo() && redo()} disabled={!canRedo()} title="다시 실행">
        <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
      </StatusBarIconBtn>
      <span className="text-border mx-0.5">·</span>
      {fileOperationLoading ? (
        <span className="px-2 text-muted-foreground">
          {fileOperationLoading === 'open' ? '열기 중...' : '저장 중...'}
        </span>
      ) : fileErrorMessage ? (
        <span className="text-destructive px-2 truncate max-w-[200px]" title={fileErrorMessage}>
          {fileErrorMessage}
        </span>
      ) : (
        <span className={isDirty ? 'text-foreground/80' : 'text-muted-foreground'}>
          {isDirty ? '변경됨 ●' : '저장됨 ✓'}
        </span>
      )}
    </div>
  )
}

function StatusBarIconBtn({ children, onClick, disabled, title }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  const btn = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      className="w-5 h-5 flex items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground hover:bg-accent/50"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
  if (title) {
    return <Tooltip content={title} side="top">{btn}</Tooltip>
  }
  return btn
}
