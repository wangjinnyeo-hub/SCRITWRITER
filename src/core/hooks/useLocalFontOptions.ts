import { useState, useEffect } from 'react'
import { loadLocalFontOptions, getFallbackFontOptions, type FontOption } from '@/lib/localFonts'

/** 서식 탭 등에서 사용. 초기엔 폴백으로 바로 표시하고, 로컬 폰트는 한 번만 백그라운드 로드 후 캐시 반영 */
export function useLocalFontOptions(): FontOption[] {
  const [options, setOptions] = useState<FontOption[]>(getFallbackFontOptions)

  useEffect(() => {
    const win = window as Window & { requestIdleCallback?: typeof window.requestIdleCallback; cancelIdleCallback?: typeof window.cancelIdleCallback }
    const useIdle = typeof win.requestIdleCallback === 'function'
    const id = useIdle
      ? win.requestIdleCallback(() => { loadLocalFontOptions().then(setOptions) }, { timeout: 1500 })
      : win.setTimeout(() => { loadLocalFontOptions().then(setOptions) }, 0)
    return () => {
      if (useIdle && typeof id === 'number') win.cancelIdleCallback!(id)
      else clearTimeout(id as ReturnType<typeof setTimeout>)
    }
  }, [])

  return options
}
