import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { AtPaletteItem } from '@/hooks/script/useAtPalette'

const PALETTE_WIDTH = 192
const PALETTE_MAX_HEIGHT = 192
const VIEWPORT_PADDING = 8

interface AtPaletteProps {
  items: AtPaletteItem[]
  position: { x: number; y: number } | null
  above?: boolean
  /** true면 fixed 포지셔닝(뷰포트 기준) - 컨테이너 overflow 잘림 방지 */
  useFixed?: boolean
  containerRect?: DOMRect | null
  onSelect: (item: AtPaletteItem) => void
  onCancel: () => void
  /** 매칭 없을 때 방향키·스페이스 등으로 커서 이동 시 해당 키를 텍스트에 삽입 후 닫기. query 빈 상태에서 ArrowLeft/Right 시 '@' 삽입 */
  onCancelWithKey?: (key: string) => void
  query: string
  onQueryChange: (q: string) => void
}

export function AtPalette({
  items,
  position,
  above = false,
  useFixed = false,
  onSelect,
  onCancel,
  onCancelWithKey,
  query,
  onQueryChange,
}: AtPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  useEffect(() => {
    queueMicrotask(() => setSelectedIndex(0))
    if (listRef.current) listRef.current.scrollTop = 0
  }, [query, items])

  useEffect(() => {
    if (position && inputRef.current) {
      const t = requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
      return () => cancelAnimationFrame(t)
    }
  }, [position])

  useEffect(() => {
    const btn = itemRefs.current.get(selectedIndex)
    if (btn && listRef.current) {
      btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const queryEmpty = !query.trim()
      // @ 직후 query 빈 상태: ArrowLeft/Right → '@' 텍스트로 타이핑 후 닫기
      if (queryEmpty && onCancelWithKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        onCancelWithKey('@')
        return
      }
      // @ 직후 query 빈 상태: 스페이스바 → 최상단(현재 유형) 선택
      if (queryEmpty && e.key === 'Space' && items.length > 0) {
        e.preventDefault()
        onSelect(items[0])
        return
      }
      // 매칭 없을 때: 방향키·스페이스·일반 문자 → 해당 키를 텍스트에 삽입 후 닫기
      if (items.length === 0 && onCancelWithKey) {
        const passthroughKeys = ['ArrowLeft', 'ArrowRight', 'Space', 'ArrowUp', 'ArrowDown']
        if (passthroughKeys.includes(e.key)) {
          e.preventDefault()
          onCancelWithKey(e.key === 'Space' ? ' ' : e.key)
          return
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          onCancelWithKey(e.key)
          return
        }
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % Math.max(1, items.length))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + items.length) % Math.max(1, items.length))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (items[selectedIndex]) {
          onSelect(items[selectedIndex])
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
    },
    [items, selectedIndex, query, onSelect, onCancel, onCancelWithKey]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!position) return null

  const win = typeof window !== 'undefined' ? window : null
  const left = win ? Math.max(VIEWPORT_PADDING, Math.min(position.x, win.innerWidth - PALETTE_WIDTH - VIEWPORT_PADDING)) : position.x
  let style: React.CSSProperties
  if (useFixed && win) {
    if (above) {
      const bottomFromViewport = win.innerHeight - position.y
      const topEdge = position.y - PALETTE_MAX_HEIGHT
      const topClamped = topEdge < VIEWPORT_PADDING ? VIEWPORT_PADDING : undefined
      const bottomClamped = topClamped !== undefined ? undefined : bottomFromViewport
      style = {
        position: 'fixed',
        left,
        ...(topClamped !== undefined ? { top: topClamped, bottom: undefined } : { bottom: bottomClamped, top: undefined }),
      }
    } else {
      const topVal = position.y
      const bottomEdge = topVal + PALETTE_MAX_HEIGHT
      const bottomClamped = bottomEdge > win.innerHeight - VIEWPORT_PADDING ? win.innerHeight - PALETTE_MAX_HEIGHT - VIEWPORT_PADDING : undefined
      style = {
        position: 'fixed',
        left,
        top: bottomClamped !== undefined ? bottomClamped : topVal,
      }
    }
  } else {
    style = useFixed
      ? { position: 'fixed' as const, left, ...(above ? { bottom: win ? win.innerHeight - position.y : undefined, top: undefined } : { top: position.y }) }
      : { position: 'absolute' as const, left: position.x, ...(above ? { bottom: `calc(100% - ${position.y}px)` } : { top: position.y }) }
  }

  const content = (
    <>
      <div className="fixed inset-0 z-40" onClick={onCancel} aria-hidden="true" />
      <div
        className="z-50 w-48 bg-white dark:bg-zinc-900 border border-border rounded shadow-lg overflow-hidden text-xs"
        style={style}
      >
        <div className="p-1.5 border-b border-border">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="필터..."
            className="w-full px-1.5 py-1 bg-muted/50 rounded outline-none focus:bg-muted text-xs"
            autoFocus
          />
        </div>
        <div ref={listRef} className="max-h-48 overflow-auto">
          {items.length === 0 ? (
            <div className="p-2 text-center text-muted-foreground">매칭 없음</div>
          ) : (
            items.map((item, i) => (
              <button
                key={item.id}
                ref={(el) => { if (el) itemRefs.current.set(i, el) }}
                onClick={() => onSelect(item)}
                className={cn(
                  'w-full text-left px-1.5 py-1 rounded transition-colors',
                  i === selectedIndex ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                {item.label}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )

  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content
}
