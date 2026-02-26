import type { PropertyStyle, ScriptPropertyType } from '@/types'

export interface ScriptStylesContext {
  propertyStyles: Record<ScriptPropertyType, PropertyStyle>
  dialogueColorMode: 'black' | 'character' | 'custom'
  dialogueCustomColor: string
}

/**
 * 유형별 스타일 반환. fontFamily가 비어 있으면 defaultFontFamily를 씀(스크립트 서식 '기본' = 설정의 기본 서체).
 */
export function getPropertyStyle(
  propertyStyles: Record<ScriptPropertyType, PropertyStyle>,
  type: ScriptPropertyType,
  defaultFontFamily?: string
) {
  const style = propertyStyles[type] ?? {}
  return {
    color: style.color,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    textAlign: style.textAlign,
    fontFamily: style.fontFamily || defaultFontFamily,
    fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
  }
}

export function resolveDialogueTextColor(params: {
  dialogueColorMode: ScriptStylesContext['dialogueColorMode']
  dialogueCustomColor: string
  characterColor: string
}): string {
  const { dialogueColorMode, dialogueCustomColor, characterColor } = params
  if (dialogueColorMode === 'character') return characterColor
  if (dialogueColorMode === 'custom') return dialogueCustomColor
  return '#000'
}

const DIALOGUE_WIDTH_CH = { narrow: 20, medium: 32, wide: undefined } as const

/** 대사 타이핑 영역 maxWidth. 왼쪽 여백 유지, 오른쪽으로만 제한. wide면 제한 없음(undefined). */
export function getDialogueTypingMaxWidth(
  mode: 'narrow' | 'medium' | 'wide' | 'custom',
  customCh: number
): string | undefined {
  if (mode === 'wide') return undefined
  if (mode === 'custom') return `${customCh}ch`
  const ch = DIALOGUE_WIDTH_CH[mode]
  return ch != null ? `${ch}ch` : undefined
}

