import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUIStore } from '@/store/ui/uiStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import type { ScriptPropertyType, Character } from '@/types'
import { cn } from '@/lib/utils'

interface Command {
  id: string
  label: string
  shortcut?: string
  type: 'property' | 'camera' | 'character'
  value: ScriptPropertyType | string
}

interface CommandPaletteProps {
  onSelect: (command: Command) => void
  onCancel?: () => void
  position?: { x: number; y: number }
  above?: boolean
  characters?: Character[]
}

export function CommandPalette({ onSelect, onCancel, position, above, characters = [] }: CommandPaletteProps) {
  const close = useUIStore(state => state.closeCommandPalette)
  const propertyLabels = useSettingsStore(state => state.propertyLabels)
  const slashShortcuts = useSettingsStore(state => state.slashShortcuts)
  const slashNumberAssignments = useSettingsStore(state => state.slashNumberAssignments)
  const directionItems = useSettingsStore(state => state.directionItems)
  const directionModeEnabled = useSettingsStore(state => state.directionModeEnabled)
  
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  const COMMANDS: Command[] = useMemo(() => {
    const assignments = slashNumberAssignments || {}
    const base: Command[] = [
      { id: 'action', label: propertyLabels.action, shortcut: slashShortcuts.action, type: 'property', value: 'action' },
      { id: 'narration', label: propertyLabels.narration, shortcut: slashShortcuts.narration, type: 'property', value: 'narration' },
      { id: 'background', label: propertyLabels.background, shortcut: slashShortcuts.background, type: 'property', value: 'background' },
      ...(directionModeEnabled
        ? directionItems
            .filter(item => item.enabled)
            .map(item => ({ id: item.id, label: item.label, type: 'camera' as const, value: item.id }))
        : []),
      ...characters.map(c => ({
        id: `char-${c.id}`,
        label: c.name,
        type: 'character' as const,
        value: c.id,
        shortcut: c.shortcut >= 1 && c.shortcut <= 9 && (assignments[String(c.shortcut)] === c.id || !assignments[String(c.shortcut)])
          ? String(c.shortcut)
          : undefined,
      })),
    ]
    return base.map(cmd => {
      const assignedDigit = Object.entries(assignments).find(([, val]) => val === cmd.value)?.[0]
      const shortcut = assignedDigit ?? cmd.shortcut
      return { ...cmd, shortcut }
    })
  }, [propertyLabels, slashShortcuts, slashNumberAssignments, directionModeEnabled, directionItems, characters])

  const filteredCommands = COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.id.toLowerCase().includes(query.toLowerCase())
  )

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const digit = e.key >= '0' && e.key <= '9' ? e.key : null
    if (digit !== null) {
      const byShortcut = filteredCommands.find(c => c.shortcut === digit)
      if (byShortcut) {
        e.preventDefault()
        onSelect(byShortcut)
        close()
        return
      }
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % filteredCommands.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length)
        break
      case 'ArrowLeft':
      case 'ArrowRight':
      case ' ':
        e.preventDefault()
        if (onCancel) onCancel()
        close()
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex])
          close()
        }
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
    }
  }, [filteredCommands, selectedIndex, onSelect, onCancel, close])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    queueMicrotask(() => {
      setQuery('')
      setSelectedIndex(0)
    })
  }, [])

  useEffect(() => {
    queueMicrotask(() => setSelectedIndex(0))
  }, [query])

  const propertyCommands = filteredCommands.filter(c => c.type === 'property')
  const cameraCommands = filteredCommands.filter(c => c.type === 'camera')
  const characterCommands = filteredCommands.filter(c => c.type === 'character')

  const style: React.CSSProperties = position
    ? {
        position: 'absolute',
        left: position.x,
        ...(above
          ? { bottom: `calc(100% - ${position.y}px)` }
          : { top: position.y })
      }
    : {
        position: 'fixed',
        left: '50%',
        top: '40%',
        transform: 'translate(-50%, -50%)'
      }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={close} />
      <div
        className="z-50 w-48 bg-white border border-border rounded shadow-lg overflow-hidden text-xs"
        style={style}
      >
        <div className="p-1.5 border-b border-border">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색..."
            className="w-full px-1.5 py-1 bg-muted/50 rounded outline-none focus:bg-muted text-xs"
            autoFocus
          />
        </div>

        <div className="max-h-48 overflow-auto">
          {propertyCommands.length > 0 && (
            <div className="p-0.5">
              <div className="px-1.5 py-0.5 text-[9px] text-muted-foreground font-medium uppercase tracking-wide">
                유형
              </div>
              {propertyCommands.map((cmd) => {
                const globalIdx = filteredCommands.indexOf(cmd)
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      onSelect(cmd)
                      close()
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-1.5 py-1 rounded transition-colors',
                      globalIdx === selectedIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    )}
                  >
                    <span>{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className={cn(
                        'text-[9px] px-1 py-0.5 rounded',
                        globalIdx === selectedIndex ? 'bg-primary-foreground/20' : 'bg-muted'
                      )}>
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {cameraCommands.length > 0 && (
            <div className="p-0.5 border-t border-border">
              {cameraCommands.map((cmd) => {
                const globalIdx = filteredCommands.indexOf(cmd)
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      onSelect(cmd)
                      close()
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-1.5 py-1 rounded transition-colors',
                      globalIdx === selectedIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    )}
                  >
                    <span>{cmd.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {characterCommands.length > 0 && (
            <div className="p-0.5 border-t border-border">
              <div className="px-1.5 py-0.5 text-[9px] text-muted-foreground font-medium uppercase tracking-wide">
                캐릭터
              </div>
              {characterCommands.map((cmd) => {
                const globalIdx = filteredCommands.indexOf(cmd)
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      onSelect(cmd)
                      close()
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-1.5 py-1 rounded transition-colors',
                      globalIdx === selectedIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    )}
                  >
                    <span>{cmd.label}</span>
                    {cmd.shortcut !== undefined && (
                      <kbd className={cn(
                        'text-[9px] px-1 py-0.5 rounded',
                        globalIdx === selectedIndex ? 'bg-primary-foreground/20' : 'bg-muted'
                      )}>
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {filteredCommands.length === 0 && (
            <div className="p-2 text-center text-muted-foreground">
              결과 없음
            </div>
          )}
        </div>
      </div>
    </>
  )
}
