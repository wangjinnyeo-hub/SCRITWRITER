import { useCallback, useEffect, useState, useMemo } from 'react'
import { useUIStore } from '@/store/ui/uiStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import type { ScriptPropertyType, Character } from '@/types'

export type AtPaletteItemType = 'property' | 'direction' | 'character'

export interface AtPaletteItem {
  id: string
  label: string
  type: AtPaletteItemType
  value: ScriptPropertyType | string
}

interface UseAtPaletteOptions {
  characters: Character[]
  directionItems: { id: string; label: string; enabled: boolean }[]
  directionModeEnabled: boolean
  propertyLabels: Record<ScriptPropertyType, string>
  extraNamesFromEpisode?: string[]
  /** 현재 포커스 유닛 유형 - @ 직후 스페이스 시 최상단(현재 유형) 선택용 */
  currentUnitType?: ScriptPropertyType | null
  /** dialogue일 때 현재 캐릭터 - 최상단에 현재 캐릭터 배치 */
  currentCharacterId?: string | null
}

export function useAtPalette({
  characters,
  directionItems,
  directionModeEnabled,
  propertyLabels,
  extraNamesFromEpisode = [],
  currentUnitType,
  currentCharacterId,
}: UseAtPaletteOptions) {
  const [atInsertPos, setAtInsertPos] = useState<{ unitId: string; pos: number; rect: DOMRect } | null>(null)
  const [query, setQuery] = useState('')

  const baseItems: AtPaletteItem[] = useMemo(() => {
    const items: AtPaletteItem[] = [
      { id: 'action', label: propertyLabels.action, type: 'property', value: 'action' },
      { id: 'narration', label: propertyLabels.narration, type: 'property', value: 'narration' },
      { id: 'background', label: propertyLabels.background, type: 'property', value: 'background' },
      { id: 'character', label: propertyLabels.character, type: 'property', value: 'character' },
      { id: 'direction', label: propertyLabels.direction, type: 'property', value: 'direction' },
      ...(directionModeEnabled
        ? directionItems.filter(d => d.enabled).map(d => ({ id: d.id, label: d.label, type: 'direction' as const, value: d.id }))
        : []),
      ...characters.map(c => ({ id: `char-${c.id}`, label: c.name, type: 'character' as const, value: c.id })),
      ...extraNamesFromEpisode.map(name => ({ id: `extra-${name}`, label: name, type: 'character' as const, value: name })),
    ]
    return items.sort((a, b) => a.label.localeCompare(b.label, 'ko'))
  }, [propertyLabels, directionModeEnabled, directionItems, characters, extraNamesFromEpisode])

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      const items = [...baseItems]
      if (currentUnitType) {
        let idx = -1
        if (currentUnitType === 'dialogue' && currentCharacterId) {
          idx = items.findIndex(i => i.type === 'character' && i.value === currentCharacterId)
        }
        if (idx < 0) {
          idx = items.findIndex(
            i => (i.type === 'property' && (i.value === currentUnitType || (i.value === 'character' && currentUnitType === 'dialogue'))) ||
              (i.type === 'direction' && currentUnitType === 'direction')
          )
        }
        if (idx > 0) {
          const [first] = items.splice(idx, 1)
          items.unshift(first)
        }
      }
      return items
    }
    const q = query.toLowerCase().trim()
    return baseItems.filter(
      item => item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
    )
  }, [baseItems, query, currentUnitType, currentCharacterId])

  const openAtPalette = useCallback((unitId: string, pos: number, textarea: HTMLTextAreaElement) => {
    const rect = textarea.getBoundingClientRect()
    setAtInsertPos({ unitId, pos, rect })
    setQuery('')
  }, [])

  const closeAtPalette = useCallback(() => {
    setAtInsertPos(null)
    setQuery('')
  }, [])

  const appendQuery = useCallback((char: string) => {
    setQuery(prev => prev + char)
  }, [])

  const setQueryFull = useCallback((q: string) => {
    setQuery(q)
  }, [])

  /** 팔레트 열림 상태에서 텍스트area로 들어오는 키를 쿼리에 반영 (타이핑에 따라 선택지 좁히기) */
  const handlePaletteKey = useCallback((key: string) => {
    if (key === 'Backspace') {
      setQuery(prev => prev.slice(0, -1))
    } else if (key.length === 1) {
      setQuery(prev => prev + key)
    }
  }, [])

  return {
    atInsertPos,
    query,
    setQuery: setQueryFull,
    filteredItems,
    openAtPalette,
    closeAtPalette,
    appendQuery,
    handlePaletteKey,
    hasMatch: filteredItems.length > 0,
  }
}
