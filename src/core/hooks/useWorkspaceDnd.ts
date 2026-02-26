import { useCallback, useMemo, useRef, useState } from 'react'
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore } from '@/store/ui/uiStore'
import { useUndoableProjectActions } from '@/hooks/useUndoableActions'
import type { ScriptUnit } from '@/types/sw'
import { PLOT_TARGET_PREFIX, PLOT_TARGET_SCENARIO_PREFIX, INSERT_BEFORE_PREFIX, INSERT_AFTER_PREFIX } from '@/components/editor/constants'
import { createScriptDropCollision } from '@/hooks/script/scriptDropCollision'

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

const DEFAULT_PLOT_OVERLAY_WIDTH = 320

export interface UseWorkspaceDndOptions {
  episodeId: string
  onDropOverChange?: (overId: string | null) => void
  onScriptMovedToPlot?: (plotBoxId: string, unitIds: string[]) => void
  /** 플롯 박스 드래그 시작 시 오버레이 너비 설정 (렌더 중 ref 접근 회피용) */
  setPlotOverlayWidth?: (width: number) => void
}

export function useWorkspaceDnd({
  episodeId,
  onDropOverChange,
  onScriptMovedToPlot,
  setPlotOverlayWidth,
}: UseWorkspaceDndOptions) {
  const projectStore = useProjectStore()
  const selectedScriptUnitIds = useUIStore(state => state.selectedScriptUnitIds)
  const confirmedPlotBoxIds = useUIStore(state => state.confirmedPlotBoxIds)
  const activePlotBoxId = useUIStore(state => state.activePlotBoxId)
  const file = useProjectStore(state => state.file)
  const episode = file?.episodes.find(e => e.id === episodeId)
  const plotBoxes = episode?.plotBoxes ?? []
  const plotBoxesSorted = useMemo(() => [...plotBoxes].sort((a, b) => a.order - b.order), [plotBoxes])
  const displayPlotIds = useMemo(() => {
    const ids = confirmedPlotBoxIds.filter(id => plotBoxesSorted.some(p => p.id === id))
    return [...ids].sort((a, b) => {
      const ia = plotBoxesSorted.findIndex(p => p.id === a)
      const ib = plotBoxesSorted.findIndex(p => p.id === b)
      return ia - ib
    })
  }, [confirmedPlotBoxIds, plotBoxesSorted])
  const displayPlots = useMemo(
    () => displayPlotIds.map(id => plotBoxesSorted.find(p => p.id === id)).filter((p): p is NonNullable<typeof p> => p != null),
    [displayPlotIds, plotBoxesSorted]
  )
  const combinedScriptUnits = useMemo(() => {
    const out: { unit: ScriptUnit; plotBoxId: string }[] = []
    displayPlots.forEach(plot => {
      const units = [...(plot.scriptUnits || [])].sort((a, b) => a.order - b.order)
      units.forEach(unit => out.push({ unit, plotBoxId: plot.id }))
    })
    return out
  }, [displayPlots])
  const scriptUnits = useMemo(() => combinedScriptUnits.map(({ unit }) => unit), [combinedScriptUnits])
  const getPlotBoxIdForUnit = useCallback((unitId: string) => combinedScriptUnits.find(({ unit }) => unit.id === unitId)?.plotBoxId, [combinedScriptUnits])
  const {
    reorderScriptUnitGroupUndoable,
    reorderScriptUnitsUndoable,
    moveScriptUnitsByIdsUndoable,
    moveScriptUnitsToPlotBoxUndoable,
    moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable,
    insertPlotContentAtScenarioUndoable,
    reorderPlotBoxesUndoable,
  } = useUndoableProjectActions()

  const lastOverIdRef = useRef<string | null>(null)
  const [activePlotDragId, setActivePlotDragId] = useState<string | null>(null)
  const [activeScriptDragIds, setActiveScriptDragIds] = useState<string[]>([])

  const isPlotBoxId = useCallback((id: string) => plotBoxesSorted.some(p => p.id === id), [plotBoxesSorted])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id)
    if (isPlotBoxId(id)) {
      const w = event.active.rect.current?.initial?.width
      setPlotOverlayWidth?.(typeof w === 'number' ? w : DEFAULT_PLOT_OVERLAY_WIDTH)
      setActivePlotDragId(id)
    } else {
      const ids =
        selectedScriptUnitIds.length >= 2 && selectedScriptUnitIds.includes(id)
          ? selectedScriptUnitIds
          : [id]
      setActiveScriptDragIds(ids)
    }
  }, [isPlotBoxId, selectedScriptUnitIds, setPlotOverlayWidth])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const id = event.over?.id != null ? String(event.over.id) : null
    lastOverIdRef.current = id
    onDropOverChange?.(id)
  }, [onDropOverChange])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const activeIdStr = String(active.id)
    const isPlotBox = isPlotBoxId(activeIdStr)
    const effectiveOver = over ?? (lastOverIdRef.current ? { id: lastOverIdRef.current } : null)
    lastOverIdRef.current = null

    if (isPlotBox) setActivePlotDragId(null)
    else setActiveScriptDragIds([])

    if (!effectiveOver || active.id === effectiveOver.id) return
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
    // 1) Plot box → plot-target-{plotId} 또는 plot-target-s-{plotId}: insert plot content at scenario
    const plotBoxOverPlotId = overId.startsWith(PLOT_TARGET_SCENARIO_PREFIX) ? overId.slice(PLOT_TARGET_SCENARIO_PREFIX.length) : (overId.startsWith(PLOT_TARGET_PREFIX) ? overId.slice(PLOT_TARGET_PREFIX.length) : null)
    if (isPlotBox && plotBoxOverPlotId !== null) {
      const toPlotId = plotBoxOverPlotId
      const targetPlot = plotBoxesSorted.find(p => p.id === toPlotId)
      if (targetPlot) insertPlotContentAtScenarioUndoable(episodeId, activeIdStr, toPlotId, targetPlot.scriptUnits.length)
      return
    }

    // 2) Plot box → plot box: reorder
    if (isPlotBox) {
      const oldIndex = plotBoxesSorted.findIndex(p => p.id === activeIdStr)
      const newIndex = plotBoxesSorted.findIndex(p => p.id === overId)
      if (oldIndex !== -1 && newIndex !== -1) reorderPlotBoxesUndoable(episodeId, oldIndex, newIndex)
      return
    }

    // 3) Script unit/group → plot-target-{plotId} 또는 plot-target-s-{plotId}: 해당 플롯박스 최하단으로 이동. 확정 1개여도 트리거 허용
    const plotTargetMatch = overId.startsWith(PLOT_TARGET_SCENARIO_PREFIX) ? overId.slice(PLOT_TARGET_SCENARIO_PREFIX.length) : (overId.startsWith(PLOT_TARGET_PREFIX) ? overId.slice(PLOT_TARGET_PREFIX.length) : null)
    if (plotTargetMatch !== null && displayPlots.length >= 1) {
      const toPlotId = plotTargetMatch
      const targetPlot = plotBoxesSorted.find(p => p.id === toPlotId)
      const insertAtEnd = targetPlot ? targetPlot.scriptUnits.length : undefined
      const isSelectionBlockDrag = selectedScriptUnitIds.length >= 2 && selectedScriptUnitIds.includes(activeIdStr)
      const unitIds = isSelectionBlockDrag ? selectedScriptUnitIds : [activeIdStr]
      const groups = buildGroupsInSelectionOrder(unitIds, getPlotBoxIdForUnit)
      if (groups.length === 0) return
      const fromPlotIds = new Set(groups.map(g => g.fromPlotId))
      if (fromPlotIds.has(toPlotId) && fromPlotIds.size === 1) return
      if (groups.length > 1 && moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable) {
        moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable(episodeId, toPlotId, insertAtEnd, groups)
        onScriptMovedToPlot?.(toPlotId, unitIds)
      } else if (moveScriptUnitsToPlotBoxUndoable) {
        const fromPlotId = getPlotBoxIdForUnit(unitIds[0]) ?? activePlotBoxId
        if (fromPlotId && fromPlotId !== toPlotId) {
          moveScriptUnitsToPlotBoxUndoable(episodeId, fromPlotId, toPlotId, unitIds, insertAtEnd)
          onScriptMovedToPlot?.(toPlotId, unitIds)
        }
      }
      return
    }

    // 4) Script unit/group → script unit: reorder within plot (선택 그룹·캐릭터 그룹 통합)
    if (!activePlotBoxId || !getPlotBoxIdForUnit || displayPlots.length < 1) return
    const groupPlotId = getPlotBoxIdForUnit(activeIdStr) ?? activePlotBoxId
    const isSelectionBlockDrag = selectedScriptUnitIds.length >= 2 && selectedScriptUnitIds.includes(activeIdStr)

    if (isSelectionBlockDrag) {
      const unitIds = selectedScriptUnitIds
      const samePlot = scriptUnits.filter(u => getPlotBoxIdForUnit(u.id) === groupPlotId)
      const indices = unitIds.map(id => samePlot.findIndex(u => u.id === id)).filter(i => i >= 0)
      if (indices.length !== unitIds.length) return
      const fromStartIndex = Math.min(...indices)
      const fromEndIndex = Math.max(...indices)
      const isContiguous = fromEndIndex - fromStartIndex + 1 === unitIds.length
      const baseToIndex = samePlot.findIndex(u => u.id === overId)
      if (baseToIndex === -1 || getPlotBoxIdForUnit(overId) !== groupPlotId) return
      const toIndex = insertAfter ? baseToIndex + 1 : baseToIndex
      if (toIndex >= fromStartIndex && toIndex < fromStartIndex + unitIds.length) return
      if (isContiguous && reorderScriptUnitGroupUndoable) reorderScriptUnitGroupUndoable(episodeId, groupPlotId, fromStartIndex, unitIds.length, toIndex)
      else if (moveScriptUnitsByIdsUndoable) moveScriptUnitsByIdsUndoable(episodeId, groupPlotId, unitIds, toIndex)
      return
    }

    // Single script unit reorder 또는 타 플롯 이동 (plotIdA !== plotIdB)
    const plotIdA = getPlotBoxIdForUnit(activeIdStr)
    const plotIdB = getPlotBoxIdForUnit(overId)
    const plotBoxId = plotIdA ?? plotIdB ?? activePlotBoxId
    if (!plotBoxId) return
    if (plotIdA != null && plotIdB != null && plotIdA !== plotIdB && displayPlots.length > 1) {
      const toPlotUnits = scriptUnits.filter(u => getPlotBoxIdForUnit(u.id) === plotIdB)
      const refIndex = toPlotUnits.findIndex(u => u.id === overId)
      const insertIndex = refIndex >= 0 ? (insertAfter ? refIndex + 1 : refIndex) : undefined
      const isSelectionBlockDrag = selectedScriptUnitIds.length >= 2 && selectedScriptUnitIds.includes(activeIdStr)
      const unitIds = isSelectionBlockDrag ? selectedScriptUnitIds : [activeIdStr]
      const groups = buildGroupsInSelectionOrder(unitIds, getPlotBoxIdForUnit)
      if (groups.length > 1 && moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable) {
        moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable(episodeId, plotIdB, insertIndex, groups)
        onScriptMovedToPlot?.(plotIdB, unitIds)
      } else if (moveScriptUnitsToPlotBoxUndoable) {
        const unitIdsFromFromPlot = unitIds.filter(id => getPlotBoxIdForUnit(id) === plotIdA)
        const ids = unitIdsFromFromPlot.length > 0 ? unitIdsFromFromPlot : [activeIdStr]
        moveScriptUnitsToPlotBoxUndoable(episodeId, plotIdA, plotIdB, ids, insertIndex)
        onScriptMovedToPlot?.(plotIdB, ids)
      }
      return
    }
    if (plotIdA !== plotIdB) return
    const samePlot = scriptUnits.filter(u => getPlotBoxIdForUnit(u.id) === plotBoxId)
    const oldIndex = samePlot.findIndex(u => u.id === activeIdStr)
    const baseNewIndex = samePlot.findIndex(u => u.id === overId)
    if (baseNewIndex === -1) return
    const newIndex = insertAfter ? baseNewIndex + 1 : baseNewIndex
    if (oldIndex !== -1 && newIndex >= 0 && newIndex <= samePlot.length) reorderScriptUnitsUndoable(episodeId, plotBoxId, oldIndex, newIndex)
  }, [
    episodeId,
    plotBoxesSorted,
    scriptUnits,
    activePlotBoxId,
    displayPlots.length,
    getPlotBoxIdForUnit,
    selectedScriptUnitIds,
    isPlotBoxId,
    reorderScriptUnitsUndoable,
    reorderPlotBoxesUndoable,
    reorderScriptUnitGroupUndoable,
    moveScriptUnitsByIdsUndoable,
    moveScriptUnitsToPlotBoxUndoable,
    moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable,
    insertPlotContentAtScenarioUndoable,
    onScriptMovedToPlot,
  ])

  const collisionDetection = useMemo(
    () => createScriptDropCollision(isPlotBoxId),
    [isPlotBoxId]
  )

  return {
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    collisionDetection,
    activePlotDragId,
    activeScriptDragIds,
  }
}
