export interface ColorPreset {
  id: string
  name: string
  nameKo: string
  colors: string[]
}

/** 엑스트라 전용 — 채도 없이 회색으로 통일 */
export const EXTRA_CHARACTER_COLOR = '#737373'

/** 엑스트라 외 기본 인물용 색상 — 채도 있는 색으로 구분 (새 캐릭터 추가 시 기본값으로 사용) */
export const DEFAULT_CHARACTER_COLORS: string[] = [
  '#2563eb', // 파랑
  '#16a34a', // 초록
  '#c2410c', // 주황/테라코타
  '#7c3aed', // 보라
  '#0d9488', // 청록
  '#b91c1c', // 빨강
  '#ca8a04', // 골드
  '#db2777', // 핑크
]

/** 프리셋: 회색·채도·밝은 색·파스텔 등 다양하게 */
export const colorPresets: ColorPreset[] = [
  {
    id: 'slate',
    name: 'Slate',
    nameKo: '슬레이트',
    colors: ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'],
  },
  {
    id: 'modern',
    name: 'Modern',
    nameKo: '모던',
    colors: ['#37474F', '#455A64', '#546E7A', '#607D8B', '#78909C', '#90a4ae', '#b0bec5'],
  },
  {
    id: 'dark',
    name: 'Dark',
    nameKo: '어두운',
    colors: ['#212121', '#424242', '#616161', '#757575', '#9E9E9E', '#BDBDBD', '#E0E0E0'],
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    nameKo: '흑백',
    colors: ['#000000', '#424242', '#757575', '#BDBDBD', '#EEEEEE', '#f5f5f5', '#ffffff'],
  },
  {
    id: 'light',
    name: 'Light',
    nameKo: '밝은',
    colors: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569'],
  },
  {
    id: 'characters',
    name: 'Characters',
    nameKo: '인물',
    colors: ['#2563eb', '#16a34a', '#c2410c', '#7c3aed', '#0d9488', '#b91c1c', '#ca8a04', '#db2777'],
  },
  {
    id: 'pastel',
    name: 'Pastel',
    nameKo: '파스텔',
    colors: ['#93c5fd', '#86efac', '#fdba74', '#c4b5fd', '#5eead4', '#fca5a5', '#fde047', '#f9a8d4'],
  },
  {
    id: 'muted',
    name: 'Muted',
    nameKo: '뮤트',
    colors: ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#14b8a6', '#ef4444', '#eab308', '#ec4899'],
  },
]
