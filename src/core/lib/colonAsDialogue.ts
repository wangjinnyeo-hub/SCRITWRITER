import type { Character } from '@/types/sw'

const COLON_PATTERNS = [' : ', ' :', ':'] as const

export interface ColonParseResult {
  bestPos: number
  bestChar: Character
  bestPattern: string
  dialogueLabel?: string
}

/**
 * 콜론-as-대사 패턴 파싱. "캐릭터이름 : 대사" 또는 "이름 : 대사"(엑스트라)를 감지한다.
 * @returns 파싱 결과 또는 null (패턴 없음)
 */
export function parseColonPattern(
  content: string,
  characters: Character[]
): ColonParseResult | null {
  let bestPos = -1
  let bestChar: Character | null = null
  let bestPattern = ''
  let dialogueLabel: string | undefined

  for (const char of characters) {
    const namePart = char.name.trim()
    if (!namePart) continue
    for (const suffix of COLON_PATTERNS) {
      const pattern = namePart + suffix
      const pos = content.indexOf(pattern)
      if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
        bestPos = pos
        bestChar = char
        bestPattern = pattern
        dialogueLabel = undefined
      }
    }
  }

  if (bestChar == null) {
    for (const sep of COLON_PATTERNS) {
      const colonIdx = content.indexOf(sep)
      if (colonIdx !== -1) {
        const lineStart = content.lastIndexOf('\n', colonIdx - 1) + 1
        let namePart = content.substring(lineStart, colonIdx).trim()
        if (namePart.includes(' ')) namePart = namePart.substring(namePart.lastIndexOf(' ') + 1)
        if (sep === ':' && /^\d+$/.test(namePart)) continue
        const extra = characters.find(c => c.name === '엑스트라')
        if (namePart && extra) {
          bestPos = lineStart
          bestChar = extra
          bestPattern = content.substring(lineStart, colonIdx) + sep
          dialogueLabel = namePart
          break
        }
      }
    }
  }

  if (bestChar == null) return null

  return {
    bestPos,
    bestChar,
    bestPattern,
    dialogueLabel,
  }
}
