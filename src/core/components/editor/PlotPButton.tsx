import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui/uiStore'

const P_CLICK_DELAY_MS = 150

export interface PlotPButtonProps {
  boxId: string
  pNumber: number
  confirmed: boolean
  isActive?: boolean
  onPButtonClick: (boxId: string) => void
  onPButtonDoubleClick: (boxId: string) => void
  onActivate?: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
  className?: string
  /** 버튼 내용. 기본은 pNumber */
  children?: React.ReactNode
  role?: 'tab' | 'button'
  'aria-label'?: string
  'aria-selected'?: boolean
}

/** 플롯 확정 P 버튼: 단일클릭(150ms 지연) → onPButtonClick, 더블클릭 → onPButtonDoubleClick. 수정자키 → onActivate. 확정/비확정 시 채우기 애니메이션. */
export function PlotPButton({
  boxId,
  pNumber,
  confirmed,
  isActive = false,
  onPButtonClick,
  onPButtonDoubleClick,
  onActivate,
  onContextMenu,
  className,
  children,
  role = 'tab',
  'aria-label': ariaLabel = `플롯 ${pNumber} 확정 토글`,
  'aria-selected': ariaSelected = isActive,
}: PlotPButtonProps) {
  const pClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevConfirmedRef = useRef(confirmed)
  const confirmChangeFromTrigger = useUIStore(state => state.confirmChangeFromTrigger)
  const setConfirmChangeFromTrigger = useUIStore(state => state.setConfirmChangeFromTrigger)
  const [unconfirming, setUnconfirming] = useState(false)
  /** 트리거로 확정 직후 채우기 애니메이션 재생 중. 애니 끝나면 해제. */
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (prevConfirmedRef.current && !confirmed) {
      if (confirmChangeFromTrigger) {
        setUnconfirming(true)
        setConfirmChangeFromTrigger(false)
      }
    } else if (!prevConfirmedRef.current && confirmed && confirmChangeFromTrigger) {
      setConfirming(true)
      setConfirmChangeFromTrigger(false)
    }
    prevConfirmedRef.current = confirmed
  }, [confirmed, confirmChangeFromTrigger, setConfirmChangeFromTrigger])

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName === 'plot-p-btn-fill') {
      if (unconfirming) setUnconfirming(false)
      if (confirming) setConfirming(false)
    }
  }

  return (
    <button
      type="button"
      role={role}
      className={cn(
        'plot-p-btn shrink-0 rounded flex items-center justify-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset relative overflow-hidden',
        confirmed && confirming && 'plot-p-btn-confirmed text-background',
        confirmed && !confirming && 'plot-p-btn-confirmed-instant text-background',
        unconfirming && 'plot-p-btn-unconfirming',
        !confirmed && !unconfirming && 'bg-muted/80 text-muted-foreground hover:text-foreground',
        className
      )}
      onAnimationEnd={handleAnimationEnd}
      aria-label={ariaLabel}
      aria-selected={ariaSelected}
      onClickCapture={(e) => {
        e.stopPropagation()
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          onActivate?.(e as unknown as React.MouseEvent)
          return
        }
        if ((e.nativeEvent as MouseEvent).detail >= 2) return
        if (pClickTimeoutRef.current) clearTimeout(pClickTimeoutRef.current)
        pClickTimeoutRef.current = setTimeout(() => {
          pClickTimeoutRef.current = null
          onPButtonClick(boxId)
        }, P_CLICK_DELAY_MS)
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (pClickTimeoutRef.current) {
          clearTimeout(pClickTimeoutRef.current)
          pClickTimeoutRef.current = null
        }
        onPButtonDoubleClick(boxId)
      }}
      onPointerLeave={() => {
        if (pClickTimeoutRef.current) {
          clearTimeout(pClickTimeoutRef.current)
          pClickTimeoutRef.current = null
        }
      }}
      onContextMenu={onContextMenu}
    >
      <span className="relative z-10">{children ?? pNumber}</span>
    </button>
  )
}
