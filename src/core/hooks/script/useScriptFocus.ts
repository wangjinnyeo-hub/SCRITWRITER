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

  const autoResize = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto'
    const newHeight = Math.max(textarea.scrollHeight, 20)
    textarea.style.height = `${newHeight}px`
  }, [])

  return { containerRef, textareaRefs, autoResize }
}
