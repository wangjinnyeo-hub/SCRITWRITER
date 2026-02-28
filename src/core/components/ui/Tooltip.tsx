import React, { useCallback, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

const TOOLTIP_DELAY_MS = 400

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  side?: 'top' | 'bottom'
  className?: string
}

export function Tooltip({ content, children, side = 'bottom', className }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [contentState, setContentState] = useState<React.ReactNode>(content)
  const triggerRef = useRef<HTMLElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setContentState(content)
  }, [content])

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      const el = triggerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const gap = 6
      setPosition({
        x: rect.left + rect.width / 2,
        y: side === 'bottom' ? rect.bottom + gap : rect.top - gap,
      })
      setOpen(true)
    }, TOOLTIP_DELAY_MS)
  }, [side])

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setOpen(false)
  }, [])

  const child = children as React.ReactElement<{ ref?: React.Ref<HTMLElement>; onMouseEnter?: React.MouseEventHandler; onMouseLeave?: React.MouseEventHandler }>
  const trigger = React.cloneElement(child, {
    ref: (el: HTMLElement | null) => {
      triggerRef.current = el
      const origRef = (child as unknown as { ref?: React.Ref<HTMLElement> }).ref
      if (typeof origRef === 'function') origRef(el)
      else if (origRef) (origRef as React.MutableRefObject<HTMLElement | null>).current = el
    },
    onMouseEnter: (e: React.MouseEvent) => {
      child.props.onMouseEnter?.(e)
      show()
    },
    onMouseLeave: (e: React.MouseEvent) => {
      child.props.onMouseLeave?.(e)
      hide()
    },
  })

  return (
    <>
      {trigger}
      {typeof document !== 'undefined' &&
        open &&
        createPortal(
          <div
            role="tooltip"
            className={cn(
              'fixed z-[9999] pointer-events-none px-2.5 py-1.5 text-[11px] font-medium text-card-foreground bg-card border border-border rounded-md shadow-lg max-w-[240px] break-words transition-opacity duration-150',
              side === 'bottom' ? 'origin-top' : 'origin-bottom',
              className
            )}
            style={{
              left: position.x,
              top: position.y,
              transform: `translate(-50%, ${side === 'bottom' ? '0' : '-100%'})`,
            }}
          >
            {contentState}
          </div>,
          document.body
        )}
    </>
  )
}
