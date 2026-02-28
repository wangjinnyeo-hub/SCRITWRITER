import { useCallback, useEffect, useState } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useEditorStore } from '@/store/editor/editorStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { useUIStore } from '@/store/ui/uiStore'
import { useUndoableProjectActions } from '@/hooks/useUndoableActions'
import type { ScriptPropertyType, ScriptUnit, Character } from '@/types'

interface UseScriptKeyboardOptions {
  episodeId: string
  activePlotBoxId: string | null
  scriptUnits: ScriptUnit[]
  characters: Character[]
  textareaRefs: React.MutableRefObject<Map<string, HTMLTextAreaElement>>
  activeUnitId: string | null
  setActiveUnitId: (id: string | null) => void
  setFocusUnitId: (id: string | null) => void
  selectedScriptUnitIds: string[]
  setSelectedScriptUnitIds: (ids: string[] | ((prev: string[]) => string[])) => void
  getPlotBoxIdForUnit?: (unitId: string) => string | undefined
  onAtKeyDown?: (unitId: string, pos: number, textarea: HTMLTextAreaElement) => void
  /** @ 팔레트가 열려 있을 때 true. 이때 텍스트area 키를 팔레트 쿼리로 넘김 */
  atPaletteOpen?: boolean
  onAtPaletteKey?: (key: string) => void
}

