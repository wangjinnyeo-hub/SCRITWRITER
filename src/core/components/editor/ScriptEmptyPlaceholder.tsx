import { forwardRef } from 'react'

interface ScriptEmptyPlaceholderProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children'> {
  /** 빈 시나리오(전체) vs 세그먼트(플롯) 구분 */
  variant: 'full' | 'segment'
  onInsert: () => string | undefined
  onOpenCommandPalette: () => void
  onPointerDown?: (e: React.PointerEvent) => void
  onClick?: (e: React.MouseEvent) => void
  includeTab?: boolean
  /** true면 Enter로 삽입 비활성화 (다중 플롯 시 구분선 하단 더블클릭만 허용) */
  insertOnlyOnDoubleClick?: boolean
}

export const ScriptEmptyPlaceholder = forwardRef<HTMLDivElement, ScriptEmptyPlaceholderProps>(
  (
    {
      variant,
      onInsert,
      onOpenCommandPalette,
      onPointerDown,
      onClick,
      includeTab = false,
      insertOnlyOnDoubleClick = false,
      className,
      ...rest
    },
    ref
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === '/') {
        e.preventDefault()
        onOpenCommandPalette()
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && !insertOnlyOnDoubleClick) {
        e.preventDefault()
        onInsert()
        return
      }
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault()
        onOpenCommandPalette()
        return
      }
      if (includeTab && e.key === 'Tab' && !e.shiftKey && !insertOnlyOnDoubleClick) {
        e.preventDefault()
        onInsert()
      }
    }

    /** insertOnlyOnDoubleClick 시 더블클릭에서만 onInsert 호출 (onPointerDown 없어도 호출) */
    const handleDoubleClick = (e: React.MouseEvent) => {
      e.preventDefault()
      if (variant === 'segment') e.stopPropagation()
      if (insertOnlyOnDoubleClick || !onPointerDown) onInsert()
    }

    const baseClass =
      variant === 'full'
        ? 'flex justify-center items-center h-full text-muted-foreground/40 outline-none cursor-text border-0'
        : 'flex justify-center items-center min-h-[72px] py-8 text-muted-foreground/40 outline-none cursor-text border-0 rounded border border-transparent hover:border-border/30 hover:text-muted-foreground/60 transition-colors select-none'

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={insertOnlyOnDoubleClick ? -1 : 0}
        className={className ? `${baseClass} ${className}` : baseClass}
        onPointerDown={insertOnlyOnDoubleClick ? (e) => { e.preventDefault(); e.stopPropagation() } : onPointerDown}
        onClick={insertOnlyOnDoubleClick ? (e) => { e.preventDefault(); e.stopPropagation() } : onClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <p className="text-[11px] pointer-events-none">
          {insertOnlyOnDoubleClick ? '더블클릭으로 시작' : '더블클릭 또는 Enter로 시작'}
        </p>
      </div>
    )
  }
)
