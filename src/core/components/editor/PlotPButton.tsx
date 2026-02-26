import { useRef } from 'react'
import { cn } from '@/lib/utils'

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

/** 플롯 확정 P 버튼: 단일클릭(150ms 지연) → onPButtonClick, 더블클릭 → onPButtonDoubleClick. 수정자키 → onActivate. */
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

  return (
    <button
      type="button"
      role={role}
      className={cn(
        'shrink-0 rounded flex items-center justify-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset',
        confirmed && 'bg-foreground text-background',
        !confirmed && 'bg-muted/80 text-muted-foreground hover:text-foreground',
        className
      )}
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
      onContextMenu={onContextMenu}
    >
      {children ?? pNumber}
    </button>
  )
}
