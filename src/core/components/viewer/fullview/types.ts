import type { ScriptPropertyType, PlotBox, Character, Episode, ScriptUnit } from '@/types'
import type { ScriptTypeFilter } from '@/lib/scriptEngine/types'
export type { ScriptTypeFilter } from '@/lib/scriptEngine/types'

export interface FormatProps {
  plots: PlotBox[]
  allPlots: PlotBox[]
  characters: Character[]
  filterUnit: (unit: ScriptUnit) => boolean
  getPropertyStyle: (type: ScriptPropertyType) => Record<string, string | undefined>
  getCharacterName: (id?: string, dialogueLabel?: string) => string
  getCharacterColor: (id?: string) => string
  /** 전체보기 미리보기에서 캐릭터 이름(라벨) 표시 여부 */
  hideCharacterName?: boolean
  dialogueParagraphGap: number
  /** 대사 타이핑 영역 표시 너비 (전체보기에서도 동일 적용) */
  dialogueTypingMaxWidth?: string
  unitDivider: 'none' | 'line' | 'dot'
  dialogueColorMode: 'character' | 'black' | 'custom'
  dialogueCustomColor: string
  /** 플롯·제목 등 스크립트 외 기본 서체 */
  defaultFontFamily?: string
  /** 플롯박스 제목(P1, 제목) 표시 여부 */
  includePlotTitle?: boolean
  /** 플롯 박스 간 구분선 표시 여부 */
  includePlotBoxSeparator?: boolean
  /** 대사 좌측선(캐릭터 색상 바) 표시 여부 */
  includeDialogueLine?: boolean
  /** 플롯박스 내 플롯 내용(메모) 표시 여부 */
  includePlotBoxContent?: boolean
}

export interface EpisodeFormatProps extends FormatProps {
  episode: Episode | undefined
}
