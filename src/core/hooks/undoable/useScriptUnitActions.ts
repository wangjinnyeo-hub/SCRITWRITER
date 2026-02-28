import { useProjectStore } from '@/store/project/projectStore'
import { useHistoryStore } from '@/store/history/historyStore'
import type { ScriptUnit } from '@/types'
import { generateId } from '@/domain/model'
import { restoreFile } from './restoreFile'

export function useScriptUnitActions() {
  const executeCommand = useHistoryStore(state => state.executeCommand)
  const projectStore = useProjectStore()

  const addScriptUnitUndoable = (
    episodeId: string, plotBoxId: string, type?: ScriptUnit['type'], characterId?: string
  ): string => {
    const file = projectStore.file
    if (!file) return ''
    const newId = generateId()
    executeCommand({
      description: `스크립트 추가: ${type || 'action'}`,
      execute: () => projectStore.addScriptUnit(episodeId, plotBoxId, type, characterId, newId),
      undo: () => projectStore.removeScriptUnit(episodeId, plotBoxId, newId),
    })
    return newId
  }

  const insertScriptUnitAfterUndoable = (
    episodeId: string, plotBoxId: string, afterUnitId: string, type?: ScriptUnit['type'], characterId?: string, preId?: string, initialContent?: string
  ): string => {
    const newId = preId || generateId()
    executeCommand({
      description: `스크립트 삽입: ${type || 'action'}`,
      execute: () => projectStore.insertScriptUnitAfter(episodeId, plotBoxId, afterUnitId, type, characterId, newId, initialContent),
      undo: () => projectStore.removeScriptUnit(episodeId, plotBoxId, newId),
    })
    return newId
  }

  const insertScriptUnitBeforeUndoable = (
    episodeId: string, plotBoxId: string, beforeUnitId: string, type?: ScriptUnit['type'], characterId?: string
  ): string => {
    const newId = generateId()
    executeCommand({
      description: `스크립트 삽입(앞): ${type || 'action'}`,
      execute: () => projectStore.insertScriptUnitBefore(episodeId, plotBoxId, beforeUnitId, type, characterId, newId),
      undo: () => projectStore.removeScriptUnit(episodeId, plotBoxId, newId),
    })
    return newId
  }

  const mergeScriptUnitsUndoable = (episodeId: string, plotBoxId: string, targetUnitId: string, sourceUnitId: string) => {
    const file = projectStore.file
    if (!file) return
    const episode = file.episodes.find(e => e.id === episodeId)
    const plot = episode?.plotBoxes.find(p => p.id === plotBoxId)
    if (!plot) return
    const target = plot.scriptUnits.find(s => s.id === targetUnitId)
    const source = plot.scriptUnits.find(s => s.id === sourceUnitId)
    if (!target || !source) return
    const sorted = [...plot.scriptUnits].sort((a, b) => a.order - b.order)
    const snapshot = sorted.map((s, i) => ({ ...s, order: i }))
    executeCommand({
      description: '스크립트 단락 합치기',
      execute: () => projectStore.mergeScriptUnits(episodeId, plotBoxId, targetUnitId, sourceUnitId),
      undo: () => restoreFile(f => ({
        ...f,
        episodes: f.episodes.map(e => e.id !== episodeId ? e : {
          ...e,
          plotBoxes: e.plotBoxes.map(p => p.id !== plotBoxId ? p : { ...p, scriptUnits: snapshot }),
        }),
        project: { ...f.project, updatedAt: Date.now() },
      })),
    })
  }

  const reorderScriptUnitsUndoable = (episodeId: string, plotBoxId: string, oldIndex: number, newIndex: number) => {
    const file = projectStore.file
    if (!file || oldIndex === newIndex) return
    const episode = file.episodes.find(e => e.id === episodeId)
    const plot = episode?.plotBoxes.find(p => p.id === plotBoxId)
    if (!plot) return
    const snapshot = [...plot.scriptUnits].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i }))
    executeCommand({
      description: '스크립트 순서 변경',
      execute: () => projectStore.reorderScriptUnits(episodeId, plotBoxId, oldIndex, newIndex),
      undo: () => restoreFile(f => ({
        ...f,
        episodes: f.episodes.map(e => e.id !== episodeId ? e : {
          ...e,
          plotBoxes: e.plotBoxes.map(p => p.id !== plotBoxId ? p : { ...p, scriptUnits: snapshot }),
        }),
        project: { ...f.project, updatedAt: Date.now() },
      })),
    })
  }

  const removeScriptUnitUndoable = (episodeId: string, plotBoxId: string, unitId: string) => {
    const file = projectStore.file
    if (!file) return
    let snap: ScriptUnit | null = null, snapIdx = -1
    for (const e of file.episodes) {
      if (e.id !== episodeId) continue
      for (const p of e.plotBoxes) {
        if (p.id !== plotBoxId) continue
        snapIdx = p.scriptUnits.findIndex(u => u.id === unitId)
        if (snapIdx !== -1) snap = { ...p.scriptUnits[snapIdx] }
      }
    }
    if (!snap) return
    const unitSnap = snap, idxSnap = snapIdx
    executeCommand({
      description: '스크립트 삭제',
      execute: () => projectStore.removeScriptUnit(episodeId, plotBoxId, unitId),
      undo: () => restoreFile(f => ({
        ...f,
        episodes: f.episodes.map(e => e.id !== episodeId ? e : {
          ...e, plotBoxes: e.plotBoxes.map(p => {
            if (p.id !== plotBoxId) return p
            const units = [...p.scriptUnits]; units.splice(idxSnap, 0, unitSnap)
            return { ...p, scriptUnits: units.map((u, i) => ({ ...u, order: i })) }
          })
        }),
        project: { ...f.project, updatedAt: Date.now() }
      })),
    })
  }

  const moveScriptUnitsToPlotBoxUndoable = (
    episodeId: string, fromPlotId: string, toPlotId: string, unitIds: string[], insertIndex?: number
  ) => {
    const file = projectStore.file
    if (!file || unitIds.length === 0 || fromPlotId === toPlotId) return
    const episode = file.episodes.find(e => e.id === episodeId)
    const fromBox = episode?.plotBoxes.find(p => p.id === fromPlotId)
    const toBox = episode?.plotBoxes.find(p => p.id === toPlotId)
    if (!episode || !fromBox || !toBox) return
    const fromSnapshot = fromBox.scriptUnits.map(s => ({ ...s }))
    const toSnapshot = toBox.scriptUnits.map(s => ({ ...s }))
    executeCommand({
      description: '스크립트를 플롯으로 이동',
      execute: () => projectStore.moveScriptUnitsToPlotBox(episodeId, fromPlotId, toPlotId, unitIds, insertIndex),
      undo: () => restoreFile(f => ({
        ...f,
        episodes: f.episodes.map(e => e.id !== episodeId ? e : {
          ...e,
          plotBoxes: e.plotBoxes.map(p => {
            if (p.id === fromPlotId) return { ...p, scriptUnits: fromSnapshot.map((s, i) => ({ ...s, order: i })) }
            if (p.id === toPlotId) return { ...p, scriptUnits: toSnapshot.map((s, i) => ({ ...s, order: i })) }
            return p
          }),
        }),
        project: { ...f.project, updatedAt: Date.now() }
      })),
    })
  }

  const moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable = (
    episodeId: string, toPlotId: string, insertIndex: number | undefined, groups: { fromPlotId: string; unitIds: string[] }[]
  ) => {
    const file = projectStore.file
    if (!file || groups.length === 0 || groups.every(g => g.unitIds.length === 0)) return
    const episode = file.episodes.find(e => e.id === episodeId)
    if (!episode) return
    const affectedPlotIds = new Set<string>([toPlotId, ...groups.map(g => g.fromPlotId)])
    const snapshots = new Map<string, { scriptUnits: typeof episode.plotBoxes[0]['scriptUnits'] }>()
    for (const p of episode.plotBoxes) {
      if (affectedPlotIds.has(p.id)) snapshots.set(p.id, { scriptUnits: p.scriptUnits.map(s => ({ ...s })) })
    }
    executeCommand({
      description: '스크립트를 플롯으로 이동',
      execute: () => projectStore.moveScriptUnitsFromMultiplePlotsToPlotBox(episodeId, toPlotId, insertIndex, groups),
      undo: () => restoreFile(f => ({
        ...f,
        episodes: f.episodes.map(e => e.id !== episodeId ? e : {
          ...e,
          plotBoxes: e.plotBoxes.map(p => {
            const snap = snapshots.get(p.id)
            if (snap) return { ...p, scriptUnits: snap.scriptUnits.map((s, i) => ({ ...s, order: i })) }
            return p
          }),
        }),
        project: { ...f.project, updatedAt: Date.now() }
      })),
    })
  }

  const moveScriptUnitsByIdsUndoable = (
    episodeId: string, plotBoxId: string, unitIds: string[], toIndex: number
  ) => {
    const file = projectStore.file
    if (!file || unitIds.length === 0) return
    const episode = file.episodes.find(e => e.id === episodeId)
    const plot = episode?.plotBoxes.find(p => p.id === plotBoxId)
    if (!plot) return
    const snapshot = [...plot.scriptUnits].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i }))
    executeCommand({
      description: '스크립트 이동',
      execute: () => projectStore.moveScriptUnitsByIds(episodeId, plotBoxId, unitIds, toIndex),
      undo: () => restoreFile(f => ({
        ...f,
        episodes: f.episodes.map(e => e.id !== episodeId ? e : {
          ...e,
          plotBoxes: e.plotBoxes.map(p => p.id !== plotBoxId ? p : { ...p, scriptUnits: snapshot }),
        }),
        project: { ...f.project, updatedAt: Date.now() }
      })),
    })
  }

  const reorderScriptUnitGroupUndoable = (
    episodeId: string, plotBoxId: string, fromStartIndex: number, fromCount: number, toIndex: number
  ) => {
    const file = projectStore.file
    if (!file) return
    const episode = file.episodes.find(e => e.id === episodeId)
    const plot = episode?.plotBoxes.find(p => p.id === plotBoxId)
    if (!plot) return
    const sorted = [...plot.scriptUnits].sort((a, b) => a.order - b.order)
    const snapshot = sorted.map((s, i) => ({ ...s, order: i }))
    executeCommand({
      description: '대사 그룹 이동',
      execute: () => projectStore.reorderScriptUnitGroup(episodeId, plotBoxId, fromStartIndex, fromCount, toIndex),
      undo: () => restoreFile(f => ({
        ...f,
        episodes: f.episodes.map(e => e.id !== episodeId ? e : {
          ...e,
          plotBoxes: e.plotBoxes.map(p => p.id !== plotBoxId ? p : { ...p, scriptUnits: snapshot }),
        }),
        project: { ...f.project, updatedAt: Date.now() }
      })),
    })
  }

  const updateScriptUnitUndoable = (episodeId: string, plotBoxId: string, unitId: string, updates: Partial<ScriptUnit>) => {
    const file = projectStore.file
    if (!file || Object.keys(updates).length === 0) return
    let snap: ScriptUnit | null = null
    for (const e of file.episodes) {
      if (e.id !== episodeId) continue
      const p = e.plotBoxes.find(b => b.id === plotBoxId)
      if (!p) continue
      const u = p.scriptUnits.find(x => x.id === unitId)
      if (u) snap = { ...u }
      break
    }
    if (!snap) return
    const prev = { ...snap }
    executeCommand({
      description: '스크립트 편집',
      execute: () => projectStore.updateScriptUnit(episodeId, plotBoxId, unitId, updates),
      undo: () => projectStore.updateScriptUnit(episodeId, plotBoxId, unitId, prev),
    })
  }

  return {
    addScriptUnitUndoable,
    insertScriptUnitAfterUndoable,
    insertScriptUnitBeforeUndoable,
    mergeScriptUnitsUndoable,
    reorderScriptUnitsUndoable,
    removeScriptUnitUndoable,
    moveScriptUnitsToPlotBoxUndoable,
    moveScriptUnitsFromMultiplePlotsToPlotBoxUndoable,
    moveScriptUnitsByIdsUndoable,
    reorderScriptUnitGroupUndoable,
    updateScriptUnitUndoable,
  }
}
