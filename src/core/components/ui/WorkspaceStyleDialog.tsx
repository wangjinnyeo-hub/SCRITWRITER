import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const SIZE_MAX_PX = {
  small: { w: 400, h: 0.9 },
  medium: { w: 560, h: 0.8 },
  large: { w: 820, h: 0.85 },
} as const

export type WorkspaceStyleDialogSize = keyof typeof SIZE_MAX_PX

interface WorkspaceStyleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  size?: WorkspaceStyleDialogSize
  /** Optional description for sr-only (accessibility). */
  description?: string
  children: React.ReactNode
  /** Pass-through for DialogContent (e.g. onPointerDownOutside). */
  contentProps?: React.ComponentPropsWithoutRef<typeof DialogContent>
  className?: string
}

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

function getScreenBounds(size: WorkspaceStyleDialogSize) {
  if (typeof window === 'undefined') return { maxW: 560, maxH: 600 }
  const sw = window.screen?.width ?? 1920
  const sh = window.screen?.height ?? 1080
  const { w, h } = SIZE_MAX_PX[size]
  return {
    maxW: Math.min(w, Math.floor(sw * 0.9)),
    maxH: size === 'small' ? undefined : Math.min(Math.floor(sh * h), Math.floor(sh * 0.9)),
  }
}

function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number } {
  const sw = window.screen?.width ?? 1920
  const sh = window.screen?.height ?? 1080
  return {
    x: Math.max(0, Math.min(sw - width, x)),
    y: Math.max(0, Math.min(sh - height, y)),
  }
}

export function WorkspaceStyleDialog({
  open,
  onOpenChange,
  title,
  size = 'medium',
  description,
  children,
  contentProps = {},
  className,
}: WorkspaceStyleDialogProps) {
  const { className: contentClassName, style: contentPropsStyle, ...restContentProps } = contentProps
  const contentRefProp = 'ref' in contentProps ? (contentProps as React.ComponentPropsWithRef<'div'>).ref : undefined
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null)
  const [screenBounds, setScreenBounds] = React.useState(() => getScreenBounds(size))
  const dragStartRef = React.useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null)

  React.useEffect(() => {
    if (open) {
      setPosition(null)
      setScreenBounds(getScreenBounds(size))
    }
  }, [open, size])

  React.useEffect(() => {
    if (!open) return
    const onResize = () => setScreenBounds(getScreenBounds(size))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, size])

  const handleHeaderPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const el = contentRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const startX = position?.x ?? rect.left
      const startY = position?.y ?? rect.top
      dragStartRef.current = { clientX: e.clientX, clientY: e.clientY, startX, startY }

      const onMove = (ev: PointerEvent) => {
        const start = dragStartRef.current
        if (!start) return
        const elem = contentRef.current
        if (!elem) return
        const dx = ev.clientX - start.clientX
        const dy = ev.clientY - start.clientY
        const x = start.startX + dx
        const y = start.startY + dy
        const r = elem.getBoundingClientRect()
        setPosition(clampPosition(x, y, r.width, r.height))
      }
      const onUp = () => {
        dragStartRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [position]
  )

  const mergeRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      ;(contentRef as React.MutableRefObject<HTMLDivElement | null>).current = el
      if (contentRefProp) {
        if (typeof contentRefProp === 'function') contentRefProp(el)
        else (contentRefProp as React.MutableRefObject<HTMLDivElement | null>).current = el
      }
    },
    [contentRefProp]
  )

  const contentStyle: React.CSSProperties = {
    ...(position !== null ? { left: position.x, top: position.y } : {}),
    maxWidth: screenBounds.maxW,
    maxHeight: screenBounds.maxH ?? undefined,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={mergeRef}
        className={cn(
          'p-0 gap-0 overflow-hidden flex flex-col rounded border border-border bg-background shadow-none',
          position === null ? 'left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]' : 'translate-x-0 translate-y-0',
          contentClassName,
          className
        )}
        style={{ ...contentPropsStyle, ...contentStyle }}
        {...restContentProps}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex items-center justify-between h-8 px-4 border-b border-border bg-[var(--panel-header)] shrink-0">
          <div
            className="flex-1 min-w-0 flex items-center cursor-grab active:cursor-grabbing select-none"
            onPointerDown={handleHeaderPointerDown}
          >
            <span className="text-xs font-medium truncate">{title}</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted -m-1 shrink-0"
            aria-label="닫기"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
