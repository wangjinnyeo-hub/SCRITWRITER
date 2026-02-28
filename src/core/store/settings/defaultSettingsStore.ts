/**
 * 새 프로젝트 생성 시 적용할 기본 설정. localStorage에 저장되며, 기본설정 메뉴에서 편집.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ScriptPropertyType, PropertyStyle } from '@/types'
import { useSettingsStore } from './settingsStore'

interface DirectionItem {
  id: string
  label: string
  enabled: boolean
}

const DEFAULT_LABELS: Record<ScriptPropertyType, string> = {
  character: '캐릭터',
  dialogue: '대사',
  narration: '나레이션',
  action: '지문',
  background: '배경',
  direction: '연출',
}

const DEFAULT_STYLES: Record<ScriptPropertyType, PropertyStyle> = {
  character: { fontWeight: 'bold', fontSize: 12, color: '#404040' },
  dialogue: { color: '#0a0a0a' },
  narration: { color: '#525252', textAlign: 'center' },
  action: { color: '#737373' },
  background: { color: '#262626', fontWeight: 'bold', textAlign: 'left' },
  direction: { color: '#737373', textAlign: 'center' },
}

const DEFAULT_DIRECTION_ITEMS: DirectionItem[] = [
  { id: 'insert', label: '인서트', enabled: true },
  { id: 'closeup', label: '클로즈업', enabled: true },
  { id: 'wideshot', label: '와이드 샷', enabled: true },
  { id: 'pan', label: '팬', enabled: true },
  { id: 'zoom', label: '줌', enabled: true },
  { id: 'tilt', label: '틸트', enabled: true },
  { id: 'dolly', label: '돌리', enabled: true },
]

export interface DefaultSettingsState {
  propertyLabels: Record<ScriptPropertyType, string>
  propertyStyles: Record<ScriptPropertyType, PropertyStyle>
  directionItems: DirectionItem[]
  directionModeEnabled: boolean
  colonAsDialogue: boolean
  startTypingType: ScriptPropertyType
  shiftEnterNextTypeByCurrent: Record<'background' | 'action' | 'narration' | 'dialogue', 'background' | 'action' | 'narration' | 'dialogue'>
  backgroundSeqEnabled: boolean
  backgroundSeqPrefix: string
  backgroundSeqSuffix: string
  backgroundSeqScope: 'episode' | 'plot'
  defaultFontFamily: string
  hashShortcuts: Record<string, ScriptPropertyType>
  slashShortcutsEnabled: boolean
  slashShortcuts: { action: string; narration: string; background: string }
  slashNumberAssignments: Record<string, string>

  setPropertyLabel: (type: ScriptPropertyType, label: string) => void
  setPropertyStyle: (type: ScriptPropertyType, style: Partial<PropertyStyle>) => void
  addDirectionItem: (label: string) => void
  updateDirectionItem: (id: string, label: string, enabled: boolean) => void
  removeDirectionItem: (id: string) => void
  setDirectionModeEnabled: (enabled: boolean) => void
  setColonAsDialogue: (enabled: boolean) => void
  setStartTypingType: (type: ScriptPropertyType) => void
  setShiftEnterNextType: (currentType: 'background' | 'action' | 'narration' | 'dialogue', nextType: 'background' | 'action' | 'narration' | 'dialogue') => void
  setBackgroundSeqEnabled: (enabled: boolean) => void
  setBackgroundSeqPrefix: (prefix: string) => void
  setBackgroundSeqSuffix: (suffix: string) => void
  setBackgroundSeqScope: (scope: 'episode' | 'plot') => void
  setDefaultFontFamily: (font: string) => void
  setHashShortcut: (pattern: string, type: ScriptPropertyType) => void
  setSlashShortcutsEnabled: (enabled: boolean) => void
  setSlashShortcut: (type: 'action' | 'narration' | 'background', key: string) => void
  setSlashNumberAssignment: (digit: string, value: string) => void
  resetToDefaults: () => void
}

type DefaultSettingsData = Pick<
  DefaultSettingsState,
  | 'propertyLabels'
  | 'propertyStyles'
  | 'directionItems'
  | 'directionModeEnabled'
  | 'colonAsDialogue'
  | 'startTypingType'
  | 'shiftEnterNextTypeByCurrent'
  | 'backgroundSeqEnabled'
  | 'backgroundSeqPrefix'
  | 'backgroundSeqSuffix'
  | 'backgroundSeqScope'
  | 'defaultFontFamily'
  | 'hashShortcuts'
  | 'slashShortcutsEnabled'
  | 'slashShortcuts'
  | 'slashNumberAssignments'
>

const getInitialState = (): DefaultSettingsData => ({
  propertyLabels: { ...DEFAULT_LABELS },
  propertyStyles: { ...DEFAULT_STYLES },
  directionItems: DEFAULT_DIRECTION_ITEMS.map((d) => ({ ...d })),
  directionModeEnabled: true,
  colonAsDialogue: true,
  startTypingType: 'background',
  shiftEnterNextTypeByCurrent: {
    background: 'action',
    action: 'narration',
    narration: 'dialogue',
    dialogue: 'background',
  },
  backgroundSeqEnabled: true,
  backgroundSeqPrefix: 'S#',
  backgroundSeqSuffix: '',
  backgroundSeqScope: 'episode',
  defaultFontFamily: '',
  hashShortcuts: { '#': 'dialogue', '##': 'action', '###': 'narration', '####': 'background' },
  slashShortcutsEnabled: true,
  slashShortcuts: { action: '1', narration: '2', background: '3' },
  slashNumberAssignments: { '1': 'action', '2': 'narration', '3': 'background' },
})

export const useDefaultSettingsStore = create<DefaultSettingsState>()(
  persist(
    (set) => ({
      ...getInitialState(),

      setPropertyLabel: (type, label) => set((s) => ({ propertyLabels: { ...s.propertyLabels, [type]: label } })),
      setPropertyStyle: (type, style) => set((s) => ({
        propertyStyles: { ...s.propertyStyles, [type]: { ...s.propertyStyles[type], ...style } },
      })),
      addDirectionItem: (label) => set((s) => ({
        directionItems: [...s.directionItems, { id: `custom-${Date.now()}`, label, enabled: true }],
      })),
      updateDirectionItem: (id, label, enabled) => set((s) => ({
        directionItems: s.directionItems.map((item) => (item.id === id ? { ...item, label, enabled } : item)),
      })),
      removeDirectionItem: (id) => set((s) => ({ directionItems: s.directionItems.filter((item) => item.id !== id) })),
      setDirectionModeEnabled: (enabled) => set({ directionModeEnabled: enabled }),
      setColonAsDialogue: (enabled) => set({ colonAsDialogue: enabled }),
      setStartTypingType: (type) => set({ startTypingType: type }),
      setShiftEnterNextType: (currentType, nextType) => set((s) => ({
        shiftEnterNextTypeByCurrent: { ...s.shiftEnterNextTypeByCurrent, [currentType]: nextType },
      })),
      setBackgroundSeqEnabled: (enabled) => set({ backgroundSeqEnabled: enabled }),
      setBackgroundSeqPrefix: (prefix) => set({ backgroundSeqPrefix: prefix }),
      setBackgroundSeqSuffix: (suffix) => set({ backgroundSeqSuffix: suffix }),
      setBackgroundSeqScope: (scope) => set({ backgroundSeqScope: scope }),
      setDefaultFontFamily: (font) => set({ defaultFontFamily: font }),
      setHashShortcut: (pattern, type) => set((s) => ({ hashShortcuts: { ...s.hashShortcuts, [pattern]: type } })),
      setSlashShortcutsEnabled: (enabled) => set({ slashShortcutsEnabled: enabled }),
      setSlashShortcut: (type, key) => set((s) => ({ slashShortcuts: { ...s.slashShortcuts, [type]: key } })),
      setSlashNumberAssignment: (digit, value) => set((s) => ({
        slashNumberAssignments: { ...s.slashNumberAssignments, [digit]: value },
      })),
      resetToDefaults: () => set(getInitialState()),
    }),
    { name: 'sw-default-settings' }
  )
)

/** 새 프로젝트 생성 시 기본설정을 메인 설정 스토어에 적용 */
export function applyDefaultSettingsToStore(): void {
  const def = useDefaultSettingsStore.getState()
  const main = useSettingsStore.getState()
  main.setPropertyLabel('character', def.propertyLabels.character)
  main.setPropertyLabel('dialogue', def.propertyLabels.dialogue)
  main.setPropertyLabel('narration', def.propertyLabels.narration)
  main.setPropertyLabel('action', def.propertyLabels.action)
  main.setPropertyLabel('background', def.propertyLabels.background)
  main.setPropertyLabel('direction', def.propertyLabels.direction)
  ;(['character', 'dialogue', 'action', 'narration', 'background', 'direction'] as const).forEach((t) => {
    main.setPropertyStyle(t, def.propertyStyles[t] ?? {})
  })
  main.setStartTypingType(def.startTypingType)
  main.setShiftEnterNextType('background', def.shiftEnterNextTypeByCurrent.background)
  main.setShiftEnterNextType('action', def.shiftEnterNextTypeByCurrent.action)
  main.setShiftEnterNextType('narration', def.shiftEnterNextTypeByCurrent.narration)
  main.setShiftEnterNextType('dialogue', def.shiftEnterNextTypeByCurrent.dialogue)
  main.setBackgroundSeqEnabled(def.backgroundSeqEnabled)
  main.setBackgroundSeqPrefix(def.backgroundSeqPrefix)
  main.setBackgroundSeqSuffix(def.backgroundSeqSuffix)
  main.setBackgroundSeqScope(def.backgroundSeqScope)
  main.setDefaultFontFamily(def.defaultFontFamily)
  main.setColonAsDialogue(def.colonAsDialogue)
  main.setDirectionModeEnabled(def.directionModeEnabled)
  ;(['#', '##', '###', '####'] as const).forEach((p) => main.setHashShortcut(p, def.hashShortcuts[p] ?? 'action'))
  main.setSlashShortcutsEnabled(def.slashShortcutsEnabled)
  main.setSlashShortcut('action', def.slashShortcuts.action)
  main.setSlashShortcut('narration', def.slashShortcuts.narration)
  main.setSlashShortcut('background', def.slashShortcuts.background)
  Object.entries(def.slashNumberAssignments).forEach(([digit, value]) => main.setSlashNumberAssignment(digit, value))
  const mainItems = useSettingsStore.getState().directionItems
  const minLen = Math.min(mainItems.length, def.directionItems.length)
  for (let i = 0; i < minLen; i++) {
    main.updateDirectionItem(mainItems[i].id, def.directionItems[i].label, def.directionItems[i].enabled)
  }
  for (let i = minLen; i < def.directionItems.length; i++) {
    main.addDirectionItem(def.directionItems[i].label)
  }
  while (useSettingsStore.getState().directionItems.length > def.directionItems.length) {
    const items = useSettingsStore.getState().directionItems
    main.removeDirectionItem(items[items.length - 1].id)
  }
}
