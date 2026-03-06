import { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore, selectSelectedPlotBoxIds, selectConfirmedPlotBoxIds } from '@/store/ui/uiStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { useUndoableProjectActions } from '@/hooks/useUndoableActions'
import { usePlotContextMenu } from '@/hooks/usePlotContextMenu'
import { ContextMenu, useContextMenu } from '@/components/ui/ContextMenu'
import { cn } from '@/lib/utils'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { keyedDebounce } from '@/lib/debounce'
import { SortablePlotBox } from './SortablePlotBox'
import { PlotPButton } from './PlotPButton'
import { PlotDropTarget } from './plot/PlotDropTarget'
import { HorizontalCompactPlotRow } from './plot/HorizontalCompactPlotRow'
import { useWorkspaceDndContext } from '@/components/layout/WorkspaceDndWrapper'
import { PlotEditorHeader } from './PlotEditorHeader'
import { Tooltip } from '@/components/ui/Tooltip'
type LayoutMode = 'vertical' | 'horizontal'

interface PlotEditorProps {
  episodeId: string
  /** vertical: 상하 분할(높이 기준). horizontal: 좌우 분할(너비 기준, 1단계 아이콘+제목 / 2단계 아이콘만) */
  layoutMode?: LayoutMode
  useExternalDndContext?: boolean
}

