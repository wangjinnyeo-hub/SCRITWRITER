import { cn } from '@/lib/utils'

interface DragHandleIconProps {
  className?: string
  width?: number
  height?: number
}

export function DragHandleIcon({ className, width = 10, height = 10 }: DragHandleIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn(className)} aria-hidden>
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </svg>
  )
}
