import { create } from 'zustand'
import type { ScriptPropertyType, PropertyStyle } from '@/types'

interface DirectionItem {
  id: string
  label: string
  enabled: boolean
}

interface StylePreset {
  id: string
  name: string
  styles: Record<ScriptPropertyType, PropertyStyle>
}

interface SettingsState {
  propertyLabels: Record<ScriptPropertyType, string>
  propertyStyles: Record<ScriptPropertyType, PropertyStyle>
  doubleEnterDelay: number
  slashShortcutsEnabled: boolean
  slashShortcuts: {
    action: string
    narration: string
    background: string
  }
  /** / 팔레트에서 1~9 숫자에 할당할 유형/연출/캐릭터. 키="1"~"9", 값=action|narration|background|directionId|characterId */
  slashNumberAssignments: Record<string, string>
  directionItems: DirectionItem[]
  directionModeEnabled: boolean
  recentColors: string[]
  recentColorPresetIds: string[]
  lastSelectedColorPresetId: string | null
  selectedPresetId: string | null
  recentStylePresetIds: string[]
  lastSelectedStylePresetId: string | null
  stylePresets: StylePreset[]
  characterPosition: 'inline' | 'left'
  dialogueColorMode: 'character' | 'black' | 'custom'
  dialogueCustomColor: string
  dialogueParagraphGap: number
  /** 대사 타이핑 영역 표시 너비: 좁게/중간/넓게/커스텀. 왼쪽 여백 유지, 오른쪽으로 확장 */
  dialogueTypingWidth: 'narrow' | 'medium' | 'wide' | 'custom'
  /** dialogueTypingWidth === 'custom' 일 때 사용할 너비(ch 단위) */
  dialogueTypingWidthCh: number
  /** 모든 ' : ' 를 대사로 인식: " : " 포함 줄을 대사로, 캐릭터 규칙 적용 */
  colonAsDialogue: boolean
  unitDivider: 'none' | 'line' | 'dot'
  enterDefaultType: 'dialogue' | 'action' | 'narration'
  /** 빈 시나리오에서 더블클릭/Enter로 시작할 때 사용할 유형 (설정 제목: 시작 타이핑 유형) */
  startTypingType: ScriptPropertyType
  // Enter 연타 규칙: [1회, 2회, 3회] → 각각 어떤 타입으로 전환할지
  enterChain: (ScriptPropertyType | 'same')[]
  // # 호출 매핑: key=패턴(#,##,###,####), value=타입
  hashShortcuts: Record<string, ScriptPropertyType>
  /** 유형별 Shift+Enter 시 추가될 유형 (배경/지문/나레이션/대사 각각 자유 할당) */
  shiftEnterNextTypeByCurrent: Record<'background' | 'action' | 'narration' | 'dialogue', 'background' | 'action' | 'narration' | 'dialogue'>
  /** 자동 순차: 배경 유형 추가 시 숫자 자동 할당 사용 여부 */
  backgroundSeqEnabled: boolean
  /** 자동 순차 숫자 앞 단어. 예: "S#" → S#1, S#2 */
  backgroundSeqPrefix: string
  /** 자동 순차 숫자 뒤 단어. 비워두면 숫자 뒤에 아무것도 없음 */
  backgroundSeqSuffix: string
  /** 자동 순차 범위: episode=에피소드 전체, plot=플롯(시나리오)별 */
  backgroundSeqScope: 'episode' | 'plot'
  /** 플롯·제목 등 스크립트 창 외에 기본 적용되는 서체. 빈 값이면 상속 */
  defaultFontFamily: string
  /** UI 배율 (10% 단위). 100 = 100% */
  uiScalePercent: number

