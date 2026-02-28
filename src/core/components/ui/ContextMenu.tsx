import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  /** 포탈 대상(이벤트가 발생한 document.body). 좌표계 일치용 */
  portalTarget?: HTMLElement | null
  onClose: () => void
}

export function ContextMenu({ items, position, portalTarget, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const probeOriginRef = useRef<HTMLDivElement>(null)
  const probeScaleRef = useRef<HTMLDivElement>(null)
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

  /** 메뉴가 화면 아래/오른쪽으로 넘치지 않도록, 위치에 따라 위·아래·좌우 정렬. transform으로 배치해 좌표계 일치 */
  const MENU_ESTIMATED_HEIGHT = 300
  const MENU_MIN_WIDTH = 180
  const viewport = typeof window !== 'undefined' ? { w: window.innerWidth, h: window.innerHeight } : { w: 0, h: 0 }
  const alignBottom = viewport.h > 0 && position.y + MENU_ESTIMATED_HEIGHT > viewport.h
  let translateX = position.x
  let translateY = position.y
  if (viewport.w > 0) {
    if (position.x + MENU_MIN_WIDTH > viewport.w) {
      translateX = Math.max(4, position.x - MENU_MIN_WIDTH)
    }
    if (alignBottom) {
      translateY = Math.max(4, position.y - MENU_ESTIMATED_HEIGHT)
    } else if (position.y < 4) {
      translateY = 4
    }
  }
  const style: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    top: 0,
    zIndex: 101,
    transform: `translate(${translateX}px, ${translateY}px)`,
  }

  /** 전체 화면에서 우측으로 갈수록 틀어지는 현상: 포탈 좌표계의 scale/offset을 재어 뷰포트 좌표로 역산 */
  useLayoutEffect(() => {
    const originEl = probeOriginRef.current
    const scaleEl = probeScaleRef.current
    const menuEl = menuRef.current
    if (!originEl || !scaleEl || !menuEl) return
    const r0 = originEl.getBoundingClientRect()
    const r1 = scaleEl.getBoundingClientRect()
    const originX = r0.left
    const originY = r0.top
    const scaleX = (r1.left - r0.left) / 100
    const scaleY = (r1.top - r0.top) / 100
    const eps = 0.001
    const safeScaleX = Math.abs(scaleX) < eps ? 1 : scaleX
    const safeScaleY = Math.abs(scaleY) < eps ? 1 : scaleY
    const correctedX = (translateX - originX) / safeScaleX
    const correctedY = (translateY - originY) / safeScaleY
    menuEl.style.transform = `translate(${correctedX}px, ${correctedY}px)`
  }, [translateX, translateY])

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      item.action?.()
      onClose()
    },
    [onClose]
  )

  const menuContent = (
    <div className="fixed inset-0 z-[100]" onContextMenu={(e) => { e.preventDefault(); onClose() }}>
      {/* 포탈 좌표계 → 뷰포트 보정용: (0,0)과 (100,100)의 실제 화면 위치로 scale/offset 계산 */}
      <div
        ref={probeOriginRef}
        aria-hidden
        style={{ position: 'fixed', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' }}
      />
      <div
        ref={probeScaleRef}
        aria-hidden
        style={{ position: 'fixed', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none', transform: 'translate(100px, 100px)' }}
      />
      <div
        ref={menuRef}
        className="bg-card border border-border rounded shadow-sm py-1 min-w-[160px]"
        style={style}
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

  const target = portalTarget ?? (typeof document !== 'undefined' ? document.body : null)
  if (target) {
    return createPortal(menuContent, target)
  }
  return menuContent
}

export function useContextMenu() {
  const [ctx, setCtx] = useState<{
    items: ContextMenuItem[]
    position: { x: number; y: number }
    portalTarget: HTMLElement | null
  } | null>(null)

  const show = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault()
    e.stopPropagation()
    const native = e.nativeEvent
    const target = (native.target as Node)?.ownerDocument?.body ?? null
    setCtx({
      items,
      position: { x: native.clientX, y: native.clientY },
      portalTarget: target,
    })
  }, [])

  const close = useCallback(() => setCtx(null), [])

  return { ctx, show, close }
}
