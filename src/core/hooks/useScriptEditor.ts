import { useState, useMemo, useCallback, useEffect } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useEditorStore } from '@/store/editor/editorStore'
import { useUIStore, selectConfirmedPlotBoxIds } from '@/store/ui/uiStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { useUndoableProjectActions } from '@/hooks/useUndoableActions'
import { useScriptFocus } from './script/useScriptFocus'
import { useScriptDnd } from './script/useScriptDnd'
import { useScriptKeyboard } from './script/useScriptKeyboard'
import { useAtPalette } from './script/useAtPalette'
import { useScriptSlashPalette } from './script/useScriptSlashPalette'
import type { ScriptPropertyType } from '@/types'
import { getPropertyStyle as getSharedPropertyStyle } from '@/lib/scriptStyles'
import { UNKNOWN_CHARACTER_NAME } from '@/lib/scriptGrouping'

export interface UseScriptEditorOptions {
  onDropOverChange?: (overId: string | null) => void
}

export function useScriptEditor(episodeId: string, options?: UseScriptEditorOptions) {
  const { onDropOverChange } = options ?? {}
  const file = useProjectStore(state => state.file)
  const activePlotBoxId = useUIStore(state => state.activePlotBoxId)
  const confirmedPlotBoxIds = useUIStore(selectConfirmedPlotBoxIds)
  const propertyLabels = useSettingsStore(state => state.propertyLabels)
  const propertyStyles = useSettingsStore(state => state.propertyStyles)
  const defaultFontFamily = useSettingsStore(state => state.defaultFontFamily)
  const directionItems = useSettingsStore(state => state.directionItems)
  const directionModeEnabled = useSettingsStore(state => state.directionModeEnabled)
  const { reorderScriptUnitGroupUndoable, reorderScriptUnitsUndoable, moveScriptUnitsByIdsUndoable, moveScriptUnitsToPlotBoxUndoable, moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable, insertScriptUnitAfterUndoable, insertScriptUnitBeforeUndoable, addScriptUnitUndoable, updatePlotBoxUndoable } = useUndoableProjectActions()
  const setLastMovedScriptUnitIdsByPlot = useUIStore(state => state.setLastMovedScriptUnitIdsByPlot)
  const lastMovedScriptUnitIdsByPlot = useUIStore(state => state.lastMovedScriptUnitIdsByPlot)
  const clearLastMovedScriptUnitIdsForPlot = useUIStore(state => state.clearLastMovedScriptUnitIdsForPlot)

  // --- Shared local state (selectedScriptUnitIds는 uiStore로 통합, Workspace DnD에서 사용) ---
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null)
  const selectedScriptUnitIds = useUIStore(state => state.selectedScriptUnitIds)
  const setSelectedScriptUnitIds = useUIStore(state => state.setSelectedScriptUnitIds)
  const [focusUnitId, setFocusUnitId] = useState<string | null>(null)
  const [editingPlotTitle, setEditingPlotTitle] = useState<boolean>(false)

  // --- Derived data (memoized to avoid unnecessary re-renders when switching plot / editing) ---
  const episode = useMemo(
    () => file?.episodes.find(e => e.id === episodeId),
    [file, episodeId]
  )
  const plotBoxesSorted = useMemo(
    () => (episode ? [...episode.plotBoxes].sort((a, b) => a.order - b.order) : []),
    [episode]
  )
  const displayPlotIds = useMemo(() => {
    if (confirmedPlotBoxIds.length === 0) return []
    return [...confirmedPlotBoxIds]
      .filter(id => plotBoxesSorted.some(p => p.id === id))
      .sort((a, b) => {
        const ia = plotBoxesSorted.findIndex(p => p.id === a)
        const ib = plotBoxesSorted.findIndex(p => p.id === b)
        return ia - ib
      })
  }, [confirmedPlotBoxIds, plotBoxesSorted])
  const displayPlots = useMemo(
    () =>
      displayPlotIds
        .map(id => plotBoxesSorted.find(p => p.id === id))
        .filter((p): p is NonNullable<typeof p> => p != null),
    [displayPlotIds, plotBoxesSorted]
  )
  const combinedScriptUnits = useMemo(() => {
    const out: { unit: import('@/types/sw').ScriptUnit; plotBoxId: string; plotIndex: number }[] = []
    displayPlots.forEach((plot, plotIndex) => {
      const units = [...(plot.scriptUnits || [])].sort((a, b) => a.order - b.order)
      units.forEach(unit => out.push({ unit, plotBoxId: plot.id, plotIndex: plotIndex + 1 }))
    })
    return out
  }, [displayPlots])
  const scriptUnits = useMemo(
    () => combinedScriptUnits.map(({ unit }) => unit),
    [combinedScriptUnits]
  )
  const getPlotBoxIdForUnit = useCallback(
    (unitId: string) => combinedScriptUnits.find(({ unit }) => unit.id === unitId)?.plotBoxId,
    [combinedScriptUnits]
  )
  const plotBox = useMemo(
    () => episode?.plotBoxes.find(p => p.id === activePlotBoxId),
    [episode, activePlotBoxId]
  )
  const plotBoxIndex = useMemo(
    () => (episode?.plotBoxes.findIndex(p => p.id === activePlotBoxId) ?? -1),
    [episode, activePlotBoxId]
  )
  const characters = useMemo(
    () => file?.project.characters || [],
    [file]
  )

  const extraNamesFromEpisode = useMemo(() => {
    const names = new Set<string>()
    episode?.plotBoxes.forEach(p => {
      p.scriptUnits.forEach(u => {
        if (u.type === 'dialogue' && u.dialogueLabel) names.add(u.dialogueLabel)
      })
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [episode])

  // --- Sub-hooks ---
  const { containerRef, textareaRefs, autoResize } = useScriptFocus({ focusUnitId, setFocusUnitId, scriptUnits })
  const onScriptMovedToPlot = useCallback((plotBoxId: string, unitIds: string[]) => {
    setLastMovedScriptUnitIdsByPlot(plotBoxId, unitIds)
  }, [setLastMovedScriptUnitIdsByPlot])

  const { sensors, handleDragEnd, handleDragOver } = useScriptDnd({
    episodeId,
    activePlotBoxId,
    scriptUnits,
    reorderScriptUnitsUndoable,
    reorderScriptUnitGroupUndoable,
    moveScriptUnitsByIdsUndoable,
    moveScriptUnitsToPlotBoxUndoable: displayPlots.length > 1 ? moveScriptUnitsToPlotBoxUndoable : undefined,
    moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable: displayPlots.length > 1 ? moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable : undefined,
    getPlotBoxIdForUnit: displayPlots.length > 1 ? getPlotBoxIdForUnit : undefined,
    selectedScriptUnitIds,
    onScriptMovedToPlot,
    onDropOverChange,
  })

  useEffect(() => {
    setSelectedScriptUnitIds([])
  }, [episodeId, setSelectedScriptUnitIds])

  useEffect(() => {
    if (!activePlotBoxId) return
    const movedIds = lastMovedScriptUnitIdsByPlot[activePlotBoxId]
    if (movedIds?.length) {
      queueMicrotask(() => {
        setSelectedScriptUnitIds([])
        const first = movedIds[0]
        if (first) setActiveUnitId(first)
      })
      clearLastMovedScriptUnitIdsForPlot(activePlotBoxId)
    }
  }, [activePlotBoxId, lastMovedScriptUnitIdsByPlot, clearLastMovedScriptUnitIdsForPlot])
  const unitPlotId = getPlotBoxIdForUnit(activeUnitId ?? '')
  const currentPlotBoxIdForEdit =
    displayPlots.length > 0 &&
    (!activeUnitId || !unitPlotId || !displayPlotIds.includes(unitPlotId))
      ? displayPlots[0].id
      : (unitPlotId ?? activePlotBoxId)
  const currentUnitType = activeUnitId ? scriptUnits.find(u => u.id === activeUnitId)?.type ?? null : null
  const currentCharacterId = useEditorStore(state => state.currentCharacterId)
  const atPalette = useAtPalette({
    characters,
    directionItems,
    directionModeEnabled,
    propertyLabels,
    extraNamesFromEpisode,
    currentUnitType,
    currentCharacterId,
  })

  const {
    handleTextareaKeyDown,
    handleInsertUnit,
    handleInsertFirstUnitIntoPlot,
    removeScriptUnitUndoable,
    updateScriptUnit,
    setCurrentCharacter,
  } = useScriptKeyboard({
    episodeId,
    activePlotBoxId: currentPlotBoxIdForEdit,
    scriptUnits,
    characters,
    textareaRefs,
    activeUnitId,
    setActiveUnitId,
    setFocusUnitId,
    selectedScriptUnitIds,
    setSelectedScriptUnitIds,
    getPlotBoxIdForUnit,
    atPaletteOpen: !!atPalette.atInsertPos,
    onAtPaletteKey: atPalette.handlePaletteKey,
    onAtKeyDown: (unitId, pos, textarea) => {
      if (!atPalette.atInsertPos) {
        const atEnd = pos >= (textarea.value?.length ?? 0)
        if (atEnd && currentPlotBoxIdForEdit && activeUnitId) {
          const newId = insertScriptUnitAfterUndoable(episodeId, currentPlotBoxIdForEdit, activeUnitId, 'action')
          if (newId) {
            setFocusUnitId(newId)
            requestAnimationFrame(() => {
              const ta = textareaRefs.current.get(newId)
              if (ta) {
                ta.focus()
                ta.setSelectionRange(0, 0)
                atPalette.openAtPalette(newId, 0, ta)
              }
            })
          }
        } else {
          atPalette.openAtPalette(unitId, pos, textarea)
        }
      }
    },
  })

  const handleAtSelect = useCallback(
    (item: import('./script/useAtPalette').AtPaletteItem) => {
      if (!currentPlotBoxIdForEdit || !activeUnitId) return
      const unit = scriptUnits.find(u => u.id === activeUnitId)
      if (!unit) return
      if (item.type === 'character' && typeof item.value === 'string') {
        const char = characters.find(c => c.id === item.value)
        if (char) {
          setCurrentCharacter(char.id)
          updateScriptUnit(episodeId, currentPlotBoxIdForEdit, activeUnitId, {
            type: 'dialogue',
            characterId: char.id,
          })
          setFocusUnitId(activeUnitId)
          requestAnimationFrame(() => {
            const ta = textareaRefs.current.get(activeUnitId)
            if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
          })
        } else if (extraNamesFromEpisode.includes(item.value)) {
          const extra = characters.find(c => c.name === '엑스트라')
          if (extra) {
            setCurrentCharacter(extra.id)
            updateScriptUnit(episodeId, currentPlotBoxIdForEdit, activeUnitId, {
              type: 'dialogue',
              characterId: extra.id,
              dialogueLabel: item.value,
            })
            setFocusUnitId(activeUnitId)
            requestAnimationFrame(() => {
              const ta = textareaRefs.current.get(activeUnitId)
              if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
            })
          }
        }
      } else if (item.type === 'property' && typeof item.value === 'string') {
        const targetType = item.value === 'character' ? 'dialogue' : (item.value as import('@/types').ScriptPropertyType)
        updateScriptUnit(episodeId, currentPlotBoxIdForEdit, activeUnitId, {
          type: targetType,
          characterId: targetType === 'dialogue' ? unit.characterId : undefined,
        })
        setFocusUnitId(activeUnitId)
        requestAnimationFrame(() => {
          const ta = textareaRefs.current.get(activeUnitId)
          if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
        })
      } else if (item.type === 'direction' && typeof item.value === 'string') {
        const titleId = insertScriptUnitAfterUndoable(episodeId, currentPlotBoxIdForEdit, activeUnitId, 'direction')
        if (titleId) {
          updateScriptUnit(episodeId, currentPlotBoxIdForEdit, titleId, { content: item.label + ' >' })
          const descId = insertScriptUnitAfterUndoable(episodeId, currentPlotBoxIdForEdit, titleId, 'direction')
          setFocusUnitId(descId || titleId)
          setTimeout(() => {
            const ta = textareaRefs.current.get(descId || titleId)
            if (ta) { ta.focus(); ta.setSelectionRange(0, 0) }
          }, 50)
        }
      }
      atPalette.closeAtPalette()
    },
    [
      currentPlotBoxIdForEdit,
      activeUnitId,
      scriptUnits,
      characters,
      extraNamesFromEpisode,
      setCurrentCharacter,
      updateScriptUnit,
      insertScriptUnitAfterUndoable,
      episodeId,
      setFocusUnitId,
      atPalette,
      textareaRefs,
    ]
  )

  const handleAtCancelWithKey = useCallback(
    (key: string) => {
      const pos = atPalette.atInsertPos
      if (!pos) return
      const { unitId, pos: insertPos } = pos
      const plotBoxId = getPlotBoxIdForUnit(unitId)
      if (!plotBoxId) return
      const unit = scriptUnits.find(u => u.id === unitId)
      const content = unit?.content ?? ''
      let newContent = content
      let newPos = insertPos
      if (key === 'ArrowLeft') {
        newPos = Math.max(0, insertPos - 1)
      } else if (key === 'ArrowRight') {
        newPos = Math.min(content.length, insertPos + 1)
      } else {
        newContent = content.slice(0, insertPos) + key + content.slice(insertPos)
        newPos = insertPos + key.length
        updateScriptUnit(episodeId, plotBoxId, unitId, { content: newContent })
      }
      setFocusUnitId(unitId)
      atPalette.closeAtPalette()
      requestAnimationFrame(() => {
        const ta = textareaRefs.current.get(unitId)
        if (ta) {
          ta.focus()
          ta.setSelectionRange(newPos, newPos)
        }
      })
    },
    [
      atPalette.atInsertPos,
      getPlotBoxIdForUnit,
      scriptUnits,
      updateScriptUnit,
      episodeId,
      setFocusUnitId,
      atPalette,
      textareaRefs,
    ]
  )

  const setPropertyType = useEditorStore(state => state.setPropertyType)
  const currentCharacterIdForInsert = useEditorStore(state => state.currentCharacterId)
  const startTypingType = useSettingsStore(state => state.startTypingType)

  const handleInsertBeforeUnit = useCallback(
    (plotBoxId: string, beforeUnitId: string) => {
      const type = startTypingType || 'action'
      const characterId = type === 'dialogue' ? (currentCharacterIdForInsert ?? undefined) : undefined
      const newId = insertScriptUnitBeforeUndoable(episodeId, plotBoxId, beforeUnitId, type, characterId)
      if (newId && type !== 'background') {
        setFocusUnitId(newId)
        setPropertyType(type)
      }
      return newId
    },
    [episodeId, insertScriptUnitBeforeUndoable, startTypingType, currentCharacterIdForInsert, setFocusUnitId, setPropertyType]
  )

  const handleInsertAfterUnit = useCallback(
    (plotBoxId: string, afterUnitId: string) => {
      const type = startTypingType || 'action'
      const characterId = type === 'dialogue' ? (currentCharacterIdForInsert ?? undefined) : undefined
      const newId = insertScriptUnitAfterUndoable(episodeId, plotBoxId, afterUnitId, type, characterId)
      if (newId && type !== 'background') {
        setFocusUnitId(newId)
        setPropertyType(type)
      }
      return newId
    },
    [episodeId, insertScriptUnitAfterUndoable, startTypingType, currentCharacterIdForInsert, setFocusUnitId, setPropertyType]
  )

  /** 스크립트 포커스 없을 때 빈칸 우클릭 메뉴로 제일 하단에 스크립트 추가 */
  const handleAddScriptAtBottom = useCallback(() => {
    if (displayPlots.length === 0) return
    const lastPlot = displayPlots[displayPlots.length - 1]
    const type = startTypingType || 'action'
    const units = [...(lastPlot.scriptUnits || [])].sort((a, b) => a.order - b.order)
    let newId: string | undefined
    if (units.length > 0) {
      const lastUnit = units[units.length - 1]
      newId = insertScriptUnitAfterUndoable(episodeId, lastPlot.id, lastUnit!.id, type, type === 'dialogue' ? (currentCharacterIdForInsert ?? undefined) : undefined)
    } else {
      newId = addScriptUnitUndoable(episodeId, lastPlot.id, type, type === 'dialogue' ? (currentCharacterIdForInsert ?? undefined) : undefined)
    }
    if (newId && type !== 'background') {
      setFocusUnitId(newId)
      setPropertyType(type)
      requestAnimationFrame(() => {
        const ta = textareaRefs.current.get(newId!)
        if (ta) { ta.focus(); ta.setSelectionRange(0, 0) }
      })
    }
  }, [displayPlots, episodeId, insertScriptUnitAfterUndoable, addScriptUnitUndoable, startTypingType, currentCharacterIdForInsert, setFocusUnitId, setPropertyType, textareaRefs])
  const {
    palettePosition,
    setPalettePosition,
    commandPaletteOpen,
    openCommandPalette,
    handleCommandSelect,
    handleCommandCancel,
  } = useScriptSlashPalette({
    episodeId,
    activePlotBoxId: currentPlotBoxIdForEdit,
    scriptUnits,
    activeUnitId,
    textareaRefs,
    containerRef,
    handleInsertUnit,
    insertScriptUnitAfterUndoable,
    setFocusUnitId,
    setCurrentCharacter,
    setPropertyType,
  })

  // --- Style helpers (stable refs for child components) ---
  const getCharacterName = useCallback(
    (id?: string, dialogueLabel?: string): string => {
      const extraChar = characters.find(c => c.name === '엑스트라')
      if (id && extraChar && id === extraChar.id) return (dialogueLabel && dialogueLabel.trim()) ? dialogueLabel : extraChar.name
      const found = characters.find(c => c.id === id)
      if (found) return found.name
      if (dialogueLabel && dialogueLabel.trim()) return dialogueLabel.trim()
      return extraChar?.name ?? UNKNOWN_CHARACTER_NAME
    },
    [characters]
  )
  const getCharacterColor = useCallback(
    (id?: string) => {
      const extraChar = characters.find(c => c.name === '엑스트라')
      const extraColor = extraChar?.color ?? '#6b7280'
      return characters.find(c => c.id === id)?.color ?? extraColor
    },
    [characters]
  )
  const getPropertyStyle = useCallback(
    (type: ScriptPropertyType) => getSharedPropertyStyle(propertyStyles, type, defaultFontFamily || undefined),
    [propertyStyles, defaultFontFamily]
  )

  return {
    atPalette,
    handleAtSelect,
    handleAtCancelWithKey,
    activePlotBoxId,
    plotBox,
    plotBoxIndex,
    plotBoxesSorted,
    scriptUnits,
    combinedScriptUnits,
    displayPlots,
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
    updatePlotBox: updatePlotBoxUndoable,
    updateScriptUnit,
    setCurrentCharacter,
    removeScriptUnitUndoable,
    insertScriptUnitAfterUndoable, // from useUndoableProjectActions
    insertScriptUnitBeforeUndoable,
    handleInsertBeforeUnit,
    handleInsertAfterUnit,
    handleAddScriptAtBottom,
  }
}
