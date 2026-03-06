import { useScriptEditor } from '@/hooks/useScriptEditor'
import { useScriptSelection } from '@/hooks/script/useScriptSelection'
import { useSegmentEmptyTap } from '@/hooks/script/useSegmentEmptyTap'
import { useScriptContextMenu } from '@/hooks/script/useScriptContextMenu'
import { CommandPalette } from './palettes/CommandPalette'
import { AtPalette } from './palettes/AtPalette'
import { SortableScriptUnit } from './ScriptUnit'
import { ScriptEmptyPlaceholder } from './ScriptEmptyPlaceholder'
import { ScriptEditorHeader } from './ScriptEditorHeader'
import { ScriptDragOverlay } from './ScriptDragOverlay'
import { ContextMenu, useContextMenu } from '@/components/ui/ContextMenu'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { useEditorStore } from '@/store/editor/editorStore'
import { useUIStore } from '@/store/ui/uiStore'
import { useRef, useEffect, useState, useCallback, Fragment } from 'react'
import { flushSync } from 'react-dom'
import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core'
import type { DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ScriptUnit } from '@/types/sw'
import { parseColonPattern } from '@/lib/colonAsDialogue'
import { keyedDebounce } from '@/lib/debounce'
import { getDialogueTypingMaxWidth } from '@/lib/scriptStyles'
import { getCaretIndexFromPoint } from '@/lib/caretFromPoint'
import { groupScriptUnitsByCharacter } from '@/lib/scriptGrouping'
import { INSERT_BEFORE_PREFIX, INSERT_AFTER_PREFIX } from './constants'
import { useWorkspaceDndContext } from '@/components/layout/WorkspaceDndWrapper'
import { DRAG_OVERLAY_DEFAULT_WIDTH, SELECTION_EXEMPT_SELECTORS } from './constants'
import { PlotDropZone } from './script/PlotDropZone'
import { AppendZone } from './script/AppendZone'
import { InsertZone } from './script/InsertZone'
import { cn } from '@/lib/utils'

type LayoutModeVertical = 'vertical'

interface ScriptEditorProps {
  episodeId: string
  layoutMode?: LayoutModeVertical
  useExternalDndContext?: boolean
}

const CONTENT_DEBOUNCE_MS = 280

