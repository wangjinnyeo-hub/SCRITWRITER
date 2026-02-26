import { useCallback, useEffect, useState } from 'react'
import { useUIStore } from '@/store/ui/uiStore'
import { useProjectStore } from '@/store/project/projectStore'
import type { ScriptPropertyType, ScriptUnit } from '@/types'

interface UseScriptSlashPaletteOptions {
  episodeId: string
  activePlotBoxId: string | null
  scriptUnits: ScriptUnit[]
  activeUnitId: string | null
  textareaRefs: React.MutableRefObject<Map<string, HTMLTextAreaElement>>
  containerRef: React.RefObject<HTMLDivElement | null>
  handleInsertUnit: (type: ScriptPropertyType, afterId?: string, charId?: string) => string
  insertScriptUnitAfterUndoable: (episodeId: string, plotBoxId: string, afterId: string, type?: ScriptUnit['type'], characterId?: string) => string
  setFocusUnitId: (id: string | null) => void
  setCurrentCharacter: (id: string | null) => void
  setPropertyType: (type: ScriptPropertyType) => void
}

export function useScriptSlashPalette({
  episodeId,
  activePlotBoxId,
  scriptUnits,
  activeUnitId,
  textareaRefs,
  containerRef,
  handleInsertUnit,
  insertScriptUnitAfterUndoable,
  setFocusUnitId,
  setCurrentCharacter,
  setPropertyType,
}: UseScriptSlashPaletteOptions) {
  const openCommandPalette = useUIStore(state => state.openCommandPalette)
  const closeCommandPalette = useUIStore(state => state.closeCommandPalette)
  const commandPaletteOpen = useUIStore(state => state.commandPaletteOpen)
  const updateScriptUnit = useProjectStore(state => state.updateScriptUnit)

  const [palettePosition, setPalettePosition] = useState<{ x: number; y: number; above?: boolean }>()
  const [slashInsertPos, setSlashInsertPos] = useState<{ unitId: string; pos: number } | null>(null)

  const handleOpenPalette = useCallback((textarea: HTMLTextAreaElement) => {
    const rect = textarea.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - rect.bottom
    const above = spaceBelow < 220

    setPalettePosition({
      x: rect.left - (containerRect?.left || 0),
      y: above ? rect.top - (containerRect?.top || 0) - 4 : rect.bottom - (containerRect?.top || 0) + 4,
      above,
    })
    openCommandPalette()
  }, [openCommandPalette, containerRef])

  // Global / key listener
  const handleGlobalSlashKey = useCallback((e: KeyboardEvent) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !commandPaletteOpen) {
      const activeElement = document.activeElement as HTMLTextAreaElement
      if (activeElement?.tagName === 'TEXTAREA' && activeElement.dataset.unitId) {
        e.preventDefault()
        const unitId = activeElement.dataset.unitId
        if (unitId) {
          const pos = activeElement.selectionStart
          setSlashInsertPos({ unitId, pos })
          handleOpenPalette(activeElement)
        }
      }
    }
  }, [commandPaletteOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalSlashKey)
    return () => document.removeEventListener('keydown', handleGlobalSlashKey)
  }, [handleGlobalSlashKey])

  const handleCommandSelect = useCallback((command: { id: string; type: string; value: string; label?: string }) => {
    const insertPos = slashInsertPos
    closeCommandPalette()
    setSlashInsertPos(null)

    setTimeout(() => {
      const afterId = insertPos?.unitId
      const unit = insertPos ? scriptUnits.find(u => u.id === insertPos.unitId) : null
      const content = unit?.content ?? ''
      const pos = insertPos?.pos ?? 0
      const needSplit = unit && activePlotBoxId && pos > 0 && pos < content.length

      if (needSplit && (command.type === 'character' || command.type === 'property')) {
        const beforeContent = content.slice(0, pos)
        const afterContent = content.slice(pos)
        const targetType = command.type === 'character' ? 'dialogue' : (command.value as ScriptPropertyType)
        const targetCharId = command.type === 'character' ? command.value : undefined

        updateScriptUnit(episodeId, activePlotBoxId, unit.id, { content: beforeContent })
        const midId = insertScriptUnitAfterUndoable(episodeId, activePlotBoxId, unit.id, targetType, targetCharId)
        updateScriptUnit(episodeId, activePlotBoxId, midId, { content: '' })
        const restId = insertScriptUnitAfterUndoable(episodeId, activePlotBoxId, midId, unit.type, unit.characterId)
        updateScriptUnit(episodeId, activePlotBoxId, restId, { content: afterContent })

        setPropertyType(targetType)
        if (command.type === 'character') setCurrentCharacter(command.value)
        setFocusUnitId(midId)
        setTimeout(() => {
          const textarea = textareaRefs.current.get(midId)
          if (textarea) {
            textarea.focus()
            textarea.setSelectionRange(0, 0)
          }
        }, 50)
      } else if (command.type === 'character') {
        setCurrentCharacter(command.value)
        setPropertyType('dialogue')
        if (unit && content === '' && activePlotBoxId) {
          updateScriptUnit(episodeId, activePlotBoxId, unit.id, { type: 'dialogue', characterId: command.value })
          setFocusUnitId(unit.id)
          setTimeout(() => {
            const textarea = textareaRefs.current.get(unit.id)
            if (textarea) textarea.focus()
          }, 50)
        } else {
          const newId = handleInsertUnit('dialogue', afterId, command.value)
          setTimeout(() => {
            const textarea = textareaRefs.current.get(newId)
            if (textarea) {
              textarea.focus()
              textarea.setSelectionRange(0, 0)
            }
          }, 50)
        }
      } else if (command.type === 'property') {
        const isBackground = command.value === 'background'
        if (!isBackground) setPropertyType(command.value as ScriptPropertyType)
        if (unit && content === '' && activePlotBoxId) {
          updateScriptUnit(episodeId, activePlotBoxId, unit.id, {
            type: command.value as ScriptPropertyType,
            characterId: command.value === 'dialogue' ? unit.characterId : undefined,
          })
          if (!isBackground) {
            setFocusUnitId(unit.id)
            setTimeout(() => {
              const textarea = textareaRefs.current.get(unit.id)
              if (textarea) textarea.focus()
            }, 50)
          }
        } else {
          const newId = handleInsertUnit(command.value as ScriptPropertyType, afterId)
          if (!isBackground) {
            setTimeout(() => {
              const textarea = textareaRefs.current.get(newId)
              if (textarea) {
                textarea.focus()
                textarea.setSelectionRange(0, 0)
              }
            }, 50)
          }
        }
      } else if (command.type === 'camera') {
        const baseId = afterId || activeUnitId || (scriptUnits.length > 0 ? scriptUnits[scriptUnits.length - 1].id : '')
        if (!baseId || !activePlotBoxId) return

        const titleId = insertScriptUnitAfterUndoable(episodeId, activePlotBoxId, baseId, 'direction', undefined)
        updateScriptUnit(episodeId, activePlotBoxId, titleId, { content: command.label || '' })

        const descId = insertScriptUnitAfterUndoable(episodeId, activePlotBoxId, titleId, 'direction', undefined)
        setFocusUnitId(descId)

        setTimeout(() => {
          const textarea = textareaRefs.current.get(descId)
          if (textarea) {
            textarea.focus()
            textarea.setSelectionRange(0, 0)
          }
        }, 100)
      }
    }, 50)
  }, [slashInsertPos, handleInsertUnit, insertScriptUnitAfterUndoable, updateScriptUnit, closeCommandPalette, activeUnitId, episodeId, activePlotBoxId, scriptUnits, textareaRefs, setFocusUnitId, setCurrentCharacter, setPropertyType])

  const handleCommandCancel = useCallback(() => {
    if (slashInsertPos && activePlotBoxId) {
      const { unitId, pos } = slashInsertPos
      const unit = scriptUnits.find(u => u.id === unitId)
      if (unit) {
        const newContent = unit.content.slice(0, pos) + '/' + unit.content.slice(pos)
        updateScriptUnit(episodeId, activePlotBoxId, unitId, { content: newContent })
        setTimeout(() => {
          const textarea = textareaRefs.current.get(unitId)
          if (textarea) {
            textarea.focus()
            textarea.setSelectionRange(pos + 1, pos + 1)
          }
        }, 50)
      }
    }
    setSlashInsertPos(null)
    closeCommandPalette()
  }, [slashInsertPos, scriptUnits, updateScriptUnit, episodeId, activePlotBoxId, closeCommandPalette, textareaRefs])

  return {
    palettePosition,
    setPalettePosition,
    commandPaletteOpen,
    openCommandPalette,
    handleCommandSelect,
    handleCommandCancel,
  }
}
