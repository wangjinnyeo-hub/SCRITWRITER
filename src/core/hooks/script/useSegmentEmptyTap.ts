import { useRef, useCallback } from 'react'
import { SEGMENT_DOUBLE_TAP_MS } from '@/components/editor/constants'

/**
 * 세그먼트 빈 placeholder 더블탭 감지.
 * 짧은 간격(SEGMENT_DOUBLE_TAP_MS) 내 두 번 탭 시 onInsert 호출.
 * 반환되는 createHandlers를 segments.map 내부에서 호출해 각 세그먼트별 핸들러 생성.
 */
export function useSegmentEmptyTap() {
  const tapRef = useRef<{ plotBoxId: string; time: number }>({ plotBoxId: '', time: 0 })

  const createHandlers = useCallback(
    (
      plotBoxId: string,
      onInsert: () => string | null | undefined,
      onFocusNewUnit: (unitId: string) => void
    ) => {
      const onPointerDown = (e: React.PointerEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const now = Date.now()
        const prev = tapRef.current
        if (prev.plotBoxId === plotBoxId && now - prev.time < SEGMENT_DOUBLE_TAP_MS) {
          tapRef.current = { plotBoxId: '', time: 0 }
          const newId = onInsert()
          if (newId) onFocusNewUnit(newId)
        } else {
          tapRef.current = { plotBoxId, time: now }
          ;(e.currentTarget as HTMLElement).focus()
        }
      }

      const onClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
      }

      return { onPointerDown, onClick }
    },
    []
  )

  return createHandlers
}