export function ScriptEditor({ episodeId, useExternalDndContext = false }: ScriptEditorProps) {
  const [localScriptDragIds, setLocalScriptDragIds] = useState<string[]>([])
  const [localDropPlaceholderOverId, setLocalDropPlaceholderOverId] = useState<string | null>(null)
  const [draftContentByUnitId, setDraftContentByUnitId] = useState<Record<string, string>>({})
  const pendingContentRef = useRef<Record<string, string>>({})
  const pendingPlotBoxIdRef = useRef<Record<string, string>>({})
  const commitContentUpdateRef = useRef<(plotBoxId: string, unitId: string, content: string) => void>(() => {})
  const contentDebounceRef = useRef<ReturnType<typeof keyedDebounce<string>> | null>(null)
  if (contentDebounceRef.current === null) {
    contentDebounceRef.current = keyedDebounce<string>((unitId, value) => {
      const v = value as { plotBoxId: string; content: string }
      setDraftContentByUnitId(prev => {
        const n = { ...prev }
        delete n[unitId]
        return n
      })
      commitContentUpdateRef.current(v.plotBoxId, unitId, v.content)
    }, CONTENT_DEBOUNCE_MS)
  }
  const contentDebounce = contentDebounceRef.current
  const {
    activePlotBoxId,
    plotBox,
    plotBoxIndex,
    scriptUnits,
    combinedScriptUnits,
    displayPlots,
    plotBoxesSorted,
    getPlotBoxIdForUnit,
    characters,
    sensors,
    activeUnitId,
    setActiveUnitId,
    selectedScriptUnitIds,
    setSelectedScriptUnitIds,
    editingPlotTitle,
    setEditingPlotTitle,
    palettePosition,
    setPalettePosition,
    commandPaletteOpen,
    containerRef,
    textareaRefs,
    setFocusUnitId,
    propertyLabels,
    getCharacterName,
    getCharacterColor,
    getPropertyStyle,
    autoResize,
    handleDragEnd,
    handleDragOver,
    handleTextareaKeyDown,
    handleInsertUnit,
    handleInsertFirstUnitIntoPlot,
    handleCommandSelect,
    handleCommandCancel,
    openCommandPalette,
    atPalette,
    handleAtSelect,
    handleAtCancelWithKey,
    updatePlotBox,
    updateScriptUnit,
    setCurrentCharacter,
    removeScriptUnitUndoable,
    insertScriptUnitAfterUndoable,
    handleInsertBeforeUnit,
    handleInsertAfterUnit,
    handleAddScriptAtBottom,
  } = useScriptEditor(episodeId, {
    onDropOverChange: useExternalDndContext ? undefined : (id) => setLocalDropPlaceholderOverId(id),
  })

  const workspaceDnd = useWorkspaceDndContext()
  const activeScriptDragIds = useExternalDndContext ? (workspaceDnd?.activeScriptDragIds ?? []) : localScriptDragIds
  const dropPlaceholderOverId = useExternalDndContext ? (workspaceDnd?.dropPlaceholderOverId ?? null) : localDropPlaceholderOverId
  const uiScalePercent = useSettingsStore((s) => s.uiScalePercent)
  const scriptListRef = useRef<HTMLDivElement>(null)
  const scriptScrollContainerRef = useRef<HTMLDivElement>(null)
  const [scriptOverlayWidthLocal, setScriptOverlayWidthLocal] = useState(DRAG_OVERLAY_DEFAULT_WIDTH)
  const [visibleSegmentIndices, setVisibleSegmentIndices] = useState<number[]>([])
  const visibleSegmentIndicesRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!useExternalDndContext || !workspaceDnd?.setScriptOverlayWidth) return
    const el = scriptListRef.current
    if (!el) return
    const update = () => workspaceDnd.setScriptOverlayWidth(el.offsetWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [useExternalDndContext, workspaceDnd?.setScriptOverlayWidth, scriptUnits.length])
  const setSelectedPlotBoxIds = useUIStore(state => state.setSelectedPlotBoxIds)
  const clearAllSelection = useUIStore(state => state.clearAllSelection)
  const restoreFocusUnitIdRef = useRef<string | null>(null)
  const inlineTextDragRef = useRef<{
    sourceUnitId: string
    sourcePlotBoxId: string
    selectedText: string
    rangeStart: number
    rangeEnd: number
  } | null>(null)
  const handleInlineTextDragStart = useCallback(
    (sourceUnitId: string, sourcePlotBoxId: string, selectedText: string, rangeStart: number, rangeEnd: number) => {
      inlineTextDragRef.current = { sourceUnitId, sourcePlotBoxId, selectedText, rangeStart, rangeEnd }
    },
    []
  )
  const handleInlineTextDrop = useCallback(
    (targetUnitId: string, targetPlotBoxId: string, insertIndexFallback: number, clientX?: number, clientY?: number, targetTextarea?: HTMLTextAreaElement) => {
      const state = inlineTextDragRef.current
      inlineTextDragRef.current = null
      if (!state) return
      const sourceEntry = combinedScriptUnits.find(c => c.unit.id === state.sourceUnitId)
      const targetEntry = combinedScriptUnits.find(c => c.unit.id === targetUnitId)
      if (!sourceEntry || !targetEntry) return
      const sourceContent = sourceEntry.unit.content ?? ''
      const targetContent = targetEntry.unit.content ?? ''
      const newSourceContent = sourceContent.slice(0, state.rangeStart) + sourceContent.slice(state.rangeEnd)
      const isSameUnit = state.sourceUnitId === targetUnitId && state.sourcePlotBoxId === targetPlotBoxId
      const taForPoint = targetTextarea ?? textareaRefs.current.get(targetUnitId)
      let insertIndex =
        taForPoint != null && typeof clientX === 'number' && typeof clientY === 'number'
          ? getCaretIndexFromPoint(taForPoint, clientX, clientY, insertIndexFallback)
          : insertIndexFallback
      if (isSameUnit) {
        const { rangeStart, rangeEnd } = state
        const effectiveInsertIndex =
          insertIndex <= rangeStart
            ? insertIndex
            : insertIndex >= rangeEnd
              ? insertIndex - (rangeEnd - rangeStart)
              : rangeStart
        const newContent = newSourceContent.slice(0, effectiveInsertIndex) + state.selectedText + newSourceContent.slice(effectiveInsertIndex)
        const cursorPosSame = effectiveInsertIndex + state.selectedText.length
        const dropTarget = targetTextarea ?? textareaRefs.current.get(targetUnitId)
        flushSync(() => {
          updateScriptUnit(episodeId, state.sourcePlotBoxId, state.sourceUnitId, { content: newContent })
          setFocusUnitId(targetUnitId)
          setActiveUnitId(targetUnitId)
        })
        if (dropTarget && document.contains(dropTarget)) {
          dropTarget.focus({ preventScroll: false })
          dropTarget.setSelectionRange(cursorPosSame, cursorPosSame)
          const pos = cursorPosSame
          setTimeout(() => { if (document.contains(dropTarget)) { dropTarget.focus({ preventScroll: false }); dropTarget.setSelectionRange(pos, pos) } }, 0)
        }
      } else {
        const newTargetContent =
          targetContent.slice(0, insertIndex) + state.selectedText + targetContent.slice(insertIndex)
        const cursorPosOther = insertIndex + state.selectedText.length
        const dropTarget = targetTextarea ?? textareaRefs.current.get(targetUnitId)
        flushSync(() => {
          updateScriptUnit(episodeId, state.sourcePlotBoxId, state.sourceUnitId, { content: newSourceContent })
          updateScriptUnit(episodeId, targetPlotBoxId, targetUnitId, { content: newTargetContent })
          setFocusUnitId(targetUnitId)
          setActiveUnitId(targetUnitId)
        })
        if (dropTarget && document.contains(dropTarget)) {
          dropTarget.focus({ preventScroll: false })
          dropTarget.setSelectionRange(cursorPosOther, cursorPosOther)
          const pos = cursorPosOther
          setTimeout(() => { if (document.contains(dropTarget)) { dropTarget.focus({ preventScroll: false }); dropTarget.setSelectionRange(pos, pos) } }, 0)
        }
      }
    },
    [combinedScriptUnits, episodeId, updateScriptUnit, setFocusUnitId, setActiveUnitId, textareaRefs]
  )

  const handleDeleteSelected = useCallback((unitIds: string[]) => {
    if (unitIds.length === 0) return
    const withPlot = unitIds
      .map(id => ({ id, plotBoxId: getPlotBoxIdForUnit(id), unit: combinedScriptUnits.find(c => c.unit.id === id)?.unit }))
      .filter((x): x is typeof x & { plotBoxId: string; unit: import('@/types/sw').ScriptUnit } => !!x.plotBoxId && !!x.unit)
    const byPlot = new Map<string, typeof withPlot>()
    for (const x of withPlot) {
      const list = byPlot.get(x.plotBoxId) ?? []
      list.push(x)
      byPlot.set(x.plotBoxId, list)
    }
    for (const [, list] of byPlot) {
      list.sort((a, b) => (b.unit.order ?? 0) - (a.unit.order ?? 0))
      for (const { id, plotBoxId } of list) {
        removeScriptUnitUndoable(episodeId, plotBoxId, id)
      }
    }
    setSelectedScriptUnitIds([])
  }, [episodeId, getPlotBoxIdForUnit, combinedScriptUnits, removeScriptUnitUndoable, setSelectedScriptUnitIds])

  const { handleUnitSelect, handleDragSelectStart, isDragSelecting } = useScriptSelection({
    scriptUnits,
    selectedScriptUnitIds,
    setSelectedScriptUnitIds,
    activeUnitId,
    setActiveUnitId,
    textareaRefs,
    restoreFocusUnitIdRef,
    onDeleteSelected: handleDeleteSelected,
  })

  const segments = displayPlots.map(plot => ({
    plot,
    units: combinedScriptUnits.filter(c => c.plotBoxId === plot.id).map(c => c.unit),
  }))

  const orderedScriptUnits = segments.flatMap(s => s.units)
  const orderedScriptUnitsRef = useRef(orderedScriptUnits)
  const activeUnitIdRef = useRef(activeUnitId)
  orderedScriptUnitsRef.current = orderedScriptUnits
  activeUnitIdRef.current = activeUnitId

  useEffect(() => {
    const el = scriptScrollContainerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = el
      const threshold = 4
      const atTop = scrollTop <= threshold
      const atBottom = scrollTop + clientHeight >= scrollHeight - threshold
      const units = orderedScriptUnitsRef.current
      if (atTop && e.deltaY < 0 && units.length > 0) {
        e.preventDefault()
        const idx = activeUnitIdRef.current ? units.findIndex(u => u.id === activeUnitIdRef.current) : 0
        const targetIdx = idx <= 0 ? units.length - 1 : idx - 1
        const prev = units[targetIdx]
        if (prev) {
          setSelectedScriptUnitIds([prev.id])
          setActiveUnitId(prev.id)
          el.querySelector(`[data-unit-id="${prev.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
        return
      }
      if (atBottom && e.deltaY > 0 && units.length > 0) {
        e.preventDefault()
        const idx = activeUnitIdRef.current ? units.findIndex(u => u.id === activeUnitIdRef.current) : units.length - 1
        const targetIdx = idx >= units.length - 1 ? 0 : idx + 1
        const next = units[targetIdx]
        if (next) {
          setSelectedScriptUnitIds([next.id])
          setActiveUnitId(next.id)
          el.querySelector(`[data-unit-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
        return
      }
      // 휠 시 항상 스크롤 컨테이너가 스크롤되도록 수동 처리 (textarea 위/포커스 없을 때도 스크롤 가능)
      e.preventDefault()
      el.scrollTop += e.deltaY
      if (e.deltaX) el.scrollLeft += e.deltaX
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setSelectedScriptUnitIds, setActiveUnitId])

  const dialogueColorMode = useSettingsStore(state => state.dialogueColorMode)
  const dialogueCustomColor = useSettingsStore(state => state.dialogueCustomColor)
  const dialogueParagraphGap = useSettingsStore(state => state.dialogueParagraphGap)
  const dialogueTypingWidth = useSettingsStore(state => state.dialogueTypingWidth)
  const dialogueTypingWidthCh = useSettingsStore(state => state.dialogueTypingWidthCh)
  const unitDivider = useSettingsStore(state => state.unitDivider)
  const enterDefaultType = useSettingsStore(state => state.enterDefaultType)
  const startTypingType = useSettingsStore(state => state.startTypingType)
  const currentCharacterId = useEditorStore(state => state.currentCharacterId)

  const colonAsDialogue = useSettingsStore(state => state.colonAsDialogue)
  const flushDraftForUnit = useCallback((unitId: string) => {
    contentDebounce.flush(unitId)
  }, [])
  commitContentUpdateRef.current = (plotBoxId: string, unitId: string, content: string) => {
    if (selectedScriptUnitIds.length >= 1) setSelectedScriptUnitIds([])
    if (!colonAsDialogue) {
      updateScriptUnit(episodeId, plotBoxId, unitId, { content })
      return
    }
    const parsed = parseColonPattern(content, characters)
    if (parsed == null) {
      updateScriptUnit(episodeId, plotBoxId, unitId, { content })
      return
    }
    const { bestPos, bestChar, bestPattern, dialogueLabel } = parsed
    const updates: Partial<ScriptUnit> = { type: 'dialogue', characterId: bestChar.id, content: '', dialogueLabel }
    if (bestPos === 0) {
      const afterColon = content.slice(bestPattern.length)
      updateScriptUnit(episodeId, plotBoxId, unitId, { ...updates, content: afterColon })
      setFocusUnitId(unitId)
      requestAnimationFrame(() => {
        const ta = textareaRefs.current.get(unitId)
        if (ta) { ta.focus(); ta.setSelectionRange(0, 0) }
      })
      return
    }
    const beforeContent = content.substring(0, bestPos)
    const afterContent = content.substring(bestPos + bestPattern.length)
    updateScriptUnit(episodeId, plotBoxId, unitId, { content: beforeContent })
    const newId = insertScriptUnitAfterUndoable(episodeId, plotBoxId, unitId, 'dialogue', bestChar.id)
    updateScriptUnit(episodeId, plotBoxId, newId, { content: afterContent, ...(dialogueLabel !== undefined ? { dialogueLabel } : {}) })
    setFocusUnitId(newId)
    requestAnimationFrame(() => {
      const ta = textareaRefs.current.get(newId)
      if (ta) { ta.focus(); ta.setSelectionRange(0, 0) }
    })
  }
  const handleUpdateContent = useCallback((plotBoxId: string, unitId: string, content: string) => {
    setDraftContentByUnitId(prev => ({ ...prev, [unitId]: content }))
    pendingContentRef.current[unitId] = content
    pendingPlotBoxIdRef.current[unitId] = plotBoxId
    contentDebounce.schedule(unitId, () => ({
      content: pendingContentRef.current[unitId],
      plotBoxId: pendingPlotBoxIdRef.current[unitId],
    }))
  }, [])

  const characterNameStyle = getPropertyStyle('character')
  const { ctx: scriptCtx, show: showScriptContextMenu, close: closeScriptContextMenu } = useContextMenu()
  const lastScriptContextTargetIdsRef = useRef<string[]>([])
  const emptyScenarioRef = useRef<HTMLDivElement>(null)
  const createSegmentEmptyHandlers = useSegmentEmptyTap()
  const setRequestScenarioFocus = useUIStore(state => state.setRequestScenarioFocus)
  const scrollToPlotBoxId = useUIStore(state => state.scrollToPlotBoxId)
  const setScrollToPlotBoxId = useUIStore(state => state.setScrollToPlotBoxId)
  const focusBottomScript = useCallback(() => {
    if (scriptUnits.length === 0) {
      emptyScenarioRef.current?.focus()
    } else {
      const lastId = scriptUnits[scriptUnits.length - 1]?.id
      if (lastId) textareaRefs.current.get(lastId)?.focus()
    }
  }, [scriptUnits])

  useEffect(() => {
    setRequestScenarioFocus(focusBottomScript)
    return () => setRequestScenarioFocus(null)
  }, [setRequestScenarioFocus, focusBottomScript])

  useEffect(() => {
    if (!scrollToPlotBoxId) return
    const container = scriptScrollContainerRef.current
    if (!container) return
    const segmentEl = container.querySelector(`[data-plot-segment="${scrollToPlotBoxId}"]`) as HTMLElement | null
    if (segmentEl) {
      segmentEl.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
    setScrollToPlotBoxId(null)
  }, [scrollToPlotBoxId, setScrollToPlotBoxId])

  useEffect(() => {
    if (displayPlots.length < 2) return
    const n = displayPlots.length
    let cancelled = false
    let disconnect: (() => void) | undefined
    const rafId = requestAnimationFrame(() => {
      const container = scriptScrollContainerRef.current
      const listEl = scriptListRef.current
      if (!container || !listEl || cancelled) return
      const segmentEls = listEl.querySelectorAll('[data-plot-segment][data-segment-index]')
      if (segmentEls.length === 0) {
        setVisibleSegmentIndices((prev) => (prev.length === n ? prev : Array.from({ length: n }, (_, i) => i)))
        return
      }
      const visible = visibleSegmentIndicesRef.current
      visible.clear()
      const io = new IntersectionObserver(
        (entries) => {
          if (cancelled) return
          entries.forEach((entry) => {
            const idx = entry.target.getAttribute('data-segment-index')
            if (idx == null) return
            const i = parseInt(idx, 10)
            if (!Number.isNaN(i) && entry.intersectionRatio > 0) visible.add(i)
            else visible.delete(i)
          })
          const next = Array.from(visible).sort((a, b) => a - b)
          setVisibleSegmentIndices((prev) =>
            prev.length === next.length && prev.every((v, j) => v === next[j]) ? prev : next
          )
        },
        { root: null, rootMargin: '0px', threshold: [0, 0.01, 1] }
      )
      segmentEls.forEach((el) => io.observe(el))
      disconnect = () => io.disconnect()
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      disconnect?.()
    }
  }, [displayPlots.length, segments.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (commandPaletteOpen) return
      e.preventDefault()
      focusBottomScript()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [focusBottomScript, commandPaletteOpen])

  useEffect(() => {
    if (!scriptCtx) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const num = e.key === '0' ? 0 : parseInt(e.key, 10)
      if (num >= 0 && num <= 9) {
        const char = characters.find(c => c.shortcut === num)
        if (char && lastScriptContextTargetIdsRef.current.length > 0) {
          lastScriptContextTargetIdsRef.current.forEach(id => {
            const pId = getPlotBoxIdForUnit(id)
            if (pId) updateScriptUnit(episodeId, pId, id, { type: 'dialogue', characterId: char.id })
          })
          setCurrentCharacter(char.id)
          closeScriptContextMenu()
          e.preventDefault()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [scriptCtx, characters, getPlotBoxIdForUnit, episodeId, updateScriptUnit, setCurrentCharacter, closeScriptContextMenu])

  const { scriptContextItems, buildScriptContextItems, multiSelectScriptItems } = useScriptContextMenu({
    episodeId,
    scriptUnits,
    selectedScriptUnitIds,
    activeUnitId,
    setSelectedScriptUnitIds,
    setActiveUnitId,
    getPlotBoxIdForUnit,
    updateScriptUnit,
    setCurrentCharacter,
    removeScriptUnitUndoable,
    characters,
    propertyLabels,
    currentCharacterId: currentCharacterId ?? null,
    setPalettePosition,
    openCommandPalette,
    onAddScriptAtBottom: handleAddScriptAtBottom,
  })

  const showScriptContextMenuForUnit = (
    e: React.MouseEvent,
    role: 'script-body' | 'script-handle' | 'script-group-handle',
    unitId?: string,
    plotBoxId?: string,
    groupUnitIds?: string[],
  ) => {
    if (groupUnitIds?.length) {
      lastScriptContextTargetIdsRef.current = groupUnitIds
    } else {
      lastScriptContextTargetIdsRef.current =
        unitId && selectedScriptUnitIds.includes(unitId) && selectedScriptUnitIds.length >= 2
          ? selectedScriptUnitIds
          : unitId ? [unitId] : []
    }
    showScriptContextMenu(e, buildScriptContextItems(role, unitId, plotBoxId, groupUnitIds))
  }

  const buildScriptUnitProps = useCallback(
    (
      unit: ScriptUnit,
      plotBoxId: string,
      overrides: Partial<{
        hideCharacterLabel: boolean
        showCharacterNameInDialogue: boolean
        groupUnitIds: string[] | undefined
        hideIndividualHandle: boolean
        onGroupSelect: (() => void) | undefined
        onGroupPointerDown: ((unitIds: string[]) => void) | undefined
        onSelect: (ev: React.MouseEvent) => void
        onRenameExtraInGroup: (unitIds: string[], newLabel: string) => void
        isFirstInSelectedGroup: boolean
        isLastInSelectedGroup: boolean
        showSelectionBgOnCharRow: boolean
        hideCharacterNameDuringDrag: boolean
      }> = {}
    ) => ({
      isDragSelectingHighlight: isDragSelecting,
      unit,
      contentOverride: draftContentByUnitId[unit.id],
      activeDragIds: activeScriptDragIds,
      index: scriptUnits.findIndex(u => u.id === unit.id),
      episodeId,
      activePlotBoxId: plotBoxId,
      isActive: activeUnitId === unit.id,
      isSelected: selectedScriptUnitIds.includes(unit.id),
      onSelect: (ev: React.MouseEvent) => handleUnitSelect(ev, unit.id),
      onFocus: () => {
        setActiveUnitId(unit.id)
        if (restoreFocusUnitIdRef.current === unit.id) {
          restoreFocusUnitIdRef.current = null
          return
        }
        // 포커스한 유닛이 현재 선택에 포함돼 있으면 선택 유지(Ctrl+C로 유형 포함 복사 가능). 다른 유닛 포커스 시에만 선택 해제
        if (!selectedScriptUnitIds.includes(unit.id)) {
          setSelectedScriptUnitIds([])
        }
      },
      onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => {
        flushDraftForUnit(unit.id)
        const next = e.relatedTarget
        if (next && [...textareaRefs.current.values()].includes(next as HTMLTextAreaElement)) return
        document.getSelection()?.removeAllRanges()
      },
      onUpdateContent: (content: string) => handleUpdateContent(plotBoxId, unit.id, content),
      onKeyDown: handleTextareaKeyDown,
      onRemove: () => removeScriptUnitUndoable(episodeId, plotBoxId, unit.id),
      onChangeCharacter: (unitId: string, charId: string) => {
        const extraChar = characters.find(c => c.name === '엑스트라')
        const patch: { characterId: string; dialogueLabel?: undefined } = { characterId: charId }
        if (!extraChar || charId !== extraChar.id) patch.dialogueLabel = undefined
        updateScriptUnit(episodeId, plotBoxId, unitId, patch)
        setCurrentCharacter(charId)
      },
      autoResize,
      textareaRef: (el: HTMLTextAreaElement | null) => {
        if (el) textareaRefs.current.set(unit.id, el)
        else textareaRefs.current.delete(unit.id)
      },
      getCharacterName,
      getPropertyStyle,
      propertyLabels,
      characters,
      dialogueColorMode,
      dialogueCustomColor,
      dialogueParagraphGap,
      dialogueTypingMaxWidth: getDialogueTypingMaxWidth(dialogueTypingWidth, dialogueTypingWidthCh),
      onContextMenuRequest: (e: React.MouseEvent, role: 'script-body' | 'script-handle' | 'script-group-handle', groupUnitIds?: string[]) =>
        showScriptContextMenuForUnit(e, role, unit.id, plotBoxId, groupUnitIds),
      onDragSelectStart: handleDragSelectStart,
      onInlineTextDragStart: handleInlineTextDragStart,
      onInlineTextDrop: handleInlineTextDrop,
      onUnitBodyPointerDownCapture: (e: React.PointerEvent, unitId: string) => {
        if (textareaRefs.current.get(unitId) === document.activeElement) e.preventDefault()
      },
      ...overrides,
    }),
    [
      activeScriptDragIds,
      scriptUnits,
      draftContentByUnitId,
      flushDraftForUnit,
      episodeId,
      activeUnitId,
      selectedScriptUnitIds,
      setSelectedScriptUnitIds,
      restoreFocusUnitIdRef,
      isDragSelecting,
      handleUnitSelect,
      handleUpdateContent,
      handleTextareaKeyDown,
      removeScriptUnitUndoable,
      updateScriptUnit,
      setCurrentCharacter,
      currentCharacterId,
      characters,
      autoResize,
      textareaRefs,
      getCharacterName,
      getPropertyStyle,
      propertyLabels,
      dialogueColorMode,
      dialogueCustomColor,
      dialogueParagraphGap,
      dialogueTypingWidth,
      dialogueTypingWidthCh,
      showScriptContextMenuForUnit,
      handleDragSelectStart,
      handleInlineTextDragStart,
      handleInlineTextDrop,
    ]
  )

  const renderSegmentContent = useCallback(
    (segment: (typeof segments)[0], segmentIndex: number) => {
      const plotBoxId = segment.plot.id
      const plotOrder = plotBoxesSorted.findIndex(p => p.id === segment.plot.id) + 1
      const groups = groupScriptUnitsByCharacter(segment.units, getCharacterName, getCharacterColor)
      return (
        <div key={segment.plot.id} data-plot-segment={segment.plot.id} data-segment-index={segmentIndex} className={segmentIndex > 0 ? 'border-t border-border pt-3' : ''}>
          {displayPlots.length >= 2 ? (
            <PlotDropZone plotId={segment.plot.id} plotLabel={`P${plotOrder}`} className="mb-2 flex min-h-[32px] w-full items-center border-l-2 border-border pl-2">
              <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[200px]">
                {segment.plot.title ? `P${plotOrder} · ${segment.plot.title}` : `P${plotOrder}`}
              </span>
            </PlotDropZone>
          ) : displayPlots.length === 1 ? (
            <PlotDropZone plotId={segment.plot.id} plotLabel={`P${plotOrder}`} className="mb-1 min-h-[4px]" />
          ) : segmentIndex > 0 ? (
            <div className="mb-2 flex min-h-[32px] w-full items-center border-l-2 border-border pl-2">
              <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[200px]">
                {segment.plot.title ? `P${plotOrder} · ${segment.plot.title}` : `P${plotOrder}`}
              </span>
            </div>
          ) : null}
          {segment.units.length === 0 ? (
            <ScriptEmptyPlaceholder
              data-segment-empty
              variant="segment"
              onInsert={() => {
                const id = handleInsertFirstUnitIntoPlot(plotBoxId, startTypingType)
                if (id) setFocusUnitId(id)
                return id ?? undefined
              }}
              onOpenCommandPalette={() => { setPalettePosition(undefined); openCommandPalette() }}
              includeTab
              insertOnlyOnDoubleClick={displayPlots.length >= 2}
              {...createSegmentEmptyHandlers(
                plotBoxId,
                () => handleInsertFirstUnitIntoPlot(plotBoxId, startTypingType) ?? undefined,
                setFocusUnitId
              )}
            />
          ) : (
            groups.map((group, groupIndex) => {
              const dividerEl = unitDivider !== 'none' && groupIndex > 0 ? (
                <div className={unitDivider === 'line' ? 'script-unit-divider-line' : 'my-0.5 flex justify-center'}>
                  {unitDivider === 'dot' && <span className="text-[6px] text-muted-foreground/30">&#x2022;</span>}
                </div>
              ) : null
              if (group.type === 'dialogue-group') {
                const groupIds = group.units.map(u => u.id)
                const isGroupFullySelected =
                  selectedScriptUnitIds.length === groupIds.length &&
                  groupIds.every(id => selectedScriptUnitIds.includes(id))
                const hideCharNameDuringDrag = activeScriptDragIds.length > 0
                return (
                  <div key={`group-${segment.plot.id}-${groupIndex}`}>
                    {dividerEl}
                    <div
                      className="space-y-0"
                      style={undefined}
                    >
                      {group.units.map((unit, unitIndex) => (
                        <Fragment key={unit.id}>
                          <InsertZone
                            plotBoxId={segment.plot.id}
                            beforeUnitId={unit.id}
                            onInsert={handleInsertBeforeUnit}
                            indentForGroup
                            isDropTarget={
                              activeScriptDragIds.length > 0 &&
                              (dropPlaceholderOverId === unit.id || dropPlaceholderOverId === INSERT_BEFORE_PREFIX + unit.id)
                            }
                          />
                          <SortableScriptUnit
                            {...buildScriptUnitProps(unit, plotBoxId, {
                              hideCharacterLabel: false,
                              showCharacterNameInDialogue: unitIndex === 0,
                              groupUnitIds: unitIndex === 0 ? groupIds : undefined,
                              hideIndividualHandle: isGroupFullySelected,
                              hideCharacterNameDuringDrag: unitIndex === 0 && hideCharNameDuringDrag,
                              onGroupSelect:
                                unitIndex === 0
                                  ? () => {
                                      const fullySelected =
                                        selectedScriptUnitIds.length === groupIds.length &&
                                        groupIds.every(id => selectedScriptUnitIds.includes(id))
                                      if (fullySelected) {
                                        setSelectedScriptUnitIds([])
                                      } else {
                                        setSelectedScriptUnitIds(groupIds)
                                        if (groupIds[0]) setActiveUnitId(groupIds[0])
                                      }
                                    }
                                  : undefined,
                              onGroupPointerDown:
                                unitIndex === 0 && !isGroupFullySelected
                                  ? () => {
                                      setSelectedScriptUnitIds(groupIds)
                                      if (groupIds[0]) setActiveUnitId(groupIds[0])
                                    }
                                  : undefined,
                              onSelect: (ev) => handleUnitSelect(ev, unit.id),
                              onRenameExtraInGroup: (unitIds, newLabel) => {
                                const v = newLabel.trim()
                                if (!v) return
                                const existingChar = characters.find(c => c.name !== '엑스트라' && c.name.trim() === v)
                                if (existingChar) {
                                  unitIds.forEach(id => {
                                    const pId = getPlotBoxIdForUnit(id)
                                    if (pId) updateScriptUnit(episodeId, pId, id, { characterId: existingChar.id, dialogueLabel: undefined })
                                  })
                                  setCurrentCharacter(existingChar.id)
                                } else {
                                  unitIds.forEach(id => {
                                    const pId = getPlotBoxIdForUnit(id)
                                    if (pId) updateScriptUnit(episodeId, pId, id, { dialogueLabel: v })
                                  })
                                }
                              },
                              isFirstInSelectedGroup: isGroupFullySelected && unitIndex === 0,
                              isLastInSelectedGroup: isGroupFullySelected && unitIndex === group.units.length - 1,
                              showSelectionBgOnCharRow: isGroupFullySelected,
                            })}
                          />
                        </Fragment>
                      ))}
                    </div>
                  </div>
                )
              }
              const unit = group.unit
              return (
                <div key={group.unit.id}>
                  {dividerEl}
                  <div className="w-full">
                    <InsertZone
                      plotBoxId={segment.plot.id}
                      beforeUnitId={unit.id}
                      onInsert={handleInsertBeforeUnit}
                      isDropTarget={
                        activeScriptDragIds.length > 0 &&
                        (dropPlaceholderOverId === unit.id || dropPlaceholderOverId === INSERT_BEFORE_PREFIX + unit.id)
                      }
                    />
                    <SortableScriptUnit
                      {...buildScriptUnitProps(group.unit, plotBoxId, {
                        showCharacterNameInDialogue: group.unit.type === 'dialogue',
                        hideIndividualHandle: false,
                      })}
                    />
                  </div>
                </div>
              )
            })
          )}
          {displayPlots.length < 2 && segment.units.length > 0 && (() => {
            const lastUnit = segment.units[segment.units.length - 1]
            if (!lastUnit) return null
            return (
              <AppendZone
                plotBoxId={segment.plot.id}
                afterUnitId={lastUnit.id}
                onInsert={handleInsertAfterUnit}
                isDropTarget={
                  activeScriptDragIds.length > 0 &&
                  dropPlaceholderOverId === INSERT_AFTER_PREFIX + lastUnit.id
                }
              />
            )
          })()}
        </div>
      )
    },
    [
      displayPlots,
      plotBoxesSorted,
      unitDivider,
      selectedScriptUnitIds,
      setSelectedScriptUnitIds,
      setActiveUnitId,
      getCharacterName,
      getCharacterColor,
      handleInsertFirstUnitIntoPlot,
      setFocusUnitId,
      createSegmentEmptyHandlers,
      handleInsertBeforeUnit,
      handleInsertAfterUnit,
      activeScriptDragIds,
      dropPlaceholderOverId,
      buildScriptUnitProps,
      handleUnitSelect,
      getPlotBoxIdForUnit,
      updateScriptUnit,
      episodeId,
      setPalettePosition,
      openCommandPalette,
      startTypingType,
    ]
  )

  const handleScriptDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id)
    const ids =
      selectedScriptUnitIds.length >= 2 && selectedScriptUnitIds.includes(activeId)
        ? selectedScriptUnitIds
        : [activeId]
    if (!useExternalDndContext) setLocalScriptDragIds(ids)
    if (!useExternalDndContext) setLocalDropPlaceholderOverId(null)
    const el = scriptListRef.current?.querySelector(`[data-unit-id="${activeId}"]`) as HTMLElement | null
    if (el) setScriptOverlayWidthLocal(el.offsetWidth)
  }

  const handleScriptDragEnd = (event: Parameters<typeof handleDragEnd>[0]) => {
    if (!useExternalDndContext) setLocalScriptDragIds([])
    if (!useExternalDndContext) setLocalDropPlaceholderOverId(null)
    handleDragEnd(event)
    setSelectedScriptUnitIds([])
  }

  if (displayPlots.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <p className="text-[11px] text-muted-foreground/60">플롯을 선택하세요.</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-full min-h-0 min-w-0 w-full flex flex-col bg-background relative overflow-hidden"
      onContextMenu={(e) => showScriptContextMenu(e, scriptContextItems)}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement
        if (target.closest?.(SELECTION_EXEMPT_SELECTORS)) return
        document.getSelection()?.removeAllRanges()
        clearAllSelection()
      }}
    >
      <ScriptEditorHeader
        displayPlots={displayPlots}
        plotBoxesSorted={plotBoxesSorted}
        plotBoxIndex={plotBoxIndex}
        plotBox={plotBox}
        editingPlotTitle={editingPlotTitle}
        setEditingPlotTitle={setEditingPlotTitle}
        episodeId={episodeId}
        activePlotBoxId={activePlotBoxId}
        updatePlotBox={updatePlotBox}
        setPalettePosition={setPalettePosition}
        openCommandPalette={openCommandPalette}
        visibleSegmentIndices={visibleSegmentIndices}
        uiScalePercent={uiScalePercent}
      />

      <div
        ref={scriptScrollContainerRef}
        className={cn('flex-1 min-h-0 min-w-0 overflow-auto scrollbar-hide', isDragSelecting && 'select-none')}
      >
        {scriptUnits.length === 0 ? (
          <ScriptEmptyPlaceholder
            ref={emptyScenarioRef}
            variant="full"
            onInsert={() => {
              const id = handleInsertUnit(startTypingType)
              if (id) setFocusUnitId(id)
              return id ?? undefined
            }}
            onOpenCommandPalette={() => { setPalettePosition(undefined); openCommandPalette() }}
            onClick={() => emptyScenarioRef.current?.focus()}
          />
        ) : useExternalDndContext ? (
          <SortableContext
              items={scriptUnits.map(unit => unit.id)}
              strategy={verticalListSortingStrategy}
            >
              <div ref={scriptListRef} className="max-w-2xl mx-auto px-4 py-6 pb-32 space-y-0">
                {segments.map((segment, i) => renderSegmentContent(segment, i))}
              </div>
            </SortableContext>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleScriptDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleScriptDragEnd}
          >
            <SortableContext
              items={scriptUnits.map(unit => unit.id)}
              strategy={verticalListSortingStrategy}
            >
              <div ref={scriptListRef} className="max-w-2xl mx-auto px-4 py-6 pb-32 space-y-0">
                {segments.map((segment, i) => renderSegmentContent(segment, i))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeScriptDragIds.length > 0 ? (() => {
                const units = activeScriptDragIds
                  .map(id => scriptUnits.find(u => u.id === id))
                  .filter((u): u is NonNullable<typeof u> => u != null)
                if (units.length === 0) return null
                return (
                  <div className="pointer-events-none">
                  <ScriptDragOverlay
                    units={units}
                    overlayWidth={useExternalDndContext && workspaceDnd?.scriptOverlayWidth != null ? workspaceDnd.scriptOverlayWidth : scriptOverlayWidthLocal}
                    getCharacterName={getCharacterName}
                    propertyLabels={propertyLabels}
                  />
                  </div>
                )
              })() : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {commandPaletteOpen && (
        <CommandPalette
          onSelect={handleCommandSelect}
          onCancel={handleCommandCancel}
          position={palettePosition ? { x: palettePosition.x, y: palettePosition.y } : undefined}
          above={palettePosition?.above}
          characters={characters}
        />
      )}
      {atPalette.atInsertPos && (() => {
        const rect = atPalette.atInsertPos.rect
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 600
        const spaceBelow = viewportHeight - rect.bottom
        const dropdownHeight = 220
        const above = spaceBelow < dropdownHeight
        return (
        <AtPalette
          items={atPalette.filteredItems}
          position={{
            x: rect.left,
            y: above ? rect.top - 4 : rect.bottom + 4,
          }}
          above={above}
          useFixed
          onSelect={handleAtSelect}
          onCancel={atPalette.closeAtPalette}
          onCancelWithKey={handleAtCancelWithKey}
          query={atPalette.query}
          onQueryChange={atPalette.setQuery}
        />
        )
      })()}
      {scriptCtx && <ContextMenu items={scriptCtx.items} position={scriptCtx.position} portalTarget={scriptCtx.portalTarget} onClose={closeScriptContextMenu} />}
    </div>
  )
}
