/**
 * 드롭 좌표(clientX, clientY)에 해당하는 textarea 내 문자 인덱스를 반환한다.
 * 1) 미러 div + caretPositionFromPoint/caretRangeFromPoint 시도
 * 2) 실패 시 좌표 기반 줄/칸 추정(measureText) fallback
 */
export function getCaretIndexFromPoint(
  textarea: HTMLTextAreaElement,
  clientX: number,
  clientY: number,
  fallback: number
): number {
  const rect = textarea.getBoundingClientRect()
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return fallback
  }
  const style = window.getComputedStyle(textarea)
  const paddingTop = parseFloat(style.paddingTop) || 0
  const paddingLeft = parseFloat(style.paddingLeft) || 0
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) || 14
  const text = textarea.value
  const lines = text.split('\n')

  const mirror = document.createElement('div')
  mirror.setAttribute('aria-hidden', 'true')
  Object.assign(mirror.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    padding: style.padding,
    font: style.font,
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    lineHeight: style.lineHeight,
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflow: 'auto',
    boxSizing: 'border-box',
    visibility: 'visible',
    opacity: '0',
    pointerEvents: 'auto',
    border: style.border,
    zIndex: '2147483647',
  })
  mirror.textContent = text
  document.body.appendChild(mirror)
  mirror.scrollTop = textarea.scrollTop
  mirror.scrollLeft = textarea.scrollLeft
  let offset = fallback
  try {
    const pos = document.caretPositionFromPoint?.(clientX, clientY)
    if (pos && mirror.contains(pos.offsetNode)) {
      offset = pos.offsetNode.nodeType === Node.TEXT_NODE ? pos.offset : fallback
    } else {
      const range = document.caretRangeFromPoint?.(clientX, clientY)
      if (range && mirror.contains(range.startContainer)) {
        offset = range.startContainer.nodeType === Node.TEXT_NODE ? range.startOffset : fallback
      }
    }
  } finally {
    mirror.remove()
  }

  if (offset === fallback && lines.length > 0) {
    const relY = clientY - rect.top - paddingTop + textarea.scrollTop
    const lineIndex = Math.max(0, Math.min(lines.length - 1, Math.floor(relY / lineHeight)))
    const lineText = lines[lineIndex] ?? ''
    const relX = clientX - rect.left - paddingLeft + textarea.scrollLeft
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.font = style.font
      let charIndex = 0
      for (let i = 0; i <= lineText.length; i++) {
        const w = ctx.measureText(lineText.slice(0, i)).width
        if (w >= relX) break
        charIndex = i
      }
      const lineStarts: number[] = [0]
      for (let i = 1; i < lines.length; i++) {
        lineStarts.push(lineStarts[i - 1] + (lines[i - 1]?.length ?? 0) + 1)
      }
      offset = (lineStarts[lineIndex] ?? 0) + charIndex
    }
  }
  return Math.max(0, Math.min(offset, textarea.value.length))
}
