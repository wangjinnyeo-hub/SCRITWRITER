import { createContext, useContext, useState } from 'react'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { useWorkspaceDnd } from '@/hooks/useWorkspaceDnd'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore } from '@/store/ui/uiStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { ScriptDragOverlay } from '@/components/editor/ScriptDragOverlay'
import { DRAG_OVERLAY_DEFAULT_WIDTH } from '@/components/editor/constants'

export const WorkspaceDndContext = createContext<{
  activePlotDragId: string | null
  activeScriptDragIds: string[]
  dropPlaceholderOverId: string | null
  /** 스크립트 드래그 오버레이 너비 (ScriptEditor가 setScriptOverlayWidth로 갱신) */
  scriptOverlayWidth: number
  setScriptOverlayWidth: (width: number) => void
} | null>(null)

export function useWorkspaceDndContext() {
  return useContext(WorkspaceDndContext)
}

interface WorkspaceDndWrapperProps {
  episodeId: string
  children: React.ReactNode
}

export function WorkspaceDndWrapper({ episodeId, children }: WorkspaceDndWrapperProps) {
  const [dropPlaceholderOverId, setDropPlaceholderOverId] = useState<string | null>(null)
  const [scriptOverlayWidth, setScriptOverlayWidth] = useState(DRAG_OVERLAY_DEFAULT_WIDTH)
  const [plotOverlayWidth, setPlotOverlayWidth] = useState(320)

  const file = useProjectStore(state => state.file)
  const episode = file?.episodes.find(e => e.id === episodeId)
  const plotBoxes = episode ? [...episode.plotBoxes].sort((a, b) => a.order - b.order) : []
  const characters = file?.project.characters ?? []
  const propertyLabels = useSettingsStore(state => state.propertyLabels) ?? {}

  const getCharacterName = (id?: string, dialogueLabel?: string) => {
    const extra = characters.find(c => c.name === '엑스트라')
    if (id && extra && id === extra.id) return (dialogueLabel && dialogueLabel.trim()) ? dialogueLabel : extra.name
    const c = characters.find(x => x.id === id)
    if (c) return c.name
    if (dialogueLabel && dialogueLabel.trim()) return dialogueLabel.trim()
    return extra?.name ?? '엑스트라'
  }
  const getCharacterColor = (id?: string) => {
    const extra = characters.find(c => c.name === '엑스트라')
    return characters.find(c => c.id === id)?.color ?? extra?.color ?? '#6b7280'
  }

  const setLastMovedScriptUnitIdsByPlot = useUIStore(state => state.setLastMovedScriptUnitIdsByPlot)
  const { sensors, handleDragStart, handleDragOver, handleDragEnd, collisionDetection, activePlotDragId, activeScriptDragIds } =
    useWorkspaceDnd({
      episodeId,
      onDropOverChange: setDropPlaceholderOverId,
      onScriptMovedToPlot: setLastMovedScriptUnitIdsByPlot,
      setPlotOverlayWidth,
    })

  const scriptUnits = (() => {
    const out: { unit: import('@/types/sw').ScriptUnit; plotBoxId: string }[] = []
    plotBoxes.forEach(p => {
      const units = [...(p.scriptUnits || [])].sort((a, b) => a.order - b.order)
      units.forEach(u => out.push({ unit: u, plotBoxId: p.id }))
    })
    return out
  })()
  const activeScriptUnits = activeScriptDragIds.flatMap(id =>
    scriptUnits.filter(({ unit }) => unit.id === id).map(({ unit }) => unit)
  )
  const activePlotBox = activePlotDragId ? plotBoxes.find(b => b.id === activePlotDragId) : null

  return (
    <WorkspaceDndContext.Provider value={{ activePlotDragId, activeScriptDragIds, dropPlaceholderOverId, scriptOverlayWidth, setScriptOverlayWidth }}>
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={null} zIndex={9999}>
        {activePlotBox ? (
          <div
            className="group relative p-3 border-b border-border select-none bg-background shadow-lg rounded cursor-grabbing pointer-events-none"
            style={{ width: plotOverlayWidth, boxSizing: 'border-box' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium truncate flex-1 min-w-0">{activePlotBox.title || '제목 없음'}</span>
              <span className="text-[9px] text-muted-foreground shrink-0">{activePlotBox.scriptUnits.length}</span>
            </div>
            {activePlotBox.content && (
              <p className="text-[11px] text-muted-foreground truncate mt-1 single-line">
                {activePlotBox.content.slice(0, 60)}{activePlotBox.content.length > 60 ? '…' : ''}
              </p>
            )}
          </div>
        ) : activeScriptUnits.length > 0 ? (
          <div className="pointer-events-none">
            <ScriptDragOverlay
              units={activeScriptUnits}
              overlayWidth={scriptOverlayWidth}
              getCharacterName={getCharacterName}
              propertyLabels={propertyLabels}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </WorkspaceDndContext.Provider>
  )
}
