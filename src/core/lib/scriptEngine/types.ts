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
}

export interface ScriptEngineContext {
  plotBoxes: PlotBox[]
  characters: Character[]
  selectedPlotIds?: Set<string>
  selectedTypes?: Set<ScriptTypeFilter>
  include?: ExportIncludeOptions
}

