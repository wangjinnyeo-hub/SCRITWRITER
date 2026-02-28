/**
 * 로컬/시스템 폰트 목록 — exe(Chromium)에서 queryLocalFonts 보강, 실패 시 고정 목록 사용.
 * 서식은 모두 드롭다운 선택만 지원(직접입력 없음).
 */

export interface FontOption {
  value: string
  label: string
}

/** exe/브라우저 공통 폴백 목록 (직접입력 제거, 드롭다운 전용) */
const FALLBACK_FONT_OPTIONS: FontOption[] = [
  { value: '', label: '기본(상속)' },
  { value: 'Malgun Gothic', label: '맑은 고딕' },
  { value: 'Nanum Gothic', label: '나눔고딕' },
  { value: 'Nanum Myeongjo', label: '나눔명조' },
  { value: 'Noto Sans KR', label: 'Noto Sans KR' },
  { value: 'Noto Serif KR', label: 'Noto Serif KR' },
  { value: 'Batang', label: '바탕' },
  { value: 'Gulim', label: '굴림' },
  { value: 'Dotum', label: '돋움' },
  { value: 'Gungsuh', label: '궁서' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Arial Black', label: 'Arial Black' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Tahoma', label: 'Tahoma' },
  { value: 'Consolas', label: 'Consolas' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Microsoft Sans Serif', label: 'Microsoft Sans Serif' },
  { value: 'Segoe UI', label: 'Segoe UI' },
]

const FALLBACK_VALUES = new Set(FALLBACK_FONT_OPTIONS.map((o) => o.value).filter(Boolean))

let cachedOptions: FontOption[] | null = null

function mergeFontOptions(localNames: string[]): FontOption[] {
  const byValue = new Map<string, string>()
  FALLBACK_FONT_OPTIONS.forEach((o) => byValue.set(o.value, o.label))
  localNames.forEach((name) => {
    const t = name.trim()
    if (t && !byValue.has(t)) byValue.set(t, t)
  })
  const result: FontOption[] = [{ value: '', label: '기본(상속)' }]
  FALLBACK_FONT_OPTIONS.filter((o) => o.value !== '').forEach((o) => {
    result.push(o)
    byValue.delete(o.value)
  })
  byValue.forEach((label, value) => result.push({ value, label }))
  return result
}

/** 로컬 폰트 조회 시도 (Chromium/Electron queryLocalFonts). 실패 시 폴백만 반환 */
export async function loadLocalFontOptions(): Promise<FontOption[]> {
  if (cachedOptions) return cachedOptions
  const fallback = [...FALLBACK_FONT_OPTIONS]
  try {
    const q = (window as Window & { queryLocalFonts?: () => Promise<{ family: string }[]> }).queryLocalFonts
    if (typeof q !== 'function') {
      cachedOptions = fallback
      return cachedOptions
    }
    const fonts = await q()
    const names = [...new Set((fonts || []).map((f) => f.family).filter(Boolean))]
    cachedOptions = mergeFontOptions(names)
    return cachedOptions
  } catch {
    cachedOptions = fallback
    return cachedOptions
  }
}

/** 폴백만 반환 (동기, 초기 렌더용). 실제 목록은 useLocalFontOptions 사용 */
export function getFallbackFontOptions(): FontOption[] {
  return FALLBACK_FONT_OPTIONS
}

export function isFontValueInFallback(value: string): boolean {
  return value === '' || FALLBACK_VALUES.has(value)
}
