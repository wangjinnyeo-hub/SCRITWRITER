import type { Character, PlotBox, ScriptPropertyType } from '@/types'

export type FilterableScriptType = ScriptPropertyType
export type ScriptTypeFilter = FilterableScriptType | 'all'

export interface ExportIncludeOptions {
  dialogue: boolean
  action: boolean
  narration: boolean
  background: boolean
  direction: boolean
  characterName: boolean
  plotBoxTitle: boolean
  episodeTitle: boolean
  projectTitle: boolean
  plotBoxSeparator?: boolean
  /** 대사 좌측선(캐릭터 색상 바) 표시 여부 */
  dialogueLine?: boolean
  /** 플롯박스 내 플롯 내용(메모) 표시 여부 */
  plotBoxContent?: boolean
}

export interface ScriptEngineContext {
  plotBoxes: PlotBox[]
  characters: Character[]
  projectTitle?: string
  episodeTitle?: string
  selectedPlotIds?: Set<string>
  selectedTypes?: Set<ScriptTypeFilter>
  include?: ExportIncludeOptions
}

