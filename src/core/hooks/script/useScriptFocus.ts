import { useCallback, useEffect, useRef } from 'react'
import type { ScriptUnit } from '@/types/sw'

interface UseScriptFocusOptions {
  focusUnitId: string | null
  setFocusUnitId: (id: string | null) => void
  scriptUnits: ScriptUnit[]
}

export function useScriptFocus({ focusUnitId, setFocusUnitId, scriptUnits }: UseScriptFocusOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())

  // 새 텍스트 박스 생성 시 해당 박스로 포커스 (플롯 블록과 동일: rAF 한 번)
  useEffect(() => {
    if (!focusUnitId) return
    const id = focusUnitId
    const rafId = requestAnimationFrame(() => {
      const el = textareaRefs.current.get(id)
      if (el?.isConnected) {
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      setFocusUnitId(null)
    })
    return () => cancelAnimationFrame(rafId)
  }, [focusUnitId, scriptUnits, setFocusUnitId])

  const pendingResizeRef = useRef<Set<HTMLTextAreaElement>>(new Set())
  const rafIdRef = useRef<number | null>(null)
  const autoResize = useCallback((textarea: HTMLTextAreaElement) => {
    pendingResizeRef.current.add(textarea)
    if (rafIdRef.current !== null) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      const set = pendingResizeRef.current
      pendingResizeRef.current = new Set()
      set.forEach(el => {
        if (!el.isConnected) return
        el.style.height = 'auto'
        const newHeight = Math.max(el.scrollHeight, 20)
        el.style.height = `${newHeight}px`
      })
    })
  }, [])

  return { containerRef, textareaRefs, autoResize }
}