export function PlotEditor({ episodeId, layoutMode, useExternalDndContext = false }: PlotEditorProps) {
  const file = useProjectStore(state => state.file)
  const mergePlotBoxes = useProjectStore(state => state.mergePlotBoxes)
  const activePlotBoxId = useUIStore(state => state.activePlotBoxId)
  const setActivePlotBox = useUIStore(state => state.setActivePlotBox)
  const selectedPlotBoxIds = useUIStore(selectSelectedPlotBoxIds)
  const setSelectedPlotBoxIds = useUIStore(state => state.setSelectedPlotBoxIds)
  const clearAllSelection = useUIStore(state => state.clearAllSelection)
  const confirmedPlotBoxIds = useUIStore(selectConfirmedPlotBoxIds)
  const setConfirmedPlotBoxIds = useUIStore(state => state.setConfirmedPlotBoxIds)
  const requestScenarioFocus = useUIStore(state => state.requestScenarioFocus)
  const plotContentVisible = useUIStore(state => state.plotContentVisible)
  const togglePlotContentVisible = useUIStore(state => state.togglePlotContentVisible)
  
  const {
    addPlotBoxUndoable,
    insertPlotBoxAtUndoable,
    removePlotBoxUndoable,
    reorderPlotBoxesUndoable,
    splitPlotBoxByContentUndoable,
    updatePlotBoxUndoable,
    updateEpisodeUndoable,
  } = useUndoableProjectActions()

  const PLOT_DEBOUNCE_MS = 280
  const episodeIdRef = useRef(episodeId)
  const prevEpisodeIdRef = useRef<string | null>(null)
  episodeIdRef.current = episodeId
  const [draftTitleByPlotId, setDraftTitleByPlotId] = useState<Record<string, string>>({})
  const [draftContentByPlotId, setDraftContentByPlotId] = useState<Record<string, string>>({})
  const pendingTitleRef = useRef<Record<string, string>>({})
  const pendingContentRef = useRef<Record<string, string>>({})
  const titleDebounceRef = useRef<ReturnType<typeof keyedDebounce<string>> | null>(null)
  const contentDebounceRef = useRef<ReturnType<typeof keyedDebounce<string>> | null>(null)
  if (titleDebounceRef.current === null) {
    titleDebounceRef.current = keyedDebounce<string>((plotId, value) => {
      const title = value as string
      setDraftTitleByPlotId(prev => { const n = { ...prev }; delete n[plotId]; return n })
      if (selectedPlotBoxIds.length >= 1) setSelectedPlotBoxIds([])
      updatePlotBoxUndoable(episodeIdRef.current, plotId, { title })
    }, PLOT_DEBOUNCE_MS)
  }
  if (contentDebounceRef.current === null) {
    contentDebounceRef.current = keyedDebounce<string>((plotId, value) => {
      const content = value as string
      setDraftContentByPlotId(prev => { const n = { ...prev }; delete n[plotId]; return n })
      if (selectedPlotBoxIds.length >= 1) setSelectedPlotBoxIds([])
      updatePlotBoxUndoable(episodeIdRef.current, plotId, { content })
    }, PLOT_DEBOUNCE_MS)
  }
  const titleDebounce = titleDebounceRef.current
  const contentDebounce = contentDebounceRef.current
  const flushPlotTitle = useCallback((plotId: string) => { titleDebounce.flush(plotId) }, [])
  const flushPlotContent = useCallback((plotId: string) => { contentDebounce.flush(plotId) }, [])
  const handlePlotTitle = useCallback((plotId: string, title: string) => {
    setDraftTitleByPlotId(prev => ({ ...prev, [plotId]: title }))
    pendingTitleRef.current[plotId] = title
    titleDebounce.schedule(plotId, () => pendingTitleRef.current[plotId])
  }, [])
  const handlePlotContent = useCallback((plotId: string, content: string) => {
    setDraftContentByPlotId(prev => ({ ...prev, [plotId]: content }))
    pendingContentRef.current[plotId] = content
    contentDebounce.schedule(plotId, () => pendingContentRef.current[plotId])
  }, [])
  
  const [focusBoxIndex, setFocusBoxIndex] = useState<number | null>(null)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editingEpisodeSubtitle, setEditingEpisodeSubtitle] = useState(false)
  const [panelHeight, setPanelHeight] = useState(0)
  const [panelRange, setPanelRange] = useState<{ min: number; max: number } | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const plotListRef = useRef<HTMLDivElement>(null)
  const overlayWidthRef = useRef<number>(320)
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map())
  const titleInputRef = useRef<HTMLInputElement>(null)
  const centeredTitleInputRef = useRef<HTMLInputElement>(null)
  const plotStripScrollRef = useRef<HTMLDivElement>(null)
  const plotStripHorizontalRef = useRef<HTMLDivElement>(null)
  const bodyClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const PLOT_STRIP_ITEM_HEIGHT = 28
  const PLOT_STRIP_STEP = 4
  const scrollPlotStrip = useCallback((direction: 'up' | 'down') => {
    const el = plotStripScrollRef.current
    if (!el) return
    const delta = PLOT_STRIP_ITEM_HEIGHT * PLOT_STRIP_STEP * (direction === 'up' ? -1 : 1)
    el.scrollBy({ top: delta, behavior: 'smooth' })
  }, [])
  const workspaceDnd = useWorkspaceDndContext()
  const [localPlotDragId, setLocalPlotDragId] = useState<string | null>(null)
  const [overlayWidthForOverlay, setOverlayWidthForOverlay] = useState(320)
  const activePlotDragId = useExternalDndContext ? (workspaceDnd?.activePlotDragId ?? null) : localPlotDragId
  const activeScriptDragIds = workspaceDnd?.activeScriptDragIds ?? []
  const isScriptDragging = activeScriptDragIds.length > 0

  const episode = file?.episodes.find(e => e.id === episodeId)
  const plotBoxes = useMemo(
    () => (episode ? [...episode.plotBoxes].sort((a, b) => a.order - b.order) : []),
    [episode]
  )
  /** 목록 구조(추가/삭제/순서)만 반영 — content 변경 시에는 바뀌지 않아 입력 중 autoResize가 매번 돌지 않음 */
  const plotBoxIdsKey = useMemo(() => plotBoxes.map(b => b.id).join(','), [plotBoxes])
  const defaultFontFamily = useSettingsStore(state => state.defaultFontFamily)
  const defaultFontStyle = defaultFontFamily ? { fontFamily: defaultFontFamily } : undefined

  const isVertical = layoutMode === 'vertical'
  const isHorizontal = layoutMode === 'horizontal'
  /** 플롯 중심 모드: 세로 78%, 좌우는 38% 이하일 때 1단계 진입 */
  const minSize = panelRange?.min ?? 0
  /** 범위가 실제로 퍼졌는지(사용자 리사이즈 후). 부동소수 오차만으로는 퍼진 걸로 보지 않음 */
  const RANGE_SPREAD_THRESHOLD_PX = 15
  const rangeSpread = panelRange != null && panelRange.max - panelRange.min >= RANGE_SPREAD_THRESHOLD_PX
  /** 확장/축소 동일 트리거: 1단계 진입 200px로 고정. 히스테리시스로 200px 근처에서 뷰 전환 시 textarea 사라졌다 나타나며 입력이 '돌아오는' 현상 방지 */
  const INITIAL_NARROW_MAX_HORIZONTAL = 200
  const INITIAL_NARROW_MAX_VERTICAL = 200
  const NARROW_ENTER_H = 185
  const NARROW_EXIT_H = 220
  const compactHysteresisRef = useRef<boolean | null>(null)
  const initialNarrowMax = isVertical ? INITIAL_NARROW_MAX_VERTICAL : INITIAL_NARROW_MAX_HORIZONTAL
  const narrowThreshold = initialNarrowMax
  const rawNarrow = panelHeight > 0 && panelHeight <= narrowThreshold
  const isPlotCenteredModeRaw =
    (isVertical || isHorizontal) && panelHeight > 0 && rawNarrow
  const isPlotCenteredMode = (() => {
    if (!(isVertical || isHorizontal) || panelHeight <= 0) return false
    if (isVertical) return isPlotCenteredModeRaw
    if (panelHeight <= NARROW_ENTER_H) {
      compactHysteresisRef.current = true
      return true
    }
    if (panelHeight > NARROW_EXIT_H) {
      compactHysteresisRef.current = false
      return false
    }
    return compactHysteresisRef.current ?? rawNarrow
  })()
  /** 2단계: 트리거·최소 영역을 컴팩트 아이콘 크기에 맞춤. panelHeight/width는 ResizeObserver(contentRect) 기준이라 배율·창 모드와 무관하게 동일 좌표계. */
  const HORIZONTAL_STAGE2_MAX_PX = 56
  const VERTICAL_STAGE2_MAX_PX = 72
  const currentBelowStage2 =
    (isHorizontal && panelHeight > 0 && panelHeight <= HORIZONTAL_STAGE2_MAX_PX) ||
    (isVertical && panelHeight > 0 && panelHeight <= VERTICAL_STAGE2_MAX_PX)
  const atMinSize =
    panelRange != null &&
    (panelRange.max > panelRange.min
      ? panelHeight <= minSize &&
        (isHorizontal ? minSize < HORIZONTAL_STAGE2_MAX_PX : panelHeight <= VERTICAL_STAGE2_MAX_PX)
      : rangeSpread
        ? (isVertical && panelHeight <= VERTICAL_STAGE2_MAX_PX) || (isHorizontal && panelHeight <= HORIZONTAL_STAGE2_MAX_PX)
        : currentBelowStage2)
  const plotCenteredNarrow = isPlotCenteredMode && atMinSize
  /** 좌우 모드 1단계: 아이콘+제목만 (2단계는 아이콘만) */
  const horizontalCompactStage1 = isHorizontal && isPlotCenteredMode && !plotCenteredNarrow

  const [stripScrollAreaHeight, setStripScrollAreaHeight] = useState(0)
  const [stripArrowsVisible, setStripArrowsVisible] = useState(true)
  const ARROW_SHOW_HEIGHT = PLOT_STRIP_ITEM_HEIGHT * PLOT_STRIP_STEP
  const ARROW_HIDE_HEIGHT = 50
  const showPlotStripArrows = stripArrowsVisible
  const confirmedOrdered = useMemo(
    () => plotBoxes.filter(p => confirmedPlotBoxIds.includes(p.id)),
    [plotBoxes, confirmedPlotBoxIds]
  )
  const useConfirmedOnly = isPlotCenteredMode && confirmedOrdered.length > 0
  const activeIndex = plotBoxes.findIndex(b => b.id === activePlotBoxId)
  const currentPlotIndex = activeIndex >= 0 ? activeIndex : (plotBoxes.length > 0 ? 0 : -1)
  const currentPlot = currentPlotIndex >= 0 ? plotBoxes[currentPlotIndex] : null
  const currentConfirmedIndex = useConfirmedOnly
    ? confirmedOrdered.findIndex(p => p.id === (currentPlot?.id ?? activePlotBoxId))
    : -1
  const displayPlot = currentPlot
  const displayPlotIndex = currentPlotIndex

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const pendingResizeRef = useRef<Set<HTMLTextAreaElement>>(new Set())
  const resizeRafIdRef = useRef<number | null>(null)
  const autoResize = useCallback((textarea: HTMLTextAreaElement) => {
    pendingResizeRef.current.add(textarea)
    if (resizeRafIdRef.current !== null) return
    resizeRafIdRef.current = requestAnimationFrame(() => {
      resizeRafIdRef.current = null
      const set = pendingResizeRef.current
      pendingResizeRef.current = new Set()
      set.forEach(el => {
        if (!el.isConnected) return
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      })
    })
  }, [])

  const handleDragStart = (event: DragStartEvent) => {
    if (!useExternalDndContext) setLocalPlotDragId(String(event.active.id))
    const el = plotListRef.current?.querySelector(`[data-plot-box-id="${event.active.id}"]`) as HTMLElement | null
    if (el) {
      overlayWidthRef.current = el.offsetWidth
      setOverlayWidthForOverlay(el.offsetWidth)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    if (!useExternalDndContext) setLocalPlotDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = plotBoxes.findIndex(box => box.id === active.id)
    const newIndex = plotBoxes.findIndex(box => box.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderPlotBoxesUndoable(episodeId, oldIndex, newIndex)
    }
  }

  const handlePlotKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    boxIndex: number
  ) => {
    const textarea = e.currentTarget
    const { selectionStart, selectionEnd, value } = textarea

    if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey) {
      e.preventDefault()
      if (selectionStart === 0 && selectionEnd === 0) {
        insertPlotBoxAtUndoable(episodeId, boxIndex)
        setFocusBoxIndex(boxIndex)
      } else {
        splitPlotBoxByContentUndoable(episodeId, boxIndex, selectionStart)
        setFocusBoxIndex(boxIndex + 1)
      }
      return
    }

    if (e.key === 'Backspace' && selectionStart === 0 && selectionEnd === 0) {
      if (boxIndex > 0) {
        if (value === '') {
          e.preventDefault()
          removePlotBoxUndoable(episodeId, plotBoxes[boxIndex].id)
          setFocusBoxIndex(boxIndex - 1)
        } else {
          e.preventDefault()
          const prevTextarea = textareaRefs.current.get(boxIndex - 1)
          const cursorPos = prevTextarea?.value.length || 0
          mergePlotBoxes(episodeId, boxIndex - 1, boxIndex)
          setTimeout(() => {
            const merged = textareaRefs.current.get(boxIndex - 1)
            if (merged) {
              merged.focus()
              merged.setSelectionRange(cursorPos, cursorPos)
              autoResize(merged)
            }
          }, 0)
        }
        return
      }
    }

    if (e.key === 'ArrowUp' && selectionStart === 0 && selectionEnd === 0) {
      if (boxIndex > 0) {
        e.preventDefault()
        e.stopPropagation()
        const prevTextarea = textareaRefs.current.get(boxIndex - 1)
        if (prevTextarea) {
          prevTextarea.focus()
          const len = prevTextarea.value.length
          prevTextarea.setSelectionRange(len, len)
        }
      }
    }

    if (e.key === 'ArrowDown' && selectionStart === value.length && selectionEnd === value.length) {
      if (boxIndex < plotBoxes.length - 1) {
        e.preventDefault()
        e.stopPropagation()
        const nextTextarea = textareaRefs.current.get(boxIndex + 1)
        if (nextTextarea) {
          nextTextarea.focus()
          nextTextarea.setSelectionRange(0, 0)
        }
      }
    }
  }, [episodeId, splitPlotBoxByContentUndoable, mergePlotBoxes, plotBoxes, autoResize, removePlotBoxUndoable, insertPlotBoxAtUndoable])

  useEffect(() => {
    if (focusBoxIndex !== null) {
      requestAnimationFrame(() => {
        const textarea = textareaRefs.current.get(focusBoxIndex)
        if (textarea) {
          textarea.focus()
          textarea.setSelectionRange(0, 0)
          textarea.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        setFocusBoxIndex(null)
      })
    }
  }, [focusBoxIndex, plotBoxes])

  useEffect(() => {
    if (!editingTitleId) return
    if (isPlotCenteredMode && displayPlot?.id === editingTitleId && centeredTitleInputRef.current) {
      centeredTitleInputRef.current.focus()
      centeredTitleInputRef.current.select()
    } else if (!isPlotCenteredMode && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitleId, isPlotCenteredMode, displayPlot?.id])
  useEffect(() => {
    if (isPlotCenteredMode && displayPlot && editingTitleId !== null && editingTitleId !== displayPlot.id)
      setEditingTitleId(null)
  }, [isPlotCenteredMode, displayPlot?.id, editingTitleId])

  useEffect(() => {
    textareaRefs.current.forEach((textarea) => {
      autoResize(textarea)
    })
  }, [plotBoxIdsKey, autoResize])

  const layoutModeRef = useRef(layoutMode)
  useEffect(() => {
    layoutModeRef.current = layoutMode
  }, [layoutMode])
  useEffect(() => {
    setPanelRange(null)
    setPanelHeight(0)
    // 모드 전환 직후에는 새 레이아웃이 아직 반영되지 않아 0 또는 이전 크기가 읽힐 수 있음.
    // 이중 rAF로 레이아웃 적용 후에 측정해, 기본 모드 진입 시 텍스트 잘림 방지.
    let cancelled = false
    const rafId1 = requestAnimationFrame(() => {
      if (cancelled) return
      requestAnimationFrame(() => {
        if (cancelled) return
        const el = rootRef.current
        const mode = layoutModeRef.current
        if (!el || (mode !== 'vertical' && mode !== 'horizontal')) return
        const rect = el.getBoundingClientRect()
        const dim = mode === 'vertical' ? rect.height : rect.width
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/88c5408a-5008-4939-ac01-c6dc3fd592a0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8468c1'},body:JSON.stringify({sessionId:'8468c1',location:'PlotEditor.tsx:rAF',message:'after double rAF',data:{layoutMode:mode,rectW:rect.width,rectH:rect.height,dim,set:dim>0},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (dim > 0) {
          setPanelHeight(dim)
          setPanelRange({ min: dim, max: dim })
        }
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId1)
    }
  }, [layoutMode])

  useEffect(() => {
    if ((layoutMode !== 'vertical' && layoutMode !== 'horizontal') || !rootRef.current) return
    const el = rootRef.current
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const mode = layoutModeRef.current
      const dim = mode === 'vertical' ? entry.contentRect.height : entry.contentRect.width
      setPanelHeight(dim)
      setPanelRange((prev) => {
        if (dim <= 0) return prev
        const next = prev
          ? { min: Math.min(prev.min, dim), max: Math.max(prev.max, dim) }
          : { min: dim, max: dim }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/88c5408a-5008-4939-ac01-c6dc3fd592a0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8468c1'},body:JSON.stringify({sessionId:'8468c1',location:'PlotEditor.tsx:ResizeObserver',message:'resize',data:{layoutMode:mode,dim,prev:prev??null,next},hypothesisId:'H3',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return next
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [layoutMode])

  // 1단계(compact)에서 기본(전체) 보기로 넘어갈 때 panelRange.min 초기화 → 이전 좁은 min이 남아 잘못된 판정 방지
  useEffect(() => {
    if (
      layoutMode !== 'horizontal' ||
      panelHeight <= 200 ||
      panelRange == null ||
      panelRange.min >= 200
    )
      return
    setPanelRange({ min: panelHeight, max: panelHeight })
  }, [layoutMode, panelHeight, panelRange])

  const prevCompactStage1Ref = useRef(horizontalCompactStage1)
  useEffect(() => {
    if (prevCompactStage1Ref.current && !horizontalCompactStage1) {
      prevCompactStage1Ref.current = false
      scrollContainerRef.current?.scrollTo({ top: 0 })
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          textareaRefs.current.forEach((ta) => ta && autoResize(ta))
        })
      })
    } else {
      prevCompactStage1Ref.current = horizontalCompactStage1
    }
  }, [horizontalCompactStage1, autoResize])

  useEffect(() => {
    if (layoutMode !== 'horizontal') return
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/88c5408a-5008-4939-ac01-c6dc3fd592a0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8468c1'},body:JSON.stringify({sessionId:'8468c1',location:'PlotEditor.tsx:derived',message:'horizontal derived state',data:{panelHeight,panelRange,isPlotCenteredMode,horizontalCompactStage1,plotCenteredNarrow},hypothesisId:'H5',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [layoutMode, panelHeight, panelRange, isPlotCenteredMode, horizontalCompactStage1, plotCenteredNarrow])

  useEffect(() => {
    if (!isPlotCenteredMode) return
    const el = plotStripScrollRef.current
    if (!el) return
    const updateHeight = () => setStripScrollAreaHeight(el.clientHeight)
    updateHeight()
    const ro = new ResizeObserver(updateHeight)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isPlotCenteredMode])

  useEffect(() => {
    setStripArrowsVisible(prev => {
      if (stripScrollAreaHeight >= ARROW_SHOW_HEIGHT) return true
      if (stripScrollAreaHeight < ARROW_HIDE_HEIGHT) return false
      return prev
    })
  }, [stripScrollAreaHeight])

  useEffect(() => {
    if (isPlotCenteredMode && plotBoxes.length > 0 && !activePlotBoxId)
      setActivePlotBox(plotBoxes[0].id)
  }, [isPlotCenteredMode, plotBoxes.length, activePlotBoxId, plotBoxes, setActivePlotBox])

  useEffect(() => {
    if (plotBoxes.length === 0) return
    const idx = plotBoxes.findIndex(b => b.id === activePlotBoxId)
    if (idx === -1) setActivePlotBox(plotBoxes[0].id)
  }, [plotBoxes, activePlotBoxId, setActivePlotBox])


  // 에피소드가 실제로 바뀔 때만 선택/확정 초기화. 마운트만 다시 될 때(플롯 패널 닫았다 열 때)는 유지.
  useEffect(() => {
    const prev = prevEpisodeIdRef.current
    prevEpisodeIdRef.current = episodeId
    if (prev != null && prev !== episodeId) {
      setSelectedPlotBoxIds([])
      setConfirmedPlotBoxIds([])
    }
  }, [episodeId, setSelectedPlotBoxIds, setConfirmedPlotBoxIds])

  useEffect(() => {
    if (isPlotCenteredMode) setSelectedPlotBoxIds([])
  }, [isPlotCenteredMode, setSelectedPlotBoxIds])

  useEffect(() => {
    const raw = useUIStore.getState().selectedPlotBoxIds
    if (!Array.isArray(raw)) setSelectedPlotBoxIds([])
  }, [setSelectedPlotBoxIds])

  /** P 아이콘 + Ctrl/Shift 시에만 호출됨. 선택만 변경, 확정은 건드리지 않음. */
  const handleBoxActivate = useCallback((e: React.MouseEvent, boxId: string) => {
    try {
      const rawIds = useUIStore.getState().selectedPlotBoxIds
      const ids = Array.isArray(rawIds) ? rawIds : []
      const plotIds = plotBoxes.map(b => b.id)
      const getMod = (key: string) => typeof (e as unknown as { getModifierState?: (k: string) => boolean }).getModifierState === 'function' && (e as unknown as { getModifierState: (k: string) => boolean }).getModifierState(key)
      const shift = e.shiftKey || getMod('Shift')
      const ctrl = e.ctrlKey || e.metaKey || getMod('Control') || getMod('Meta')

      if (shift) {
        const anchorId = ids.length > 0 ? ids[ids.length - 1] : activePlotBoxId
        const anchorIdx = anchorId != null ? plotIds.indexOf(anchorId) : -1
        const clickIdx = plotIds.indexOf(boxId)
        if (anchorIdx === -1 || clickIdx === -1) {
          setSelectedPlotBoxIds([boxId])
        } else {
          const lo = Math.min(anchorIdx, clickIdx)
          const hi = Math.max(anchorIdx, clickIdx)
          setSelectedPlotBoxIds(plotIds.slice(lo, hi + 1))
        }
        setActivePlotBox(boxId)
        return
      }
      if (ctrl) {
        const next = ids.includes(boxId) ? ids.filter(id => id !== boxId) : [...ids, boxId]
        setSelectedPlotBoxIds(next)
        setActivePlotBox(boxId)
        return
      }
      document.dispatchEvent(new CustomEvent('clear-script-selection'))
      setActivePlotBox(boxId)
    } catch (err) {
      if (import.meta.env.DEV) console.error('[PlotEditor] handleBoxActivate', err)
      setSelectedPlotBoxIds([])
      setActivePlotBox(boxId)
    }
  }, [setSelectedPlotBoxIds, setActivePlotBox, plotBoxes, activePlotBoxId])

  /** 더블클릭: 전체 미확정 시 → 전체 확정. 확정 박스 더블클릭 → 전체 확정. 전체 확정 시 더블클릭 → 전체 해제. 미확정 박스 더블클릭(일부만 확정인 경우) → 해당 플롯만 확정·나머지 해제. */
  const handleBoxDoubleClick = useCallback((boxId: string) => {
    try {
      const plotIds = plotBoxes.map(b => b.id)
      const state = useUIStore.getState()
      const rawConfirmed = state.confirmedPlotBoxIds
      const confirmed = Array.isArray(rawConfirmed) ? rawConfirmed : []
      const allUnconfirmed = confirmed.length === 0
      const allConfirmed = plotIds.length > 0 && plotIds.every(id => confirmed.includes(id))
      const thisConfirmed = confirmed.includes(boxId)
      const animate = { animate: true }

      if (allUnconfirmed) {
        setConfirmedPlotBoxIds([...plotIds], animate)
      } else if (thisConfirmed) {
        if (allConfirmed) {
          setConfirmedPlotBoxIds([], animate)
        } else {
          setConfirmedPlotBoxIds([...plotIds], animate)
        }
      } else {
        setConfirmedPlotBoxIds([boxId], animate)
        setSelectedPlotBoxIds([])
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[PlotEditor] handleBoxDoubleClick', err)
      setConfirmedPlotBoxIds([])
    }
  }, [setConfirmedPlotBoxIds, setSelectedPlotBoxIds, plotBoxes])

  /** P 버튼 원클릭(수정자 없음): 해당 박스만 확정 추가 또는 개별 미확정. 선택은 변경하지 않음. */
  const handlePButtonClick = useCallback((boxId: string) => {
    const confirmed = confirmedPlotBoxIds
    const plotIds = plotBoxes.map(b => b.id)
    const animate = { animate: true }
    if (confirmed.includes(boxId)) {
      setConfirmedPlotBoxIds(confirmed.filter(id => id !== boxId), animate)
    } else {
      const merged = [...new Set([...confirmed, boxId])].sort((a, b) => plotIds.indexOf(a) - plotIds.indexOf(b))
      setConfirmedPlotBoxIds(merged, animate)
    }
    setActivePlotBox(boxId)
  }, [confirmedPlotBoxIds, plotBoxes, setConfirmedPlotBoxIds, setActivePlotBox])

  const handleBodyClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      const isInput = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        handleBoxActivate(e, id)
        return
      }
      if (isInput) {
        setActivePlotBox(id)
        return
      }
      if ((e.target as HTMLElement).closest?.('[data-plot-title-area]')) {
        setActivePlotBox(id)
        return
      }
      if ((e.target as HTMLElement).closest?.('[data-plot-handle-area]')) {
        setActivePlotBox(id)
        return
      }
      if ((e.nativeEvent as MouseEvent).detail >= 2) return
      if (bodyClickTimeoutRef.current) clearTimeout(bodyClickTimeoutRef.current)
      bodyClickTimeoutRef.current = setTimeout(() => {
        bodyClickTimeoutRef.current = null
        handlePButtonClick(id)
      }, 150)
    },
    [setActivePlotBox, handleBoxActivate, handlePButtonClick]
  )

  const handleBoxDoubleClickWithClear = useCallback(
    (boxId: string) => {
      if (bodyClickTimeoutRef.current) {
        clearTimeout(bodyClickTimeoutRef.current)
        bodyClickTimeoutRef.current = null
      }
      handleBoxDoubleClick(boxId)
    },
    [handleBoxDoubleClick]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inPlotPanel = (e.target as HTMLElement).closest?.('[data-context="plot-panel"]')
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && inPlotPanel && !isPlotCenteredMode && selectedPlotBoxIds.length >= 1) {
        e.preventDefault()
        setSelectedPlotBoxIds(plotBoxes.map(b => b.id))
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Enter' && selectedPlotBoxIds.length >= 1 && !isPlotCenteredMode) {
        e.preventDefault()
        const plotIds = plotBoxes.map(b => b.id)
        const merged = [...new Set([...confirmedPlotBoxIds, ...selectedPlotBoxIds])]
        const sorted = merged.sort((a, b) => plotIds.indexOf(a) - plotIds.indexOf(b))
        setConfirmedPlotBoxIds(sorted)
        setSelectedPlotBoxIds([])
        requestScenarioFocus?.()
      } else if (e.key === 'Enter' && selectedPlotBoxIds.length === 0 && !isPlotCenteredMode) {
        e.preventDefault()
        requestScenarioFocus?.()
      } else if (e.key === 'Escape' && !isPlotCenteredMode) {
        setSelectedPlotBoxIds([])
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isPlotCenteredMode, selectedPlotBoxIds, confirmedPlotBoxIds, setConfirmedPlotBoxIds, setSelectedPlotBoxIds, requestScenarioFocus, plotBoxes])

  const goPrevPlot = () => {
    if (currentPlotIndex <= 0) return
    setActivePlotBox(plotBoxes[currentPlotIndex - 1].id)
  }
  const goNextPlot = () => {
    if (currentPlotIndex < 0 || currentPlotIndex >= plotBoxes.length - 1) return
    setActivePlotBox(plotBoxes[currentPlotIndex + 1].id)
  }
  const plotContentScrollRef = useRef<HTMLDivElement>(null)
  const scrollNextGuardRef = useRef(false)
  const scrollToNextConfirmed = useCallback(() => {
    if (!useConfirmedOnly || confirmedOrdered.length === 0 || scrollNextGuardRef.current) return
    const nextPlot = currentConfirmedIndex < 0 ? confirmedOrdered[0] : confirmedOrdered[currentConfirmedIndex + 1]
    if (!nextPlot) return
    scrollNextGuardRef.current = true
    setActivePlotBox(nextPlot.id)
    plotContentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => { scrollNextGuardRef.current = false }, 400)
  }, [useConfirmedOnly, currentConfirmedIndex, confirmedOrdered, setActivePlotBox])

  const scrollToPrevConfirmed = useCallback(() => {
    if (!useConfirmedOnly || confirmedOrdered.length === 0 || scrollNextGuardRef.current) return
    const prevPlot = currentConfirmedIndex <= 0
      ? (currentConfirmedIndex < 0 ? confirmedOrdered[confirmedOrdered.length - 1] : null)
      : confirmedOrdered[currentConfirmedIndex - 1]
    if (!prevPlot) return
    scrollNextGuardRef.current = true
    setActivePlotBox(prevPlot.id)
    plotContentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => { scrollNextGuardRef.current = false }, 400)
  }, [useConfirmedOnly, currentConfirmedIndex, confirmedOrdered, setActivePlotBox])

  const { ctx: plotCtx, show: showPlotContextMenu, close: closePlotContextMenu } = useContextMenu()
  const { plotContextItems, buildPlotContextItems } = usePlotContextMenu(episodeId, {
    isPlotCenteredMode,
    plotContentVisible,
    togglePlotContentVisible,
  })
  const sortablePlotIds = useMemo(() => plotBoxes.map(b => b.id), [plotBoxes])

  return (
    <div
      ref={rootRef}
      data-context="plot-panel"
      className="h-full min-h-0 min-w-0 w-full flex flex-col border-r border-border bg-background overflow-hidden"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement
        if (target.closest?.('[data-plot-box-id]')) return
        clearAllSelection()
      }}
      onContextMenu={(e) => {
        if (isPlotCenteredMode) {
          e.preventDefault()
          if (plotCtx) closePlotContextMenu()
          return
        }
        showPlotContextMenu(e, plotContextItems)
      }}
    >
      <PlotEditorHeader
        episode={episode}
        editingEpisodeSubtitle={editingEpisodeSubtitle}
        setEditingEpisodeSubtitle={setEditingEpisodeSubtitle}
        episodeId={episodeId}
        updateEpisode={updateEpisodeUndoable}
        selectedPlotBoxIds={selectedPlotBoxIds}
        setSelectedPlotBoxIds={setSelectedPlotBoxIds}
        isPlotCenteredMode={isPlotCenteredMode}
        plotContentVisible={plotContentVisible}
        togglePlotContentVisible={togglePlotContentVisible}
        hideEpisodeName={isHorizontal && (horizontalCompactStage1 || plotCenteredNarrow)}
      />

      <div
        ref={scrollContainerRef}
        className={cn('flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto scrollbar-hide', isScriptDragging && 'scrollbar-hide')}
      >
        {isPlotCenteredMode && plotCenteredNarrow && isVertical ? (
          <div
            ref={plotStripHorizontalRef}
            className="h-full min-h-[36px] w-full flex items-stretch justify-start overflow-x-auto overflow-y-hidden scrollbar-hide min-w-0"
            role="tablist"
            aria-label="플롯 확정"
            onWheel={(e) => {
              const el = plotStripHorizontalRef.current
              if (!el) return
              if (el.scrollWidth > el.clientWidth && e.deltaY !== 0) {
                const maxLeft = el.scrollWidth - el.clientWidth
                el.scrollLeft = Math.max(0, Math.min(maxLeft, el.scrollLeft + e.deltaY))
                e.preventDefault()
              }
            }}
          >
            <div className="flex flex-shrink-0 h-full min-h-[36px]">
              {plotBoxes.map((plot) => {
                const id = plot.id
                const idx = plotBoxes.findIndex(p => p.id === id)
                const pNumber = idx + 1
                const confirmed = confirmedPlotBoxIds.includes(id)
                const isActive = displayPlot?.id === id
                return (
                  <PlotDropTarget key={id} plotId={id} className="shrink-0">
                    <PlotPButton
                      boxId={id}
                      pNumber={pNumber}
                      confirmed={confirmed}
                      isActive={isActive}
                      className="h-full min-h-[36px] min-w-[36px] aspect-square text-xs"
                      onPButtonClick={handlePButtonClick}
                      onPButtonDoubleClick={handleBoxDoubleClick}
                      onActivate={() => setActivePlotBox(id)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        showPlotContextMenu(e, buildPlotContextItems('p-button', id))
                      }}
                    />
                  </PlotDropTarget>
                )
              })}
              {plotBoxes.length === 0 && (
                <button
                  type="button"
                  onClick={() => addPlotBoxUndoable(episodeId)}
                  className="h-full min-h-[36px] px-3 shrink-0 rounded-md text-xs font-medium bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  + 플롯 추가
                </button>
              )}
            </div>
          </div>
        ) : isPlotCenteredMode && plotCenteredNarrow && isHorizontal ? (
          <div
            className="h-full w-full min-w-0 overflow-x-hidden overflow-y-auto scrollbar-hide flex flex-col items-center py-0.5 gap-0.5"
            role="tablist"
            aria-label="플롯 확정"
          >
            {plotBoxes.map((plot) => {
              const id = plot.id
              const idx = plotBoxes.findIndex(p => p.id === id)
              const pNumber = idx + 1
              const confirmed = confirmedPlotBoxIds.includes(id)
              const isActive = displayPlot?.id === id
              return (
                <PlotDropTarget key={id} plotId={id} className="w-full max-w-[32px] flex-shrink-0">
                  <PlotPButton
                    boxId={id}
                    pNumber={pNumber}
                    confirmed={confirmed}
                    isActive={isActive}
                    className="min-h-[28px] min-w-[28px] w-full max-w-[32px] flex-shrink-0 text-[10px]"
                    onPButtonClick={handlePButtonClick}
                    onPButtonDoubleClick={handleBoxDoubleClick}
                    onActivate={() => setActivePlotBox(id)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      showPlotContextMenu(e, buildPlotContextItems('p-button', id))
                    }}
                  />
                </PlotDropTarget>
              )
            })}
            {plotBoxes.length === 0 && (
              <button
                type="button"
                onClick={() => addPlotBoxUndoable(episodeId)}
                className="text-[10px] text-muted-foreground hover:underline p-1"
              >
                + 플롯 추가
              </button>
            )}
          </div>
        ) : horizontalCompactStage1 ? (
          <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto scrollbar-hide flex flex-col py-0.5" role="tablist" aria-label="플롯 확정">
            <SortableContext items={sortablePlotIds} strategy={verticalListSortingStrategy}>
              {plotBoxes.map((plot) => {
                const id = plot.id
                const idx = plotBoxes.findIndex(p => p.id === id)
                const pNumber = idx + 1
                const confirmed = confirmedPlotBoxIds.includes(id)
                const isActive = activePlotBoxId === id
                return (
                  <HorizontalCompactPlotRow
                    key={id}
                    plot={plot}
                    pNumber={pNumber}
                    isActive={isActive}
                    confirmed={confirmed}
                    onPClick={handlePButtonClick}
                    onPDoubleClick={handleBoxDoubleClick}
                    onPActivate={(e) => handleBoxActivate(e, id)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      showPlotContextMenu(e, buildPlotContextItems('p-button', id))
                    }}
                  />
                )
              })}
            </SortableContext>
            {plotBoxes.length === 0 && (
              <button
                type="button"
                onClick={() => addPlotBoxUndoable(episodeId)}
                className="text-[10px] text-muted-foreground hover:underline p-1 text-left"
              >
                + 플롯 추가
              </button>
            )}
          </div>
        ) : plotBoxes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center text-xs">
              <p>플롯이 없습니다</p>
              <button 
                onClick={() => addPlotBoxUndoable(episodeId)}
                className="mt-1 text-[10px] hover:underline"
              >
                + 추가하기
              </button>
            </div>
          </div>
        ) : isPlotCenteredMode && isVertical && (displayPlot ?? currentPlot) ? (
          plotBoxes.length === 1 ? (
            <div
              className={cn(
                'h-full flex flex-col min-w-0 p-2 overflow-hidden rounded transition-colors',
                (displayPlot && confirmedPlotBoxIds.includes(displayPlot.id)) && 'bg-muted border-2 border-foreground',
                !(displayPlot && confirmedPlotBoxIds.includes(displayPlot.id)) && 'bg-background'
              )}
              style={defaultFontStyle}
            >
              <div className="flex items-start gap-2 shrink-0 min-w-0 overflow-hidden">
                {editingTitleId === (displayPlot?.id) ? (
                  <input
                    ref={centeredTitleInputRef}
                    type="text"
                    value={displayPlot ? (draftTitleByPlotId[displayPlot.id] ?? displayPlot.title ?? '') : ''}
                    onChange={(e) => displayPlot && handlePlotTitle(displayPlot.id, e.target.value)}
                    onBlur={() => { displayPlot && flushPlotTitle(displayPlot.id); setEditingTitleId(null) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        e.preventDefault()
                        setEditingTitleId(null)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 text-xs bg-transparent border-0 border-b border-border rounded-none px-0 py-0.5 outline-none"
                    placeholder="제목 없음"
                    autoFocus
                  />
                ) : (
                  <Tooltip content="제목 편집" side="bottom">
                    <span
                      role="button"
                      tabIndex={0}
                      className={cn('text-xs break-words min-w-0 cursor-pointer hover:text-foreground', displayPlot?.title ? 'text-foreground' : 'text-muted-foreground')}
                      onClick={() => displayPlot && setEditingTitleId(displayPlot.id)}
                      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && displayPlot) { e.preventDefault(); setEditingTitleId(displayPlot.id) } }}
                      aria-label="제목 편집"
                    >
                      {displayPlot?.title || '제목 없음'}
                    </span>
                  </Tooltip>
                )}
              </div>
              <div ref={plotContentScrollRef} className="flex-1 min-h-0 mt-1 flex flex-col overflow-hidden">
                <textarea
                  value={displayPlot ? (draftContentByPlotId[displayPlot.id] ?? displayPlot.content ?? '') : ''}
                  onChange={(e) => displayPlot && handlePlotContent(displayPlot.id, e.target.value)}
                  onBlur={() => displayPlot && flushPlotContent(displayPlot.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && displayPlot) {
                      e.preventDefault()
                      const textarea = e.currentTarget
                      const idx = plotBoxes.findIndex(p => p.id === displayPlot.id)
                      if (idx === -1) return
                      if (textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
                        const newId = insertPlotBoxAtUndoable(episodeId, idx)
                        if (newId) setActivePlotBox(newId)
                      } else {
                        splitPlotBoxByContentUndoable(episodeId, idx, textarea.selectionStart)
                      }
                    }
                  }}
                  placeholder="장면 설명... (Shift+Enter: 플롯 나누기)"
                  className="flex-1 min-h-0 w-full bg-transparent text-xs resize-none outline-none leading-relaxed placeholder:text-muted-foreground/25 focus:placeholder:text-transparent border-0 rounded-none p-0 block overflow-y-auto"
                />
              </div>
            </div>
          ) : (
          <div className="h-full flex">
            <div className="flex flex-col items-center justify-center gap-2 shrink-0 w-14 py-2 border-r border-border" role="navigation" aria-label="플롯 네비게이션">
              <button
                type="button"
                onClick={goPrevPlot}
                disabled={currentPlotIndex <= 0}
                className="min-h-[28px] min-w-[28px] p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="이전 플롯"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="text-sm font-bold text-primary px-2 py-1 rounded bg-primary/10" aria-live="polite">
                P{displayPlotIndex + 1}
              </span>
              <button
                type="button"
                onClick={goNextPlot}
                disabled={currentPlotIndex >= plotBoxes.length - 1}
                className="min-h-[28px] min-w-[28px] p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="다음 플롯"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
            <div
              className={cn(
                'flex-1 flex flex-col min-w-0 p-2 overflow-hidden rounded transition-colors',
                (displayPlot && confirmedPlotBoxIds.includes(displayPlot.id)) && 'bg-muted border-l-2 border-l-foreground',
                !(displayPlot && confirmedPlotBoxIds.includes(displayPlot.id)) && 'bg-background'
              )}
              style={defaultFontStyle}
            >
              <div className="flex items-start gap-2 shrink-0 min-w-0 overflow-hidden">
                {editingTitleId === (displayPlot?.id) ? (
                  <input
                    ref={centeredTitleInputRef}
                    type="text"
                    value={displayPlot ? (draftTitleByPlotId[displayPlot.id] ?? displayPlot.title ?? '') : ''}
                    onChange={(e) => displayPlot && handlePlotTitle(displayPlot.id, e.target.value)}
                    onBlur={() => { displayPlot && flushPlotTitle(displayPlot.id); setEditingTitleId(null) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        e.preventDefault()
                        setEditingTitleId(null)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 text-xs bg-transparent border-0 border-b border-border rounded-none px-0 py-0.5 outline-none"
                    placeholder="제목 없음"
                    autoFocus
                  />
                ) : (
                  <Tooltip content="제목 편집" side="bottom">
                    <span
                      role="button"
                      tabIndex={0}
                      className={cn('text-xs break-words min-w-0 cursor-pointer hover:text-foreground', displayPlot?.title ? 'text-foreground' : 'text-muted-foreground')}
                      onClick={() => displayPlot && setEditingTitleId(displayPlot.id)}
                      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && displayPlot) { e.preventDefault(); setEditingTitleId(displayPlot.id) } }}
                      aria-label="제목 편집"
                    >
                      {displayPlot?.title || '제목 없음'}
                    </span>
                  </Tooltip>
                )}
              </div>
              <div ref={plotContentScrollRef} className="flex-1 min-h-0 mt-1 flex flex-col overflow-hidden">
                <textarea
                  value={displayPlot ? (draftContentByPlotId[displayPlot.id] ?? displayPlot.content ?? '') : ''}
                  onChange={(e) => displayPlot && handlePlotContent(displayPlot.id, e.target.value)}
                  onBlur={() => displayPlot && flushPlotContent(displayPlot.id)}
                  onScroll={(e) => {
                    if (!useConfirmedOnly || confirmedOrdered.length === 0) return
                    const el = e.currentTarget
                    const threshold = 40
                    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) scrollToNextConfirmed()
                    else if (el.scrollTop <= threshold) scrollToPrevConfirmed()
                  }}
                  onWheel={(e) => {
                    if (!useConfirmedOnly || confirmedOrdered.length === 0) return
                    const el = e.currentTarget
                    const threshold = 20
                    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
                    const atTop = el.scrollTop <= threshold
                    const noScroll = el.scrollHeight <= el.clientHeight + threshold
                    if (e.deltaY > 0 && (noScroll || atBottom)) {
                      e.preventDefault()
                      scrollToNextConfirmed()
                    } else if (e.deltaY < 0 && (noScroll || atTop)) {
                      e.preventDefault()
                      scrollToPrevConfirmed()
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && displayPlot) {
                      e.preventDefault()
                      const textarea = e.currentTarget
                      const idx = plotBoxes.findIndex(p => p.id === displayPlot.id)
                      if (idx === -1) return
                      if (textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
                        const newId = insertPlotBoxAtUndoable(episodeId, idx)
                        if (newId) setActivePlotBox(newId)
                      } else {
                        splitPlotBoxByContentUndoable(episodeId, idx, textarea.selectionStart)
                      }
                    }
                  }}
                  placeholder="장면 설명... (Shift+Enter: 플롯 나누기)"
                  className="flex-1 min-h-[80px] max-h-[200px] w-full bg-transparent text-xs resize-none outline-none leading-relaxed placeholder:text-muted-foreground/25 focus:placeholder:text-transparent border-0 rounded-none p-0 block overflow-y-auto"
                />
              </div>
            </div>
            <div
              className="flex flex-col shrink-0 w-9 border-l border-border rounded-r-md overflow-hidden min-h-0"
              role="tablist"
              aria-label="플롯 확정"
            >
              {showPlotStripArrows && (
                <Tooltip content="위로" side="bottom">
                  <button
                    type="button"
                    onClick={() => scrollPlotStrip('up')}
                    className="shrink-0 min-h-7 w-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
                    aria-label="위로 4칸"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 15l-6-6-6 6" />
                    </svg>
                  </button>
                </Tooltip>
              )}
              <div
                ref={plotStripScrollRef}
                className="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col bg-muted/50 [&>div>button:first-child]:border-0 [&>div>button:first-child]:rounded-none"
              >
                {plotBoxes.map((plot) => {
                  const id = plot.id
                  const idx = plotBoxes.findIndex(p => p.id === id)
                  const pNumber = idx + 1
                  const confirmed = confirmedPlotBoxIds.includes(id)
                  const isActive = displayPlot?.id === id
                  return (
                    <div
                      key={id}
                      className={cn('flex items-center w-full min-h-[28px] flex-shrink-0', confirmed && 'group')}
                    >
                      <PlotPButton
                        boxId={id}
                        pNumber={pNumber}
                        confirmed={confirmed}
                        isActive={isActive}
                        className="min-h-[28px] text-[10px] font-medium w-full"
                        onPButtonClick={handlePButtonClick}
                        onPButtonDoubleClick={handleBoxDoubleClick}
                        onActivate={() => setActivePlotBox(id)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          showPlotContextMenu(e, buildPlotContextItems('p-button', id))
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              {showPlotStripArrows && (
                <Tooltip content="아래로" side="bottom">
                  <button
                    type="button"
                    onClick={() => scrollPlotStrip('down')}
                    className="shrink-0 min-h-7 w-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
                    aria-label="아래로 4칸"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
          )
        ) : useExternalDndContext ? (
          <div ref={plotListRef} className="min-h-0 min-w-0 flex-1 flex flex-col overflow-x-hidden">
            <SortableContext items={sortablePlotIds} strategy={verticalListSortingStrategy}>
              {plotBoxes.map((box, index) => (
                <SortablePlotBox
                  key={box.id}
                  box={box}
                  index={index}
                  activeDragId={activePlotDragId}
                  isActive={activePlotBoxId === box.id}
                  isSelected={selectedPlotBoxIds.includes(box.id)}
                  isConfirmed={confirmedPlotBoxIds.includes(box.id)}
                  isPreviousConfirmed={index > 0 && confirmedPlotBoxIds.includes(plotBoxes[index - 1].id)}
                  isNextConfirmed={index + 1 < plotBoxes.length && confirmedPlotBoxIds.includes(plotBoxes[index + 1].id)}
                  isPreSelected={selectedPlotBoxIds.includes(box.id)}
                  plotContentVisible={plotContentVisible}
                  onActivate={(e) => handleBoxActivate(e, box.id)}
                  onUpdateContent={(content) => handlePlotContent(box.id, content)}
                  onUpdateTitle={(title) => handlePlotTitle(box.id, title)}
                  titleOverride={draftTitleByPlotId[box.id]}
                  contentOverride={draftContentByPlotId[box.id]}
                  onTitleBlur={() => flushPlotTitle(box.id)}
                  onContentBlur={() => flushPlotContent(box.id)}
                  onKeyDown={handlePlotKeyDown}
                  autoResize={autoResize}
                  textareaRef={(el, idx) => {
                    if (el) textareaRefs.current.set(idx, el)
                    else textareaRefs.current.delete(idx)
                  }}
                  editingTitleId={editingTitleId}
                  setEditingTitleId={setEditingTitleId}
                  titleInputRef={titleInputRef}
                  onTitleCommitAndFocusContent={(idx) => {
                    requestAnimationFrame(() => {
                      const el = textareaRefs.current.get(idx)
                      el?.focus()
                    })
                  }}
                  onContextMenuRequest={(e, role, boxId) => showPlotContextMenu(e, buildPlotContextItems(role, boxId))}
                  onBodyClick={handleBodyClick}
                  onPButtonClick={handlePButtonClick}
                  onPButtonDoubleClick={handleBoxDoubleClick}
                  onBoxDoubleClick={handleBoxDoubleClickWithClear}
                  onAddPlotBox={() => insertPlotBoxAtUndoable(episodeId, index + 1)}
                />
              ))}
            </SortableContext>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div ref={plotListRef} className="min-h-0 min-w-0 flex-1 flex flex-col overflow-x-hidden">
              <SortableContext items={sortablePlotIds} strategy={verticalListSortingStrategy}>
                {plotBoxes.map((box, index) => (
                  <SortablePlotBox
                    key={box.id}
                    box={box}
                    index={index}
                    activeDragId={activePlotDragId}
                    isActive={activePlotBoxId === box.id}
                    isSelected={selectedPlotBoxIds.includes(box.id)}
                    isConfirmed={confirmedPlotBoxIds.includes(box.id)}
                    isPreviousConfirmed={index > 0 && confirmedPlotBoxIds.includes(plotBoxes[index - 1].id)}
                    isNextConfirmed={index + 1 < plotBoxes.length && confirmedPlotBoxIds.includes(plotBoxes[index + 1].id)}
                    isPreSelected={selectedPlotBoxIds.includes(box.id)}
                    plotContentVisible={plotContentVisible}
                    onActivate={(e) => handleBoxActivate(e, box.id)}
                    onUpdateContent={(content) => handlePlotContent(box.id, content)}
                    onUpdateTitle={(title) => handlePlotTitle(box.id, title)}
                    titleOverride={draftTitleByPlotId[box.id]}
                    contentOverride={draftContentByPlotId[box.id]}
                    onTitleBlur={() => flushPlotTitle(box.id)}
                    onContentBlur={() => flushPlotContent(box.id)}
                    onKeyDown={handlePlotKeyDown}
                    autoResize={autoResize}
                    textareaRef={(el, idx) => {
                    if (el) textareaRefs.current.set(idx, el)
                    else textareaRefs.current.delete(idx)
                  }}
                    editingTitleId={editingTitleId}
                    setEditingTitleId={setEditingTitleId}
                    titleInputRef={titleInputRef}
                    onTitleCommitAndFocusContent={(idx) => {
                      requestAnimationFrame(() => {
                        const el = textareaRefs.current.get(idx)
                        el?.focus()
                      })
                    }}
                    onContextMenuRequest={(e, role, boxId) => showPlotContextMenu(e, buildPlotContextItems(role, boxId))}
                    onBodyClick={handleBodyClick}
                    onPButtonClick={handlePButtonClick}
                    onPButtonDoubleClick={handleBoxDoubleClick}
                    onBoxDoubleClick={handleBoxDoubleClickWithClear}
                    onAddPlotBox={() => insertPlotBoxAtUndoable(episodeId, index + 1)}
                  />
                ))}
              </SortableContext>
            </div>
            <DragOverlay dropAnimation={null}>
              {activePlotDragId ? (() => {
                const box = plotBoxes.find(b => b.id === activePlotDragId)
                if (!box) return null
                return (
                  <div
                    className="group relative p-3 border-b border-border select-none bg-background shadow-lg rounded cursor-grabbing"
                    style={{ width: overlayWidthForOverlay, boxSizing: 'border-box' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium truncate flex-1 min-w-0">{box.title || '제목 없음'}</span>
                      <span className="text-[9px] text-muted-foreground shrink-0">{box.scriptUnits.length}</span>
                    </div>
                    {box.content && (
                      <p className="text-[11px] text-muted-foreground truncate mt-1 single-line">{box.content.slice(0, 60)}{box.content.length > 60 ? '…' : ''}</p>
                    )}
                  </div>
                )
              })() : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
      {plotCtx && <ContextMenu items={plotCtx.items} position={plotCtx.position} portalTarget={plotCtx.portalTarget} onClose={closePlotContextMenu} />}
    </div>
  )
}
