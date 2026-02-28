import type { PlotBox, ScriptUnit } from '@/types'
import { generateId, generatePlotBoxOrder, generateScriptUnitOrder } from './ids'

export function mergePlotBoxes(
  plotBoxes: PlotBox[],
  targetIndex: number,
  sourceIndex: number
): PlotBox[] {
  if (targetIndex < 0 || sourceIndex < 0) return plotBoxes
  if (targetIndex >= plotBoxes.length || sourceIndex >= plotBoxes.length) return plotBoxes
  if (targetIndex === sourceIndex) return plotBoxes

  const sorted = [...plotBoxes].sort((a, b) => a.order - b.order)
  const target = sorted[targetIndex]
  const source = sorted[sourceIndex]

  const mergedScriptUnits = [
    ...target.scriptUnits,
    ...source.scriptUnits.map((s, i) => ({
      ...s,
      order: target.scriptUnits.length + i
    }))
  ]

  const mergedBox: PlotBox = {
    ...target,
    content: target.content + '\n' + source.content,
    scriptUnits: mergedScriptUnits
  }

  const result = sorted.filter((_, i) => i !== sourceIndex)
  result[targetIndex] = mergedBox

  return result.map((box, i) => ({ ...box, order: i }))
}

export function splitPlotBox(
  plotBoxes: PlotBox[],
  boxIndex: number,
  splitAtUnitIndex: number
): { plotBoxes: PlotBox[]; newPlotBoxId: string } {
  const sorted = [...plotBoxes].sort((a, b) => a.order - b.order)
  if (boxIndex < 0 || boxIndex >= sorted.length) {
    return { plotBoxes, newPlotBoxId: '' }
  }

  const boxToSplit = sorted[boxIndex]
  if (splitAtUnitIndex < 0 || splitAtUnitIndex >= boxToSplit.scriptUnits.length) {
    return { plotBoxes, newPlotBoxId: '' }
  }

  const sortedUnits = [...boxToSplit.scriptUnits].sort((a, b) => a.order - b.order)
  const firstHalf = sortedUnits.slice(0, splitAtUnitIndex)
  const secondHalf = sortedUnits.slice(splitAtUnitIndex)

  const newBox1: PlotBox = {
    ...boxToSplit,
    scriptUnits: firstHalf.map((u, i) => ({ ...u, order: i }))
  }

  const newBox2: PlotBox = {
    id: generateId(),
    order: boxToSplit.order + 1,
    content: '',
    scriptUnits: secondHalf.map((u, i) => ({ ...u, order: i }))
  }

  const result: PlotBox[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i === boxIndex) {
      result.push(newBox1)
      result.push(newBox2)
    } else {
      result.push(sorted[i])
    }
  }

  return {
    plotBoxes: result.map((box, i) => ({ ...box, order: i })),
    newPlotBoxId: newBox2.id,
  }
}

export function splitPlotBoxByContent(
  plotBoxes: PlotBox[],
  boxIndex: number,
  cursorPosition: number
): PlotBox[] {
  const sorted = [...plotBoxes].sort((a, b) => a.order - b.order)
  if (boxIndex < 0 || boxIndex >= sorted.length) return plotBoxes

  const boxToSplit = sorted[boxIndex]
  const content = boxToSplit.content

  const firstContent = content.slice(0, cursorPosition)
  const secondContent = content.slice(cursorPosition)

  const newBox1: PlotBox = {
    ...boxToSplit,
    content: firstContent.trimEnd(),
  }

  const newBox2: PlotBox = {
    id: generateId(),
    order: boxToSplit.order + 1,
    content: secondContent.trimStart(),
    scriptUnits: []
  }

  const result: PlotBox[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i === boxIndex) {
      result.push(newBox1)
      result.push(newBox2)
    } else {
      result.push(sorted[i])
    }
  }

  return result.map((box, i) => ({ ...box, order: i }))
}

export function reorderPlotBoxes(
  plotBoxes: PlotBox[],
  fromIndex: number,
  toIndex: number
): PlotBox[] {
  const sorted = [...plotBoxes].sort((a, b) => a.order - b.order)
  const [moved] = sorted.splice(fromIndex, 1)
  sorted.splice(toIndex, 0, moved)
  return sorted.map((box, i) => ({ ...box, order: i }))
}

/** 선택한 플롯 박스들을 가장 상단(order 최소) 박스 하나로 합침. 내용·스크립트는 순서대로 이어붙임. 반환 배열에서 나머지 선택 박스는 제거됨. */
export function mergeSelectedPlotBoxes(plotBoxes: PlotBox[], selectedIds: string[]): PlotBox[] {
  const sorted = [...plotBoxes].sort((a, b) => a.order - b.order)
  const idSet = new Set(selectedIds)
  const toMerge = sorted.filter(p => idSet.has(p.id))
  if (toMerge.length <= 1) return plotBoxes

  const target = toMerge[0]
  const rest = toMerge.slice(1)
  const mergedContent = [target.content, ...rest.map(b => b.content)].filter(Boolean).join('\n')
  let order = 0
  const mergedUnits = [
    ...target.scriptUnits.map(s => ({ ...s, order: order++ })),
    ...rest.flatMap(b => b.scriptUnits.map(s => ({ ...s, order: order++ }))),
  ]
  const mergedBox: PlotBox = {
    ...target,
    content: mergedContent,
    scriptUnits: mergedUnits,
  }
  const restIds = new Set(rest.map(b => b.id))
  const result = sorted.filter(p => !restIds.has(p.id)).map(p => (p.id === target.id ? mergedBox : p))
  return result.map((box, i) => ({ ...box, order: i }))
}

export function createPlotBox(plotBoxes: PlotBox[]): PlotBox {
  return {
    id: generateId(),
    order: generatePlotBoxOrder(plotBoxes),
    content: '',
    scriptUnits: []
  }
}

/** Insert a new empty plot box at the given index. Returns updated array and the new box id. */
export function insertPlotBoxAt(plotBoxes: PlotBox[], index: number): { plotBoxes: PlotBox[]; newId: string } {
  const sorted = [...plotBoxes].sort((a, b) => a.order - b.order)
  const newBox = createPlotBox(sorted)
  const clamped = Math.max(0, Math.min(index, sorted.length))
  sorted.splice(clamped, 0, { ...newBox, order: clamped })
  const result = sorted.map((box, i) => ({ ...box, order: i }))
  return { plotBoxes: result, newId: newBox.id }
}

export function createScriptUnit(
  scriptUnits: ScriptUnit[],
  type: ScriptUnit['type'] = 'action',
  characterId?: string
): ScriptUnit {
  return {
    id: generateId(),
    order: generateScriptUnitOrder(scriptUnits),
    type,
    characterId,
    content: ''
  }
}
