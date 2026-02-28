import { useRef } from 'react'
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { ScriptUnit } from '@/types/sw'
import { PLOT_TARGET_PREFIX, INSERT_BEFORE_PREFIX, INSERT_AFTER_PREFIX } from '@/components/editor/constants'

export { PLOT_TARGET_PREFIX } from '@/components/editor/constants'

/** 선택 순서대로 유닛을 플롯별로 묶음. 여러 플롯에 걸친 선택 시 사용. */
function buildGroupsInSelectionOrder(
  unitIds: string[],
  getPlotBoxIdForUnit: (id: string) => string | undefined
): { fromPlotId: string; unitIds: string[] }[] {
  const groups: { fromPlotId: string; unitIds: string[] }[] = []
  const plotIndex = new Map<string, number>()
  for (const id of unitIds) {
    const plotId = getPlotBoxIdForUnit(id)
    if (!plotId) continue
    let idx = plotIndex.get(plotId)
    if (idx === undefined) {
      idx = groups.length
      plotIndex.set(plotId, idx)
      groups.push({ fromPlotId: plotId, unitIds: [] })
    }
    groups[idx].unitIds.push(id)
  }
  return groups.filter(g => g.unitIds.length > 0)
}

interface UseScriptDndOptions {
  episodeId: string
  activePlotBoxId: string | null
  scriptUnits: ScriptUnit[]
  reorderScriptUnitsUndoable?: (episodeId: string, plotBoxId: string, oldIndex: number, newIndex: number) => void
  reorderScriptUnitGroupUndoable?: (episodeId: string, plotBoxId: string, fromStartIndex: number, fromCount: number, toIndex: number) => void
  moveScriptUnitsByIdsUndoable?: (episodeId: string, plotBoxId: string, unitIds: string[], toIndex: number) => void
  moveScriptUnitsToPlotBoxUndoable?: (episodeId: string, fromPlotId: string, toPlotId: string, unitIds: string[], insertIndex?: number) => void
  moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable?: (episodeId: string, toPlotId: string, insertIndex: number | undefined, groups: { fromPlotId: string; unitIds: string[] }[]) => void
  getPlotBoxIdForUnit?: (unitId: string) => string | undefined
  selectedScriptUnitIds?: string[]
  onScriptMovedToPlot?: (plotBoxId: string, unitIds: string[]) => void
  /** 드래그 중 드롭 위치 피드백용 (over id 전달) */
  onDropOverChange?: (overId: string | null) => void
}

