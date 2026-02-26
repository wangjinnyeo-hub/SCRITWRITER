import { createContext, useContext, type RefObject } from 'react'

/** 서식 다이얼로그 내 컬러피커 포탈용. 있으면 다이얼로그 내부로 포탈해 같은 stacking context에서 보이게 함. */
export const ColorPickerPortalContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

export function useColorPickerPortalContainer() {
  return useContext(ColorPickerPortalContext)
}
