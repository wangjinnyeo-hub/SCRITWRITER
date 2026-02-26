import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface ContextMenuItem {
  label?: string
  shortcut?: string
  action?: () => void
  separator?: boolean
  disabled?: boolean
  children?: ContextMenuItem[]
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  position: { x: number; y: number }
  onClose: () => void
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement | null>(null)
  const [submenu, setSubmenu] = useState<{ items: ContextMenuItem[]; rect: DOMRect } | null>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      const inMenu = menuRef.current?.contains(target)
      const inSubmenu = submenuRef.current?.contains(target)
      if (!inMenu && !inSubmenu) onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as Node
      const inMenu = menuRef.current?.contains(target)
      const inSubmenu = submenuRef.current?.contains(target)
      if (!inMenu && !inSubmenu) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    document.addEventListener('contextmenu', handleContextMenu, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('contextmenu', handleContextMenu, true)
    }
  }, [onClose])

  const adjustedPos = { ...position }
  if (typeof window !== 'undefined') {
    if (position.x + 180 > window.innerWidth) adjustedPos.x = position.x - 180
    if (position.y + 300 > window.innerHeight) adjustedPos.y = Math.max(4, window.innerHeight - 300)
  }

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      item.action?.()
      onClose()
    },
    [onClose]
  )

  return (
    <div className="fixed inset-0 z-[100]" onContextMenu={(e) => { e.preventDefault(); onClose() }}>
      <div
        ref={menuRef}
        className="fixed bg-card border border-border rounded shadow-sm py-1 min-w-[160px] z-[101]"
        style={{ left: adjustedPos.x, top: adjustedPos.y }}
      >
        {items.map((item, i) => {
          if (item.separator) return <div key={i} className="my-0.5 border-t border-border/50" />
          return (
            <button
              key={i}
              disabled={item.disabled}
              className={cn(
                'w-full text-left px-3 py-1 text-[11px] flex items-center justify-between gap-4 transition-colors',
                item.disabled ? 'text-muted-foreground/40 cursor-default' : 'hover:bg-accent text-foreground'
              )}
              onClick={handleItemClick(item)}
              onMouseEnter={(e) => {
                if (item.children) {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setSubmenu({ items: item.children, rect })
                } else {
                  setSubmenu(null)
                }
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && <span className="text-[9px] text-muted-foreground/60">{item.shortcut}</span>}
              {item.children && <span className="text-[9px] text-muted-foreground">▸</span>}
            </button>
          )
        })}
      </div>

      {submenu && (
        <div
          ref={submenuRef}
          className="fixed bg-card border border-border rounded shadow-sm py-1 min-w-[140px] z-[102]"
          style={{ left: submenu.rect.right + 4, top: submenu.rect.top }}
        >
          {submenu.items.map((item, i) => {
            if (item.separator) return <div key={i} className="my-0.5 border-t border-border/50" />
            return (
              <button
                key={i}
                disabled={item.disabled}
                className={cn(
                  'w-full text-left px-3 py-1 text-[11px] flex items-center justify-between gap-4 transition-colors',
                  item.disabled ? 'text-muted-foreground/40 cursor-default' : 'hover:bg-accent text-foreground'
                )}
                onClick={handleItemClick(item)}
              >
                <span>{item.label}</span>
                {item.shortcut && <span className="text-[9px] text-muted-foreground/60">{item.shortcut}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function useContextMenu() {
  const [ctx, setCtx] = useState<{ items: ContextMenuItem[]; position: { x: number; y: number } } | null>(null)

  const show = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault()
    e.stopPropagation()
    setCtx({ items, position: { x: e.clientX, y: e.clientY } })
  }, [])

  const close = useCallback(() => setCtx(null), [])

  return { ctx, show, close }
}
