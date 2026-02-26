import { useRef, useEffect, useCallback, useState } from 'react'
import { useUIStore } from '@/store/ui/uiStore'
import type { ScriptUnit } from '@/types/sw'

/** 드래그 선택 직후 클릭 시 즉시 선택 해제 방지용 디바운스 (ms) */
const DRAG_SELECT_DEBOUNCE_MS = 150

interface UseScriptSelectionParams {
  scriptUnits: ScriptUnit[]
  selectedScriptUnitIds: string[]
  setSelectedScriptUnitIds: (ids: string[] | ((prev: string[]) => string[])) => void
  activeUnitId: string | null
  setActiveUnitId: (id: string | null) => void
  textareaRefs: React.MutableRefObject<Map<string, HTMLTextAreaElement>>
  /** 선택 유지하면서 포커스 복원 시, onFocus에서 선택 해제 스킵용 */
  restoreFocusUnitIdRef?: React.MutableRefObject<string | null>
  /** 선택 중 Delete/Backspace 시 선택 요소 삭제 (있을 때만) */
  onDeleteSelected?: (unitIds: string[]) => void
}

export function useScriptSelection({
  scriptUnits,
  selectedScriptUnitIds,
  setSelectedScriptUnitIds,
  activeUnitId,
  setActiveUnitId,
  textareaRefs,
  restoreFocusUnitIdRef,
  onDeleteSelected,
}: UseScriptSelectionParams) {
  const setSelectedPlotBoxIds = useUIStore(state => state.setSelectedPlotBoxIds)
  const dragSelectStartRef = useRef<string | null>(null)
  const dragSelectStartedInTextareaRef = useRef(false)
  const lastDragSelectTimeRef = useRef(0)
  const dragSelectDidUpdateRef = useRef(false)
  const [isDragSelecting, setIsDragSelecting] = useState(false)

  const handleDragSelectStart = useCallback((unitId: string, fromTextarea?: boolean) => {
    dragSelectStartRef.current = unitId
    dragSelectStartedInTextareaRef.current = fromTextarea === true
    dragSelectDidUpdateRef.current = false
    setIsDragSelecting(true)
  }, [])

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (dragSelectStartRef.current == null) return
      // 텍스트 영역에서 시작한 드래그는 브라우저 텍스트 선택이 되도록 preventDefault 하지 않음
      if (!dragSelectStartedInTextareaRef.current) e.preventDefault()
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const unitEl = el?.closest?.('[data-unit-id]') as HTMLElement | null
      const endId = unitEl?.dataset?.unitId
      if (!endId || endId === dragSelectStartRef.current) return
      const startIdx = scriptUnits.findIndex(u => u.id === dragSelectStartRef.current)
      const endIdx = scriptUnits.findIndex(u => u.id === endId)
      if (startIdx === -1 || endIdx === -1) return
      const lo = Math.min(startIdx, endIdx)
      const hi = Math.max(startIdx, endIdx)
      const ids = scriptUnits.slice(lo, hi + 1).map(u => u.id)
      setSelectedPlotBoxIds([])
      setSelectedScriptUnitIds(ids)
      setActiveUnitId(endId)
      dragSelectDidUpdateRef.current = true
      // 텍스트 드래그로 선택 확장 시 인라인(텍스트) 선택은 끔 — 스크립트 유닛 선택만 확장
      if (dragSelectStartedInTextareaRef.current) document.getSelection()?.removeAllRanges()
    }
    const onPointerUp = () => {
      if (dragSelectStartRef.current != null && dragSelectDidUpdateRef.current) {
        lastDragSelectTimeRef.current = Date.now()
      }
      dragSelectStartRef.current = null
      dragSelectStartedInTextareaRef.current = false
      setIsDragSelecting(false)
    }
    document.addEventListener('pointermove', onPointerMove, { passive: false })
    document.addEventListener('pointerup', onPointerUp)
    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
    }
  }, [scriptUnits, setSelectedPlotBoxIds, setSelectedScriptUnitIds, setActiveUnitId])

  /** 외부에서 플롯 선택 시 스크립트 선택 해제 (예: PlotEditor P 버튼 클릭) */
  useEffect(() => {
    const handler = () => setSelectedScriptUnitIds([])
    document.addEventListener('clear-script-selection', handler)
    return () => document.removeEventListener('clear-script-selection', handler)
  }, [setSelectedScriptUnitIds])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedScriptUnitIds([])
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedScriptUnitIds.length >= 1 && onDeleteSelected) {
        const target = e.target as Node
        const isInTextarea = [...textareaRefs.current.values()].some(ta => ta.contains?.(target))
        if (isInTextarea) return
        e.preventDefault()
        onDeleteSelected([...selectedScriptUnitIds])
        setSelectedScriptUnitIds([])
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [setSelectedScriptUnitIds, selectedScriptUnitIds, onDeleteSelected, textareaRefs])

  /** 텍스트 영역(textarea) 내 선택은 유닛 선택과 분리: textarea 안에서의 selectionchange는 무시해 텍스트 포커싱/텍스트 선택과 유닛 선택이 겹치지 않게 함 */
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = document.getSelection()
      if (!sel || sel.isCollapsed) return
      const node = sel.anchorNode
      if (!node) return
      for (const [, ta] of textareaRefs.current) {
        if (ta.contains(node)) return
      }
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [textareaRefs])

  /** groupUnitIds: 다중 문단(대사 그룹)일 때, 클릭 시 제일 위 유닛을 선택 중심으로 전체 그룹 선택. 단, textarea 클릭은 포커싱 목적이므로 개별 선택만. */
  const handleUnitSelect = useCallback(
    (e: React.MouseEvent, unitId: string, groupUnitIds?: string[]) => {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const clickedTextarea = (e.target as HTMLElement).closest?.('textarea') != null
        if (clickedTextarea) {
          setSelectedPlotBoxIds([])
          setSelectedScriptUnitIds([unitId])
          setActiveUnitId(unitId)
          return
        }
        const wasEditingThisUnit = activeUnitId === unitId || (groupUnitIds != null && groupUnitIds.includes(activeUnitId ?? ''))
        if (!wasEditingThisUnit) document.getSelection()?.removeAllRanges()
        if (Date.now() - lastDragSelectTimeRef.current < DRAG_SELECT_DEBOUNCE_MS) {
          setActiveUnitId(groupUnitIds?.[0] ?? unitId)
          return
        }
        if (document.activeElement instanceof HTMLTextAreaElement && [...textareaRefs.current.values()].includes(document.activeElement)) {
          document.activeElement.blur()
        }
        setSelectedPlotBoxIds([])
        if (groupUnitIds?.length) {
          setSelectedScriptUnitIds(groupUnitIds)
          setActiveUnitId(groupUnitIds[0])
        } else {
          setSelectedScriptUnitIds([unitId])
          setActiveUnitId(unitId)
        }
        return
      }
      if (e.shiftKey) {
        if (document.activeElement instanceof HTMLTextAreaElement && [...textareaRefs.current.values()].includes(document.activeElement)) {
          document.activeElement.blur()
        }
        setSelectedScriptUnitIds(prev => {
          const lastId = prev.length > 0 ? prev[prev.length - 1] : activeUnitId
          const lastIdx = lastId != null ? scriptUnits.findIndex(u => u.id === lastId) : -1
          const clickIdx = scriptUnits.findIndex(u => u.id === unitId)
          if (lastIdx === -1 || clickIdx === -1) return [unitId]
          const lo = Math.min(lastIdx, clickIdx)
          const hi = Math.max(lastIdx, clickIdx)
          return scriptUnits.slice(lo, hi + 1).map(u => u.id)
        })
        setActiveUnitId(unitId)
        return
      }
      if (e.ctrlKey || e.metaKey) {
        if (document.activeElement instanceof HTMLTextAreaElement) {
          const isOurTextarea = [...textareaRefs.current.values()].includes(document.activeElement)
          if (isOurTextarea) document.activeElement.blur()
        }
        setSelectedScriptUnitIds(prev =>
          prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
        )
        setActiveUnitId(unitId)
      } else {
        setSelectedScriptUnitIds([])
        setActiveUnitId(unitId)
      }
    },
    [
      scriptUnits,
      activeUnitId,
      setSelectedScriptUnitIds,
      setActiveUnitId,
      setSelectedPlotBoxIds,
      textareaRefs,
      restoreFocusUnitIdRef,
    ]
  )

  return { handleUnitSelect, handleDragSelectStart, isDragSelecting }
}
