import { create } from 'zustand'
import type { ScriptPropertyType } from '@/types'

export interface ScriptUnitClipboardItem {
  type: ScriptPropertyType
  characterId?: string
  /** 엑스트라 대사일 때 표시 이름 */
  dialogueLabel?: string
  content: string
}

interface InlineFormat {
  bold: boolean
  italic: boolean
  underline: boolean
}

interface EditorState {
  currentPropertyType: ScriptPropertyType
  currentCharacterId: string | null
  inlineFormat: InlineFormat
  /** 시나리오 유닛 복사/잘라내기 시 유형·캐릭터·내용 포함 */
  scriptUnitClipboard: ScriptUnitClipboardItem[] | null

  setPropertyType: (type: ScriptPropertyType) => void
  setCurrentCharacter: (id: string | null) => void
  setInlineFormat: (format: Partial<InlineFormat>) => void
  setScriptUnitClipboard: (data: ScriptUnitClipboardItem[] | null) => void
  toggleBold: () => void
  toggleItalic: () => void
  toggleUnderline: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  currentPropertyType: 'action',
  currentCharacterId: null,
  inlineFormat: { bold: false, italic: false, underline: false },
  scriptUnitClipboard: null,

  setPropertyType: (type) => set({ currentPropertyType: type }),
  setCurrentCharacter: (id) => set({ currentCharacterId: id }),
  setInlineFormat: (format) => set((state) => ({
    inlineFormat: { ...state.inlineFormat, ...format },
  })),
  setScriptUnitClipboard: (data) => set({ scriptUnitClipboard: data }),
  toggleBold: () => set((state) => ({
    inlineFormat: { ...state.inlineFormat, bold: !state.inlineFormat.bold },
  })),
  toggleItalic: () => set((state) => ({
    inlineFormat: { ...state.inlineFormat, italic: !state.inlineFormat.italic },
  })),
  toggleUnderline: () => set((state) => ({
    inlineFormat: { ...state.inlineFormat, underline: !state.inlineFormat.underline },
  })),
}))
