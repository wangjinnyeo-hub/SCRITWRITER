import { describe, it, expect } from 'vitest'
import { parseColonPattern } from './colonAsDialogue'
import type { Character } from '@/types/sw'

const characters: Character[] = [
  { id: 'c1', name: '홍길동', color: '#111', shortcut: 1, visible: true },
  { id: 'c2', name: '엑스트라', color: '#222', shortcut: 2, visible: true },
]

describe('parseColonPattern', () => {
  it('returns null when no colon pattern found', () => {
    expect(parseColonPattern('지문입니다.', characters)).toBeNull()
  })

  it('parses "이름 : " pattern with known character', () => {
    const result = parseColonPattern('홍길동 : 대사 내용', characters)
    expect(result).not.toBeNull()
    expect(result!.bestChar.name).toBe('홍길동')
    expect(result!.bestPattern).toBe('홍길동 : ')
    expect(result!.bestPos).toBe(0)
  })

  it('parses "이름 :" pattern', () => {
    const result = parseColonPattern('홍길동:대사', characters)
    expect(result).not.toBeNull()
    expect(result!.bestChar.name).toBe('홍길동')
  })

  it('parses 엑스트라 with dialogueLabel when unknown name precedes colon', () => {
    const result = parseColonPattern('소년 : 안녕하세요', characters)
    expect(result).not.toBeNull()
    expect(result!.bestChar.name).toBe('엑스트라')
    expect(result!.dialogueLabel).toBe('소년')
  })

  it('returns earliest match when multiple patterns', () => {
    const result = parseColonPattern('앞 내용 홍길동 : 대사', characters)
    expect(result).not.toBeNull()
    expect(result!.bestChar.name).toBe('홍길동')
    expect(result!.bestPos).toBe(5) // '홍길동 : ' starts at index 5 ('앞 내용 ' = 5 chars)
  })

  it('skips numeric-only name with lone colon', () => {
    const result = parseColonPattern('123: 내용', characters)
    // 숫자만 있는 경우 엑스트라로 매칭하지 않음
    expect(result).toBeNull()
  })
})
