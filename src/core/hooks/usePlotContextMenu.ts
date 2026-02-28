import { useCallback } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore, selectSelectedPlotBoxIds, selectConfirmedPlotBoxIds } from '@/store/ui/uiStore'
import { useUndoableProjectActions } from '@/hooks/useUndoableActions'
import type { ContextMenuItem } from '@/components/ui/ContextMenu'
import type { PlotContextRole } from '@/components/editor/SortablePlotBox'

export interface UsePlotContextMenuOptions {
  isPlotCenteredMode: boolean
  plotContentVisible: boolean
  togglePlotContentVisible: () => void
}

export function usePlotContextMenu(episodeId: string, options: UsePlotContextMenuOptions) {
  const { isPlotCenteredMode, plotContentVisible, togglePlotContentVisible } = options
  const file = useProjectStore(state => state.file)
  const episode = file?.episodes.find(e => e.id === episodeId)
  const plotBoxes = episode ? [...episode.plotBoxes].sort((a, b) => a.order - b.order) : []

  const selectedPlotBoxIds = useUIStore(selectSelectedPlotBoxIds)
  const setSelectedPlotBoxIds = useUIStore(state => state.setSelectedPlotBoxIds)
  const confirmedPlotBoxIds = useUIStore(selectConfirmedPlotBoxIds)
  const setConfirmedPlotBoxIds = useUIStore(state => state.setConfirmedPlotBoxIds)
  const setActivePlotBox = useUIStore(state => state.setActivePlotBox)
  const setScrollToPlotBoxId = useUIStore(state => state.setScrollToPlotBoxId)

  const { addPlotBoxUndoable, removePlotBoxUndoable, mergeSelectedPlotBoxesUndoable } = useUndoableProjectActions()

  const plotContextItems: ContextMenuItem[] = [
    ...(!isPlotCenteredMode
      ? [{ label: plotContentVisible ? '내용 숨김' : '내용 표시', action: togglePlotContentVisible }]
      : []),
    { label: '플롯 추가', action: () => addPlotBoxUndoable(episodeId) },
    { label: '전체 선택', action: () => setSelectedPlotBoxIds(plotBoxes.map(b => b.id)) },
  ]

  const buildPlotContextItems = useCallback(
    (role: PlotContextRole, boxId?: string): ContextMenuItem[] => {
      const base = [...plotContextItems]
      if (boxId == null) return base

      const plotIds = plotBoxes.map(b => b.id)
      const isSelected = selectedPlotBoxIds.includes(boxId)
      const isConfirmed = confirmedPlotBoxIds.includes(boxId)
      const idForMenu = boxId
      const addToSelection = (id: string) => {
        setSelectedPlotBoxIds(prev => prev.includes(id) ? prev : [...prev, id])
        setActivePlotBox(id)
      }

      if (isSelected) {
        const selectedOrdered = [...selectedPlotBoxIds].sort((a, b) => plotIds.indexOf(a) - plotIds.indexOf(b))
        const topmostId = selectedOrdered[0]
        const selectedMenuItems: ContextMenuItem[] = [
          ...base,
          { separator: true as const },
          { label: '모든 플롯 보이기', action: () => setConfirmedPlotBoxIds([...plotIds]) },
          { label: '모든 플롯 숨기기', action: () => setConfirmedPlotBoxIds([]) },
          ...(selectedPlotBoxIds.length >= 2
            ? [{
                label: '선택 합치기',
                action: () => {
                  mergeSelectedPlotBoxesUndoable(episodeId, selectedOrdered)
                  setSelectedPlotBoxIds([])
                  setActivePlotBox(topmostId)
                },
              } as ContextMenuItem]
            : []),
          {
            label: '플롯 보이기',
            action: () => {
              const merged = [...new Set([...confirmedPlotBoxIds, ...selectedPlotBoxIds])]
              const sorted = merged.sort((a, b) => plotIds.indexOf(a) - plotIds.indexOf(b))
              setConfirmedPlotBoxIds(sorted)
              setSelectedPlotBoxIds([])
            },
          },
          { label: '전체 선택 해제', action: () => setSelectedPlotBoxIds([]) },
          { label: '선택 해제', action: () => setSelectedPlotBoxIds(prev => prev.filter(id => id !== idForMenu)) },
          ...(isConfirmed
            ? ([
                { label: '해당 시나리오로 이동', action: () => setScrollToPlotBoxId(idForMenu) },
                {
                  label: '이 플롯만 숨기기',
                  action: () => setConfirmedPlotBoxIds(prev => prev.filter(id => id !== idForMenu)),
                },
                {
                  label: '플롯 숨기기',
                  action: () =>
                    setConfirmedPlotBoxIds(prev => prev.filter(id => !selectedPlotBoxIds.includes(id))),
                },
              ] as ContextMenuItem[])
            : []),
          {
            label: '선택 삭제',
            action: () => {
              const toRemove = [...selectedPlotBoxIds].sort(
                (a, b) => plotBoxes.findIndex(p => p.id === b) - plotBoxes.findIndex(p => p.id === a)
              )
              toRemove.forEach(id => removePlotBoxUndoable(episodeId, id))
              setSelectedPlotBoxIds([])
              const remaining = plotBoxes.filter(p => !toRemove.includes(p.id))
              if (remaining.length > 0) setActivePlotBox(remaining[0].id)
            },
          },
        ]
        return selectedMenuItems
      }

      const unselectedItems: ContextMenuItem[] = [
        ...base,
        { separator: true as const },
        { label: '모든 플롯 보이기', action: () => setConfirmedPlotBoxIds([...plotIds]) },
        { label: '모든 플롯 숨기기', action: () => setConfirmedPlotBoxIds([]) },
        { label: '선택', action: () => addToSelection(idForMenu) },
      ]
      if (!isConfirmed) {
        unselectedItems.push({
          label: '플롯 보이기',
          action: () => {
            const merged = [...new Set([...confirmedPlotBoxIds, idForMenu])].sort(
              (a, b) => plotIds.indexOf(a) - plotIds.indexOf(b)
            )
            setConfirmedPlotBoxIds(merged)
            setActivePlotBox(idForMenu)
          },
        })
      } else {
        unselectedItems.push({ label: '해당 시나리오로 이동', action: () => setScrollToPlotBoxId(idForMenu) })
        const hideThisOnly = () => setConfirmedPlotBoxIds(prev => prev.filter(id => id !== idForMenu))
        unselectedItems.push({ label: '이 플롯만 숨기기', action: hideThisOnly })
      }
      return unselectedItems
    },
    [
      plotContextItems,
      plotBoxes,
      selectedPlotBoxIds,
      confirmedPlotBoxIds,
      setConfirmedPlotBoxIds,
      setSelectedPlotBoxIds,
      setActivePlotBox,
      setScrollToPlotBoxId,
      episodeId,
      removePlotBoxUndoable,
      mergeSelectedPlotBoxesUndoable,
    ]
  )

  return { plotContextItems, buildPlotContextItems }
}