  setDirectionModeEnabled: (enabled: boolean) => void
  setPropertyLabel: (type: ScriptPropertyType, label: string) => void
  setPropertyStyle: (type: ScriptPropertyType, style: Partial<PropertyStyle>) => void
  setDoubleEnterDelay: (delay: number) => void
  setSlashShortcutsEnabled: (enabled: boolean) => void
  setSlashShortcut: (type: 'action' | 'narration' | 'background', key: string) => void
  setSlashNumberAssignment: (digit: string, value: string) => void
  addDirectionItem: (label: string) => void
  updateDirectionItem: (id: string, label: string, enabled: boolean) => void
  removeDirectionItem: (id: string) => void
  addRecentColor: (color: string) => void
  addRecentColorPreset: (id: string) => void
  setLastSelectedColorPresetId: (id: string | null) => void
  addRecentStylePreset: (id: string) => void
  setLastSelectedStylePresetId: (id: string | null) => void
  setSelectedPresetId: (id: string | null) => void
  saveStylePreset: (name: string) => void
  loadStylePreset: (id: string) => void
  deleteStylePreset: (id: string) => void
  setCharacterPosition: (pos: 'inline' | 'left') => void
  setDialogueColorMode: (mode: 'character' | 'black' | 'custom') => void
  setDialogueCustomColor: (color: string) => void
  setDialogueParagraphGap: (gap: number) => void
  setDialogueTypingWidth: (width: 'narrow' | 'medium' | 'wide' | 'custom') => void
  setDialogueTypingWidthCh: (ch: number) => void
  setColonAsDialogue: (enabled: boolean) => void
  setUnitDivider: (divider: 'none' | 'line' | 'dot') => void
  setEnterDefaultType: (type: 'dialogue' | 'action' | 'narration') => void
  setStartTypingType: (type: ScriptPropertyType) => void
  setEnterChain: (chain: (ScriptPropertyType | 'same')[]) => void
  setHashShortcut: (pattern: string, type: ScriptPropertyType) => void
  setShiftEnterNextType: (currentType: 'background' | 'action' | 'narration' | 'dialogue', nextType: 'background' | 'action' | 'narration' | 'dialogue') => void
  setBackgroundSeqEnabled: (enabled: boolean) => void
  setBackgroundSeqPrefix: (prefix: string) => void
  setBackgroundSeqSuffix: (suffix: string) => void
  setBackgroundSeqScope: (scope: 'episode' | 'plot') => void
  setDefaultFontFamily: (font: string) => void
  setUiScalePercent: (percent: number) => void
  resetToDefaults: () => void
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
  character: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#404040',
  },
  dialogue: {
    color: '#0a0a0a',
  },
  narration: {
    color: '#525252',
    textAlign: 'center',
  },
  action: {
    color: '#737373',
  },
  background: {
    color: '#262626',
    fontWeight: 'bold',
    textAlign: 'left',
  },
  direction: {
    color: '#737373',
    textAlign: 'center',
  },
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