export function useScriptDnd({
  episodeId,
  activePlotBoxId,
  scriptUnits,
  reorderScriptUnitsUndoable,
  reorderScriptUnitGroupUndoable,
  moveScriptUnitsByIdsUndoable,
  moveScriptUnitsToPlotBoxUndoable,
  moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable,
  getPlotBoxIdForUnit,
  selectedScriptUnitIds = [],
  onScriptMovedToPlot,
  onDropOverChange,
}: UseScriptDndOptions) {
  const lastOverIdRef = useRef<string | null>(null)

  const handleDragOver = (event: DragOverEvent) => {
    const id = event.over?.id != null ? String(event.over.id) : null
    lastOverIdRef.current = id
    onDropOverChange?.(id)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const activeIdStr = String(active.id)
    const effectiveOver = over ?? (lastOverIdRef.current != null ? { id: lastOverIdRef.current } : null)
    lastOverIdRef.current = null
    if (!effectiveOver || active.id === effectiveOver.id || !activePlotBoxId) return

    const activeId = activeIdStr
    const rawOverId = String(effectiveOver.id)
    let overId: string
    let insertAfter = false
    if (rawOverId.startsWith(INSERT_AFTER_PREFIX)) {
      overId = rawOverId.slice(INSERT_AFTER_PREFIX.length)
      insertAfter = true
    } else if (rawOverId.startsWith(INSERT_BEFORE_PREFIX)) {
      overId = rawOverId.slice(INSERT_BEFORE_PREFIX.length)
    } else {
      overId = rawOverId
    }
    const isSelectionBlockDrag = selectedScriptUnitIds.length >= 2 && selectedScriptUnitIds.includes(activeId)
    const unitIds = isSelectionBlockDrag ? selectedScriptUnitIds : [activeId]
    const groups = getPlotBoxIdForUnit ? buildGroupsInSelectionOrder(unitIds, getPlotBoxIdForUnit) : []

    if (isSelectionBlockDrag && groups.length > 0) {
      const groupPlotId = getPlotBoxIdForUnit?.(unitIds[0]) ?? activePlotBoxId
      const overPlotId = getPlotBoxIdForUnit?.(overId)
      const isDropOnOtherPlot = overPlotId != null && groupPlotId !== overPlotId

      const moveMulti = moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable
      if (isDropOnOtherPlot && groups.length > 1 && moveMulti && overPlotId) {
        const toPlotUnits = scriptUnits.filter(u => getPlotBoxIdForUnit?.(u.id) === overPlotId)
        const refIndex = toPlotUnits.findIndex(u => u.id === overId)
        const insertIndex = refIndex >= 0 ? (insertAfter ? refIndex + 1 : refIndex) : undefined
        moveMulti(episodeId, overPlotId, insertIndex, groups)
        onScriptMovedToPlot?.(overPlotId, unitIds)
        return
      }
      const moveToPlot = moveScriptUnitsToPlotBoxUndoable
      if (isDropOnOtherPlot && moveToPlot && groupPlotId && overPlotId && groupPlotId !== overPlotId) {
        const idsFromPlot = unitIds.filter(id => getPlotBoxIdForUnit?.(id) === groupPlotId)
        const ids = idsFromPlot.length > 0 ? idsFromPlot : [activeId]
        const toPlotUnits = scriptUnits.filter(u => getPlotBoxIdForUnit?.(u.id) === overPlotId)
        const refIndex = toPlotUnits.findIndex(u => u.id === overId)
        const insertIndex = refIndex >= 0 ? (insertAfter ? refIndex + 1 : refIndex) : undefined
        moveToPlot(episodeId, groupPlotId, overPlotId, ids, insertIndex)
        onScriptMovedToPlot?.(overPlotId, ids)
        return
      }

      if (!isDropOnOtherPlot && groupPlotId) {
        const samePlotUnits = scriptUnits.filter(u => getPlotBoxIdForUnit?.(u.id) === groupPlotId)
        const indices = unitIds.map(id => samePlotUnits.findIndex(u => u.id === id)).filter(i => i >= 0)
        if (indices.length === unitIds.length) {
          const fromStartIndex = Math.min(...indices)
          const fromEndIndex = Math.max(...indices)
          const isContiguous = fromEndIndex - fromStartIndex + 1 === unitIds.length
          const baseToIndex = samePlotUnits.findIndex(u => u.id === overId)
          if (baseToIndex !== -1) {
            const toIndex = insertAfter ? baseToIndex + 1 : baseToIndex
            if (toIndex < fromStartIndex || toIndex >= fromStartIndex + unitIds.length) {
              const reorder = reorderScriptUnitGroupUndoable
              const moveByIds = moveScriptUnitsByIdsUndoable
              if (isContiguous && reorder) {
                reorder(episodeId, groupPlotId, fromStartIndex, unitIds.length, toIndex)
              } else if (moveByIds) {
                moveByIds(episodeId, groupPlotId, unitIds, toIndex)
              }
            }
          }
        }
        return
      }
    }

    // Cross-plot drop: over is plot-target-${plotBoxId}
    if (overId.startsWith(PLOT_TARGET_PREFIX)) {
      const toPlotId = overId.slice(PLOT_TARGET_PREFIX.length)
      const fromPlotId = getPlotBoxIdForUnit?.(unitIds[0])
      if (!fromPlotId || fromPlotId === toPlotId || unitIds.length === 0) return
      if (groups.length > 1 && moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable) {
        moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable(episodeId, toPlotId, undefined, groups)
        onScriptMovedToPlot?.(toPlotId, unitIds)
      } else if (moveScriptUnitsToPlotBoxUndoable) {
        moveScriptUnitsToPlotBoxUndoable(episodeId, fromPlotId, toPlotId, unitIds)
        onScriptMovedToPlot?.(toPlotId, unitIds)
      }
      return
    }

    const plotIdA = getPlotBoxIdForUnit?.(String(active.id))
    const plotIdB = getPlotBoxIdForUnit?.(overId)
    const plotBoxId = plotIdA ?? plotIdB ?? activePlotBoxId
    if (getPlotBoxIdForUnit && (plotIdA !== plotIdB || !plotBoxId)) return
    const samePlotUnits = getPlotBoxIdForUnit
      ? scriptUnits.filter(u => getPlotBoxIdForUnit(u.id) === plotBoxId)
      : scriptUnits
    const oldIndex = samePlotUnits.findIndex(unit => unit.id === String(active.id))
    const baseNewIndex = samePlotUnits.findIndex(unit => unit.id === overId)
    if (baseNewIndex === -1) return
    const newIndex = insertAfter ? baseNewIndex + 1 : baseNewIndex
    if (oldIndex !== -1 && newIndex >= 0 && newIndex <= samePlotUnits.length && plotBoxId && reorderScriptUnitsUndoable) {
      reorderScriptUnitsUndoable(episodeId, plotBoxId, oldIndex, newIndex)
    }
  }

  return { sensors, handleDragEnd, handleDragOver }
}