export function useScriptKeyboard({
  episodeId,
  activePlotBoxId,
  scriptUnits,
  characters,
  textareaRefs,
  activeUnitId,
  setActiveUnitId,
  setFocusUnitId,
  selectedScriptUnitIds,
  setSelectedScriptUnitIds,
  getPlotBoxIdForUnit,
  onAtKeyDown,
  atPaletteOpen = false,
  onAtPaletteKey,
}: UseScriptKeyboardOptions) {
  const currentCharacterId = useEditorStore(state => state.currentCharacterId)
  const setCurrentCharacter = useEditorStore(state => state.setCurrentCharacter)
  const setPropertyType = useEditorStore(state => state.setPropertyType)
  const scriptUnitClipboard = useEditorStore(state => state.scriptUnitClipboard)
  const setScriptUnitClipboard = useEditorStore(state => state.setScriptUnitClipboard)
  const commandPaletteOpen = useUIStore(state => state.commandPaletteOpen)
  const closeCommandPalette = useUIStore(state => state.closeCommandPalette)
  const slashShortcutsEnabled = useSettingsStore(state => state.slashShortcutsEnabled)
  const slashShortcuts = useSettingsStore(state => state.slashShortcuts)
  const doubleEnterDelay = useSettingsStore(state => state.doubleEnterDelay)
  const enterChain = useSettingsStore(state => state.enterChain)
  const shiftEnterNextTypeByCurrent = useSettingsStore(state => state.shiftEnterNextTypeByCurrent)
  const hashShortcuts = useSettingsStore(state => state.hashShortcuts)

  const setActivePlotBox = useUIStore(state => state.setActivePlotBox)
  const {
    addScriptUnitUndoable,
    insertScriptUnitAfterUndoable,
    insertScriptUnitBeforeUndoable,
    removeScriptUnitUndoable,
    mergeScriptUnitsUndoable,
    updateScriptUnitUndoable,
    splitPlotBoxUndoable,
  } = useUndoableProjectActions()

  /** 연속 Shift+Enter 카운트용 (Enter 줄바꿈은 카운트하지 않음) */
  const [lastShiftEnterTime, setLastShiftEnterTime] = useState<number>(0)
  const [lastAddedUnitId, setLastAddedUnitId] = useState<string | null>(null)
  const [consecutiveShiftEnterCount, setConsecutiveShiftEnterCount] = useState<number>(0)
  const [overwriteMode, setOverwriteMode] = useState<boolean>(false)

  // --- Insert helper (dialogueLabel: 엑스트라 연속 추가 시 유지) ---
  const handleInsertUnit = useCallback((type: ScriptPropertyType, afterId?: string, charId?: string, dialogueLabel?: string, initialContent?: string) => {
    if (!activePlotBoxId) return ''
    const characterId = type === 'dialogue' ? (charId || currentCharacterId) : undefined
    let newId: string
    if (afterId) {
      newId = insertScriptUnitAfterUndoable(episodeId, activePlotBoxId, afterId, type, characterId || undefined, undefined, initialContent)
    } else if (activeUnitId) {
      newId = insertScriptUnitAfterUndoable(episodeId, activePlotBoxId, activeUnitId, type, characterId || undefined, undefined, initialContent)
    } else {
      if (scriptUnits.length > 0) {
        const lastUnit = scriptUnits[scriptUnits.length - 1]
        newId = insertScriptUnitAfterUndoable(episodeId, activePlotBoxId, lastUnit.id, type, characterId || undefined, undefined, initialContent)
      } else {
        newId = addScriptUnitUndoable(episodeId, activePlotBoxId, type, characterId || undefined)
      }
    }
    if (dialogueLabel) updateScriptUnitUndoable(episodeId, activePlotBoxId, newId, { dialogueLabel })
    if (type !== 'background') {
      setFocusUnitId(newId)
      setPropertyType(type)
    }
    return newId
  }, [activePlotBoxId, activeUnitId, currentCharacterId, episodeId, insertScriptUnitAfterUndoable, addScriptUnitUndoable, updateScriptUnitUndoable, setPropertyType, scriptUnits, setFocusUnitId])

  /** 특정 플롯에 첫 유닛 추가 (추합집필 시 구분선 아래 빈 플롯용) */
  const handleInsertFirstUnitIntoPlot = useCallback((plotBoxId: string, type: ScriptPropertyType) => {
    const characterId = type === 'dialogue' ? currentCharacterId : undefined
    const newId = addScriptUnitUndoable(episodeId, plotBoxId, type, characterId || undefined)
    setFocusUnitId(newId)
    setPropertyType(type)
    return newId
  }, [currentCharacterId, episodeId, addScriptUnitUndoable, setFocusUnitId, setPropertyType])

  /** Shift+Enter로 새 유닛 생성. 연속 Shift+Enter 시에만 enterChain 타입 전환 적용 */
  const handleShiftEnterNewUnit = useCallback((currentType: ScriptPropertyType, currentCharId?: string) => {
    const now = Date.now()
    const isRapidShiftEnter = now - lastShiftEnterTime < doubleEnterDelay
    setLastShiftEnterTime(now)

    if (!isRapidShiftEnter) {
      setConsecutiveShiftEnterCount(1)
    } else {
      setConsecutiveShiftEnterCount(prev => prev + 1)
    }

    // 연속 Shift+Enter 시 enterChain 기반 타입 전환
    if (lastAddedUnitId && isRapidShiftEnter && consecutiveShiftEnterCount >= 1) {
      const chainIndex = consecutiveShiftEnterCount
      if (chainIndex < enterChain.length) {
        const nextRule = enterChain[chainIndex]
        if (nextRule !== 'same') {
          updateScriptUnitUndoable(episodeId, activePlotBoxId!, lastAddedUnitId, {
            type: nextRule,
            characterId: nextRule === 'dialogue' ? currentCharId : undefined,
          })
          setFocusUnitId(lastAddedUnitId)
          if (chainIndex >= enterChain.length - 1) {
            setConsecutiveShiftEnterCount(0)
          }
          return
        }
      }
    }

    const key = currentType as keyof typeof shiftEnterNextTypeByCurrent
    const insertType = (key in shiftEnterNextTypeByCurrent ? shiftEnterNextTypeByCurrent[key] : 'action') as ScriptPropertyType
    const charId = insertType === 'dialogue' ? currentCharId : undefined
    const prevUnit = activeUnitId ? scriptUnits.find(u => u.id === activeUnitId) : null
    const inheritLabel = insertType === 'dialogue' && prevUnit?.dialogueLabel && prevUnit.characterId === charId ? prevUnit.dialogueLabel : undefined
    const newId = handleInsertUnit(insertType, activeUnitId || undefined, charId, inheritLabel)
    setLastAddedUnitId(newId)
    setFocusUnitId(newId)
  }, [activeUnitId, scriptUnits, handleInsertUnit, lastShiftEnterTime, lastAddedUnitId, updateScriptUnitUndoable, episodeId, activePlotBoxId, doubleEnterDelay, consecutiveShiftEnterCount, enterChain, shiftEnterNextTypeByCurrent, setFocusUnitId])

  // --- Type change ---
  const handleChangeUnitType = useCallback((unitId: string, newType: ScriptPropertyType, charId?: string) => {
    if (!activePlotBoxId) return
    updateScriptUnitUndoable(episodeId, activePlotBoxId, unitId, {
      type: newType,
      characterId: newType === 'dialogue' ? charId : undefined
    })
  }, [activePlotBoxId, episodeId, updateScriptUnitUndoable])

  // --- Global Ctrl/Cmd+숫자 캐릭터 단축키 + / palette 단축키 ---
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        const num = e.key === '0' ? 0 : parseInt(e.key, 10)
        if (!Number.isNaN(num) && num >= 0 && num <= 9 && e.key.length === 1) {
          e.preventDefault()
          const char = characters.find(c => c.shortcut === num)
          if (char) {
            setCurrentCharacter(char.id)
            setPropertyType('dialogue')
            if (activeUnitId) {
              handleChangeUnitType(activeUnitId, 'dialogue', char.id)
            }
          }
        }
      }

      // 팔레트가 열려 있을 때는 CommandPalette가 숫자/단축키로 onSelect 호출 → handleCommandSelect에서 slashInsertPos로 삽입 위치 결정
      if (commandPaletteOpen && slashShortcutsEnabled && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const shortcutKey = e.key
        if (shortcutKey === slashShortcuts.action || shortcutKey === slashShortcuts.narration || shortcutKey === slashShortcuts.background) {
          e.preventDefault()
          // 삽입 위치는 useScriptSlashPalette handleCommandSelect에서만 알 수 있으므로, 여기서는 아무 처리 안 함(팔레트 onSelect가 처리)
        }
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [characters, setCurrentCharacter, setPropertyType, activeUnitId, handleChangeUnitType, commandPaletteOpen, handleInsertUnit, closeCommandPalette, slashShortcutsEnabled, slashShortcuts])

  // --- Textarea key handler (delegates to helpers by key/condition) ---
  const handleTextareaKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    unitId: string,
    unitType: ScriptPropertyType,
    unitIndex: number,
    charId?: string
  ) => {
    // @ 팔레트 열림 시 타이핑/백스페이스를 팔레트 쿼리로 넘겨 선택지 좁히기
    if (atPaletteOpen && onAtPaletteKey) {
      if (e.key === 'Backspace') {
        e.preventDefault()
        onAtPaletteKey('Backspace')
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.nativeEvent.isComposing) {
        e.preventDefault()
        onAtPaletteKey(e.key)
        return
      }
    }

    const textarea = e.currentTarget
    const { selectionStart, selectionEnd, value } = textarea

    const doCtrlA = () => {
      const fullTextSelected = selectionStart === 0 && selectionEnd === value.length
      const hasScriptSelection = selectedScriptUnitIds.length >= 1 && selectedScriptUnitIds.includes(unitId)
      if (fullTextSelected || hasScriptSelection) {
        e.preventDefault()
        setSelectedScriptUnitIds(scriptUnits.map(u => u.id))
        setActiveUnitId(unitId)
      } else {
        e.preventDefault()
        textarea.select()
      }
    }
    const doCtrlC = () => {
      e.preventDefault()
      const idsToCopy = selectedScriptUnitIds.length >= 1 && selectedScriptUnitIds.includes(unitId)
        ? selectedScriptUnitIds
        : [unitId]
      const items = idsToCopy.map(id => {
        const u = scriptUnits.find(x => x.id === id)
        if (!u) return null
        return {
          type: u.type,
          characterId: u.type === 'dialogue' ? u.characterId : undefined,
          dialogueLabel: u.type === 'dialogue' ? u.dialogueLabel : undefined,
          content: u.content,
        }
      }).filter((x): x is NonNullable<typeof x> => x != null)
      if (items.length > 0) setScriptUnitClipboard(items)
    }
    const doCtrlX = () => {
      e.preventDefault()
      const idsToCut = selectedScriptUnitIds.length >= 1 && selectedScriptUnitIds.includes(unitId)
        ? selectedScriptUnitIds
        : [unitId]
      const items = idsToCut.map(id => {
        const u = scriptUnits.find(x => x.id === id)
        if (!u) return null
        return {
          type: u.type,
          characterId: u.type === 'dialogue' ? u.characterId : undefined,
          dialogueLabel: u.type === 'dialogue' ? u.dialogueLabel : undefined,
          content: u.content,
        }
      }).filter((x): x is NonNullable<typeof x> => x != null)
      if (items.length === 0) return
      setScriptUnitClipboard(items)
      idsToCut.forEach(id => {
        const pId = getPlotBoxIdForUnit?.(id) ?? activePlotBoxId!
        if (pId) removeScriptUnitUndoable(episodeId, pId, id)
      })
      setSelectedScriptUnitIds([])
      const remain = scriptUnits.filter(u => !idsToCut.includes(u.id))
      const nextId = remain.length > 0 ? remain[Math.min(unitIndex, remain.length - 1)].id : null
      setFocusUnitId(nextId)
      setActiveUnitId(nextId)
      if (nextId) requestAnimationFrame(() => textareaRefs.current.get(nextId)?.focus())
    }
    const doCtrlV = () => {
      if (!scriptUnitClipboard?.length) return
      // 선택된 스크립트가 있으면 그중 마지막 유닛 아래에 붙여넣기, 없으면 현재 포커스 유닛 아래
      let afterId = unitId
      if (selectedScriptUnitIds.length >= 1) {
        const selectedInPlot = selectedScriptUnitIds.filter(id => scriptUnits.some(u => u.id === id))
        if (selectedInPlot.length > 0) {
          const lastIndex = Math.max(...selectedInPlot.map(id => scriptUnits.findIndex(u => u.id === id)))
          if (lastIndex >= 0) afterId = scriptUnits[lastIndex].id
        }
      }
      let firstNewId: string | null = null
      for (const item of scriptUnitClipboard) {
        const newId = insertScriptUnitAfterUndoable(episodeId, activePlotBoxId!, afterId, item.type, item.characterId, undefined, item.content)
        if (item.dialogueLabel !== undefined) {
          updateScriptUnitUndoable(episodeId, activePlotBoxId!, newId, { dialogueLabel: item.dialogueLabel })
        }
        if (!firstNewId) firstNewId = newId
        afterId = newId
      }
      if (firstNewId) {
        setFocusUnitId(firstNewId)
        requestAnimationFrame(() => { const ta = textareaRefs.current.get(firstNewId!); ta?.focus(); ta?.setSelectionRange(0, 0) })
      }
    }
    const doOverwrite = () => {
      let newValue: string
      if (selectionStart !== selectionEnd) {
        newValue = value.substring(0, selectionStart) + e.key + value.substring(selectionEnd)
      } else if (selectionStart < value.length) {
        newValue = value.substring(0, selectionStart) + e.key + value.substring(selectionStart + 1)
      } else {
        newValue = value + e.key
      }
      const newCursor = selectionStart + 1
      updateScriptUnitUndoable(episodeId, activePlotBoxId!, unitId, { content: newValue })
      requestAnimationFrame(() => {
        const ta = textareaRefs.current.get(unitId)
        if (ta) ta.setSelectionRange(newCursor, newCursor)
      })
    }
    const doHashSpace = (): boolean => {
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
      const beforeCursor = value.substring(lineStart, selectionStart)
      const beforeCursorTrimmed = beforeCursor.trimStart()
      const afterCursor = value.substring(selectionStart)
      const atUnitStart = lineStart === 0
      const atUnitEnd = afterCursor.trim() === ''
      // #숫자 = 할당된 숫자(shortcut)의 캐릭터 호출. 엑스트라=0, #1=shortcut 1, ...
      if (beforeCursorTrimmed.match(/^#\d+$/)) {
        const num = parseInt(beforeCursorTrimmed.substring(1), 10)
        const patternStartInLine = beforeCursor.indexOf(beforeCursorTrimmed)
        const newValue = (value.substring(0, lineStart + patternStartInLine) + value.substring(selectionStart)).trimEnd()
        const targetChar = num >= 0 && num <= 9 ? characters.find(c => c.shortcut === num) : undefined
        if (targetChar) {
          updateScriptUnitUndoable(episodeId, activePlotBoxId!, unitId, { content: newValue, type: 'dialogue', characterId: targetChar.id })
          setCurrentCharacter(targetChar.id)
          setFocusUnitId(unitId)
        }
        return true
      }
      // ##숫자 (설정에서 ##=대사일 때만) — shortcut 기준
      if (beforeCursorTrimmed.match(/^##\d+$/) && hashShortcuts['##'] === 'dialogue') {
        const num = parseInt(beforeCursorTrimmed.substring(2), 10)
        const patternStartInLine = beforeCursor.indexOf(beforeCursorTrimmed)
        const newValue = (value.substring(0, lineStart + patternStartInLine) + value.substring(selectionStart)).trimEnd()
        const targetChar = num >= 0 && num <= 9 ? characters.find(c => c.shortcut === num) : undefined
        if (targetChar) {
          updateScriptUnitUndoable(episodeId, activePlotBoxId!, unitId, { content: newValue, type: 'dialogue', characterId: targetChar.id })
          setCurrentCharacter(targetChar.id)
          setFocusUnitId(unitId)
        }
        return true
      }

      const hashPatterns = Object.keys(hashShortcuts).sort((a, b) => b.length - a.length)
      const currentCharId = unitType === 'dialogue' ? charId : undefined
      for (const pattern of hashPatterns) {
        const targetType = hashShortcuts[pattern]
        const hashCharId = targetType === 'dialogue' && characters.length > 0 ? characters[0].id : undefined
        if (targetType === 'dialogue' && characters.length > 0) setCurrentCharacter(hashCharId!)

        if (beforeCursorTrimmed === pattern) {
          const skipFocus = targetType === 'background'
          if (atUnitStart) {
            const restContent = value.substring(selectionStart).trimStart()
            updateScriptUnitUndoable(episodeId, activePlotBoxId!, unitId, { content: restContent, type: targetType, characterId: hashCharId ?? undefined })
            if (!skipFocus) {
              setFocusUnitId(unitId)
              requestAnimationFrame(() => {
                const ta = textareaRefs.current.get(unitId)
                if (ta) { ta.focus(); ta.setSelectionRange(0, 0) }
              })
            }
            return true
          }
          if (atUnitEnd) {
            const newValue = (value.substring(0, lineStart) + value.substring(selectionStart)).trimEnd()
            updateScriptUnitUndoable(episodeId, activePlotBoxId!, unitId, { content: newValue })
            const newId = insertScriptUnitAfterUndoable(episodeId, activePlotBoxId!, unitId, targetType, hashCharId)
            if (!skipFocus) {
              setFocusUnitId(newId)
              requestAnimationFrame(() => textareaRefs.current.get(newId)?.focus())
            }
            return true
          }
          const patternStartInLine = beforeCursor.lastIndexOf(pattern)
          const beforeContent = value.substring(0, lineStart + patternStartInLine).trimEnd()
          const afterContent = value.substring(selectionStart).trimStart()
          updateScriptUnitUndoable(episodeId, activePlotBoxId!, unitId, { content: beforeContent })
          const newId = insertScriptUnitAfterUndoable(episodeId, activePlotBoxId!, unitId, targetType, hashCharId, undefined, afterContent)
          if (!skipFocus) {
            setFocusUnitId(newId)
            requestAnimationFrame(() => textareaRefs.current.get(newId)?.focus())
          }
          return true
        }
        if (beforeCursorTrimmed.endsWith(pattern) && beforeCursorTrimmed.length > pattern.length) {
          const skipFocus = targetType === 'background'
          const patternStartInLine = beforeCursor.lastIndexOf(pattern)
          const beforeContent = value.substring(0, lineStart + patternStartInLine).trimEnd()
          const afterContent = value.substring(selectionStart).trimStart()
          updateScriptUnitUndoable(episodeId, activePlotBoxId!, unitId, { content: beforeContent })
          const newId = insertScriptUnitAfterUndoable(episodeId, activePlotBoxId!, unitId, targetType, hashCharId, undefined, afterContent)
          if (!skipFocus) {
            setFocusUnitId(newId)
            requestAnimationFrame(() => textareaRefs.current.get(newId)?.focus())
          }
          return true
        }
      }
      return false
    }
    const doShiftEnter = () => {
      setActiveUnitId(unitId)
      const key = unitType as keyof typeof shiftEnterNextTypeByCurrent
      const createType = (key in shiftEnterNextTypeByCurrent ? shiftEnterNextTypeByCurrent[key] : 'action') as ScriptPropertyType
      if (selectionStart === 0 && selectionEnd === 0) {
        const characterId = createType === 'dialogue' ? charId : undefined
        const newId = insertScriptUnitBeforeUndoable(episodeId, activePlotBoxId!, unitId, createType, characterId)
        setFocusUnitId(newId)
        setLastAddedUnitId(newId)
        setConsecutiveShiftEnterCount(0)
        return
      }
      if (selectionStart > 0 || selectionEnd < value.length) {
        const beforeContent = value.slice(0, selectionStart)
        const afterContent = value.slice(selectionEnd)
        const curUnit = scriptUnits.find(u => u.id === unitId)
        const splitCharId = unitType === 'dialogue' ? charId : undefined
        const inheritLabel = unitType === 'dialogue' && curUnit?.dialogueLabel && curUnit.characterId === splitCharId ? curUnit.dialogueLabel : undefined
        updateScriptUnitUndoable(episodeId, activePlotBoxId!, unitId, { content: beforeContent })
        const newId = handleInsertUnit(unitType, unitId, splitCharId, inheritLabel, afterContent)
        if (newId) {
          setFocusUnitId(newId)
          setLastAddedUnitId(newId)
          setConsecutiveShiftEnterCount(0)
          const focusNewId = newId
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const ta = textareaRefs.current.get(focusNewId)
              if (ta) {
                ta.focus()
                ta.setSelectionRange(0, 0)
              }
            })
          })
        }
        return
      }
      handleShiftEnterNewUnit(unitType, charId)
    }
    const doBackspace = () => {
      if (unitIndex <= 0) return
      const prevUnit = scriptUnits[unitIndex - 1]
      if (value === '') {
        removeScriptUnitUndoable(episodeId, activePlotBoxId!, unitId)
        setFocusUnitId(prevUnit.id)
      } else {
        const cursorPos = prevUnit.content.length + 1
        mergeScriptUnitsUndoable(episodeId, activePlotBoxId!, prevUnit.id, unitId)
        requestAnimationFrame(() => {
          const merged = textareaRefs.current.get(prevUnit.id)
          if (merged) {
            merged.focus()
            merged.setSelectionRange(cursorPos, cursorPos)
          }
        })
      }
    }
    const doArrowUp = () => {
      const prevUnit = scriptUnits[unitIndex - 1]
      const prevTextarea = textareaRefs.current.get(prevUnit.id)
      if (prevTextarea) {
        prevTextarea.focus()
        const len = prevTextarea.value.length
        prevTextarea.setSelectionRange(len, len)
      }
    }
    const doArrowDown = () => {
      const nextUnit = scriptUnits[unitIndex + 1]
      const nextTextarea = textareaRefs.current.get(nextUnit.id)
      if (nextTextarea) {
        nextTextarea.focus()
        nextTextarea.setSelectionRange(0, 0)
      }
    }

    if (e.key === '@' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.nativeEvent.isComposing && onAtKeyDown) {
      e.preventDefault()
      onAtKeyDown(unitId, selectionStart, textarea)
      return
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'a') { e.preventDefault(); doCtrlA(); return }
      if (e.key === 'c') {
        // 텍스트만 선택된 경우: 유닛 클립보드에 넣지 않고 브라우저 기본 복사(텍스트만) 허용 → Ctrl+V 시 텍스트 붙여넣기
        if (selectionStart !== selectionEnd) {
          setScriptUnitClipboard(null)
          return
        }
        doCtrlC()
        return
      }
      if (e.key === 'x') {
        // 텍스트만 선택된 경우: 유닛 잘라내지 않고 브라우저 기본 동작 허용
        if (selectionStart !== selectionEnd) {
          setScriptUnitClipboard(null)
          return
        }
        e.preventDefault(); doCtrlX(); return
      }
      if (e.key === 'v' && scriptUnitClipboard?.length) { e.preventDefault(); doCtrlV(); return }
    }
    if (e.key === 'Insert') { e.preventDefault(); setOverwriteMode(prev => !prev); return }
    if (overwriteMode && !e.ctrlKey && !e.metaKey && !e.altKey && !e.nativeEvent.isComposing && e.key.length === 1) {
      e.preventDefault(); doOverwrite(); return
    }
    if (e.key === ' ' && selectionStart === selectionEnd) {
      const hashResult = doHashSpace()
      if (hashResult) { e.preventDefault(); return }
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      const plotBoxId = getPlotBoxIdForUnit?.(unitId) ?? activePlotBoxId
      if (!plotBoxId || !activePlotBoxId) return
      const file = useProjectStore.getState().file
      const episode = file?.episodes.find(ep => ep.id === episodeId)
      const boxIndex = episode?.plotBoxes.findIndex(p => p.id === plotBoxId) ?? -1
      const plot = episode?.plotBoxes.find(p => p.id === plotBoxId)
      const sortedInPlot = plot ? [...plot.scriptUnits].sort((a, b) => a.order - b.order) : []
      const unitIndexInPlot = sortedInPlot.findIndex(u => u.id === unitId)
      if (boxIndex < 0 || unitIndexInPlot < 0) return
      const newPlotId = splitPlotBoxUndoable(episodeId, boxIndex, unitIndexInPlot)
      if (newPlotId) {
        setActivePlotBox(newPlotId)
        const fileAfter = useProjectStore.getState().file
        const epAfter = fileAfter?.episodes.find(ep => ep.id === episodeId)
        const newPlot = epAfter?.plotBoxes.find(p => p.id === newPlotId)
        const firstUnit = newPlot ? [...newPlot.scriptUnits].sort((a, b) => a.order - b.order)[0] : null
        if (firstUnit) {
          setFocusUnitId(firstUnit.id)
          setActiveUnitId(firstUnit.id)
          requestAnimationFrame(() => textareaRefs.current.get(firstUnit.id)?.focus())
        }
      }
      return
    }
    if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey) {
      e.preventDefault(); doShiftEnter(); return
    }
    if (e.key === 'Backspace' && selectionStart === 0 && selectionEnd === 0) {
      e.preventDefault(); doBackspace(); return
    }
    if (e.key === 'ArrowUp' && !e.shiftKey) {
      const isOnFirstLine = value.lastIndexOf('\n', selectionStart - 1) === -1
      if (isOnFirstLine && selectionStart === selectionEnd && unitIndex > 0) {
        e.preventDefault(); e.stopPropagation(); doArrowUp()
      }
    }
    if (e.key === 'ArrowDown' && !e.shiftKey) {
      const isOnLastLine = value.indexOf('\n', selectionEnd) === -1
      if (isOnLastLine && selectionStart === selectionEnd && unitIndex < scriptUnits.length - 1) {
        e.preventDefault(); e.stopPropagation(); doArrowDown()
      }
    }
  }, [scriptUnits, selectedScriptUnitIds, handleShiftEnterNewUnit, removeScriptUnitUndoable, mergeScriptUnitsUndoable, episodeId, activePlotBoxId, getPlotBoxIdForUnit, handleInsertUnit, insertScriptUnitBeforeUndoable, insertScriptUnitAfterUndoable, overwriteMode, updateScriptUnitUndoable, setFocusUnitId, setActiveUnitId, setSelectedScriptUnitIds, characters, setCurrentCharacter, textareaRefs, scriptUnitClipboard, setScriptUnitClipboard, hashShortcuts, shiftEnterNextTypeByCurrent, atPaletteOpen, onAtPaletteKey, splitPlotBoxUndoable, setActivePlotBox])

  return {
    handleTextareaKeyDown,
    handleInsertUnit,
    handleInsertFirstUnitIntoPlot,
    removeScriptUnitUndoable,
    insertScriptUnitAfterUndoable,
    updateScriptUnit: updateScriptUnitUndoable,
    setCurrentCharacter,
  }
}