export const useSettingsStore = create<SettingsState>((set) => ({
  propertyLabels: DEFAULT_LABELS,
  propertyStyles: DEFAULT_STYLES,
  doubleEnterDelay: 500,
  slashShortcutsEnabled: true,
  slashShortcuts: {
    action: '1',
    narration: '2',
    background: '3',
  },
  slashNumberAssignments: { '1': 'action', '2': 'narration', '3': 'background' },
  directionItems: DEFAULT_DIRECTION_ITEMS,
  directionModeEnabled: true,
  recentColors: [],
  recentColorPresetIds: [],
  lastSelectedColorPresetId: null,
  selectedPresetId: null,
  recentStylePresetIds: [],
  lastSelectedStylePresetId: null,
  stylePresets: [],
  characterPosition: 'inline',
  dialogueColorMode: 'black',
  dialogueCustomColor: '#000000',
  dialogueParagraphGap: 2,
  dialogueTypingWidth: 'medium',
  dialogueTypingWidthCh: 42,
  colonAsDialogue: true,
  unitDivider: 'none',
  enterDefaultType: 'dialogue',
  startTypingType: 'background',
  enterChain: ['same', 'action', 'narration'],
  hashShortcuts: {
    '#': 'dialogue',
    '##': 'action',
    '###': 'narration',
    '####': 'background',
  },
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
  uiScalePercent: 100,

  setDirectionModeEnabled: (enabled) => set({ directionModeEnabled: enabled }),
  setPropertyLabel: (type, label) => set((state) => ({
    propertyLabels: {
      ...state.propertyLabels,
      [type]: label,
    },
  })),
  
  setPropertyStyle: (type, style) => set((state) => ({
    propertyStyles: {
      ...state.propertyStyles,
      [type]: {
        ...state.propertyStyles[type],
        ...style,
      },
    },
  })),
  
  setDoubleEnterDelay: (delay) => set({ doubleEnterDelay: delay }),
  
  setSlashShortcutsEnabled: (enabled) => set({ slashShortcutsEnabled: enabled }),
  
  setSlashShortcut: (type, key) => set((state) => ({
    slashShortcuts: {
      ...state.slashShortcuts,
      [type]: key,
    },
  })),

  setSlashNumberAssignment: (digit, value) => set((state) => ({
    slashNumberAssignments: {
      ...state.slashNumberAssignments,
      [digit]: value,
    },
  })),

  addDirectionItem: (label) => set((state) => ({
    directionItems: [
      ...state.directionItems,
      {
        id: `custom-${Date.now()}`,
        label,
        enabled: true,
      },
    ],
  })),
  
  updateDirectionItem: (id, label, enabled) => set((state) => ({
    directionItems: state.directionItems.map(item =>
      item.id === id ? { ...item, label, enabled } : item
    ),
  })),
  
  removeDirectionItem: (id) => set((state) => ({
    directionItems: state.directionItems.filter(item => item.id !== id),
  })),

  addRecentColor: (color) => set((state) => {
    const filtered = state.recentColors.filter(c => c !== color)
    return { recentColors: [color, ...filtered].slice(0, 8) }
  }),

  addRecentColorPreset: (id) => set((state) => {
    const filtered = state.recentColorPresetIds.filter(x => x !== id)
    return { recentColorPresetIds: [id, ...filtered].slice(0, 3), lastSelectedColorPresetId: id }
  }),
  setLastSelectedColorPresetId: (id) => set({ lastSelectedColorPresetId: id }),

  addRecentStylePreset: (id) => set((state) => {
    const filtered = state.recentStylePresetIds.filter(x => x !== id)
    return { recentStylePresetIds: [id, ...filtered].slice(0, 3), lastSelectedStylePresetId: id }
  }),
  setLastSelectedStylePresetId: (id) => set({ lastSelectedStylePresetId: id }),

  setSelectedPresetId: (id) => set({ selectedPresetId: id }),

  saveStylePreset: (name) => set((state) => ({
    stylePresets: [
      ...state.stylePresets,
      {
        id: `preset-${Date.now()}`,
        name,
        styles: { ...state.propertyStyles },
      },
    ],
  })),

  loadStylePreset: (id) => set((state) => {
    const preset = state.stylePresets.find(p => p.id === id)
    if (!preset) return {}
    const filtered = state.recentStylePresetIds.filter(x => x !== id)
    return {
      propertyStyles: { ...preset.styles },
      recentStylePresetIds: [id, ...filtered].slice(0, 3),
      lastSelectedStylePresetId: id,
    }
  }),

  deleteStylePreset: (id) => set((state) => ({
    stylePresets: state.stylePresets.filter(p => p.id !== id),
  })),

  setCharacterPosition: (pos) => set({ characterPosition: pos }),
  setDialogueColorMode: (mode) => set({ dialogueColorMode: mode }),
  setDialogueCustomColor: (color) => set({ dialogueCustomColor: color }),
  setDialogueParagraphGap: (gap) => set({ dialogueParagraphGap: Math.max(0, Math.min(24, gap)) }),
  setDialogueTypingWidth: (width) => set({ dialogueTypingWidth: width }),
  setDialogueTypingWidthCh: (ch) => set({ dialogueTypingWidthCh: Math.max(20, Math.min(120, ch)) }),
  setColonAsDialogue: (enabled) => set({ colonAsDialogue: enabled }),
  setUnitDivider: (divider) => set({ unitDivider: divider }),
  setEnterDefaultType: (type) => set({ enterDefaultType: type }),
  setStartTypingType: (type) => set({ startTypingType: type }),
  setEnterChain: (chain) => set({ enterChain: chain }),
  setHashShortcut: (pattern, type) => set((state) => ({
    hashShortcuts: { ...state.hashShortcuts, [pattern]: type },
  })),
  setShiftEnterNextType: (currentType, nextType) => set((state) => ({
    shiftEnterNextTypeByCurrent: {
      ...state.shiftEnterNextTypeByCurrent,
      [currentType]: nextType,
    },
  })),
  setBackgroundSeqEnabled: (enabled) => set({ backgroundSeqEnabled: enabled }),
  setBackgroundSeqPrefix: (prefix) => set({ backgroundSeqPrefix: prefix }),
  setBackgroundSeqSuffix: (suffix) => set({ backgroundSeqSuffix: suffix }),
  setBackgroundSeqScope: (scope) => set({ backgroundSeqScope: scope }),
  setDefaultFontFamily: (font) => set({ defaultFontFamily: font }),
  setUiScalePercent: (percent) => set({ uiScalePercent: Math.min(150, Math.max(50, percent)) }),

  resetToDefaults: () => set({
    propertyLabels: DEFAULT_LABELS,
    propertyStyles: DEFAULT_STYLES,
    doubleEnterDelay: 500,
    slashShortcutsEnabled: true,
    recentColorPresetIds: [],
    lastSelectedColorPresetId: null,
    recentStylePresetIds: [],
    lastSelectedStylePresetId: null,
    slashShortcuts: {
      action: '1',
      narration: '2',
      background: '3',
    },
    slashNumberAssignments: { '1': 'action', '2': 'narration', '3': 'background' },
    directionItems: DEFAULT_DIRECTION_ITEMS,
    characterPosition: 'inline' as const,
    dialogueColorMode: 'black' as const,
    dialogueCustomColor: '#000000',
    dialogueParagraphGap: 2,
    dialogueTypingWidth: 'medium' as const,
    dialogueTypingWidthCh: 42,
    colonAsDialogue: true,
    unitDivider: 'none' as const,
    enterDefaultType: 'dialogue' as const,
    startTypingType: 'background' as ScriptPropertyType,
    enterChain: ['same', 'action', 'narration'] as (ScriptPropertyType | 'same')[],
    hashShortcuts: {
      '#': 'dialogue' as ScriptPropertyType,
      '##': 'action' as ScriptPropertyType,
      '###': 'narration' as ScriptPropertyType,
      '####': 'background' as ScriptPropertyType,
    },
    shiftEnterNextTypeByCurrent: {
      background: 'action',
      action: 'narration',
      narration: 'dialogue',
      dialogue: 'background',
    },
    backgroundSeqEnabled: true,
    backgroundSeqPrefix: 'S#',
    backgroundSeqSuffix: '',
    backgroundSeqScope: 'episode' as const,
    defaultFontFamily: '',
    uiScalePercent: 100,
  }),
}))
