import type { PlotBox, ScriptUnit } from '@/types'
import type { ExportIncludeOptions, FilterableScriptType, ScriptTypeFilter } from './types'

export const ALL_FILTERABLE_TYPES: FilterableScriptType[] = [
  'dialogue',
  'action',
  'narration',
  'background',
  'direction',
  'character',
]

export const DEFAULT_EXPORT_INCLUDE: ExportIncludeOptions = {
  dialogue: true,
  action: true,
  narration: true,
  background: true,
  direction: true,
  characterName: true,
}

export function normalizeTypeFilter(selectedTypes?: Set<ScriptTypeFilter>): Set<ScriptTypeFilter> {
  if (!selectedTypes || selectedTypes.size === 0) return new Set<ScriptTypeFilter>(['all'])
  return selectedTypes
}

export function toIncludeOptions(selectedTypes?: Set<ScriptTypeFilter>): ExportIncludeOptions {
  const normalized = normalizeTypeFilter(selectedTypes)
  if (normalized.has('all')) {
    return { ...DEFAULT_EXPORT_INCLUDE }
  }
  return {
    dialogue: normalized.has('dialogue'),
    action: normalized.has('action'),
    narration: normalized.has('narration'),
    background: normalized.has('background'),
    direction: normalized.has('direction'),
    characterName: normalized.has('character'),
  }
}

export function filterPlotsById(plotBoxes: PlotBox[], selectedPlotIds?: Set<string>): PlotBox[] {
  if (!selectedPlotIds) return plotBoxes
  if (selectedPlotIds.size === 0) return []
  return plotBoxes.filter(box => selectedPlotIds.has(box.id))
}

export function getSortedUnits(plotBox: PlotBox): ScriptUnit[] {
  return [...plotBox.scriptUnits].sort((a, b) => a.order - b.order)
}

export function createUnitFilterFromTypeFilter(selectedTypes?: Set<ScriptTypeFilter>) {
  const normalized = normalizeTypeFilter(selectedTypes)
  return (unit: ScriptUnit): boolean => {
    return normalized.has('all') || normalized.has(unit.type as FilterableScriptType)
  }
}

export function createUnitFilterFromInclude(include: ExportIncludeOptions) {
  return (unit: ScriptUnit): boolean => {
    if (unit.type === 'character') return include.characterName
    return Boolean((include as unknown as Record<string, boolean>)[unit.type])
  }
}

