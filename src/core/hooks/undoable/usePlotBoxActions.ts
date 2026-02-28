import { useProjectStore } from '@/store/project/projectStore'
import { useHistoryStore } from '@/store/history/historyStore'
import type { PlotBox } from '@/types'
import { generateId } from '@/domain/model'
import { restoreFile } from './restoreFile'

export function usePlotBoxActions() {
  const executeCommand = useHistoryStore(state => state.executeCommand)
  const projectStore = useProjectStore()

  const addPlotBoxUndoable = (episodeId: string) => {
    const plotBoxId = generateId()
    executeCommand({
      description: '플롯 박스 추가',
      execute: () => projectStore.addPlotBox(episodeId),
      undo: () => projectStore.removePlotBox(episodeId, plotBoxId),
    })
  }

  const insertPlotBoxAtUndoable = (episodeId: string, index: number): string => {
    let newId = ''
    executeCommand({
      description: '플롯 앞에 추가',
      execute: () => { newId = projectStore.insertPlotBoxAt(episodeId, index); return newId },
      undo: () => projectStore.removePlotBox(episodeId, newId),
    })
    return newId
  }

  const removePlotBoxUndoable = (episodeId: string, plotBoxId: string) => {
    const file = projectStore.file
    if (!file) return
    let snap: PlotBox | null = null, snapIdx = -1
    for (const e of file.episodes) {
      if (e.id !== episodeId) continue
      snapIdx = e.plotBoxes.findIndex(p => p.id === plotBoxId)
      if (snapIdx !== -1) snap = { ...e.plotBoxes[snapIdx] }
    }
    if (!snap) return
    const boxSnap = snap, idxSnap = snapIdx
    executeCommand({
      description: '플롯 박스 삭제',
      execute: () => projectStore.removePlotBox(episodeId, plotBoxId),
      undo: () => restoreFile(f => ({
        ...f,
        episodes: f.episodes.map(e => {
          if (e.id !== episodeId) return e
          const boxes = [...e.plotBoxes]; boxes.splice(idxSnap, 0, boxSnap)
          return { ...e, plotBoxes: boxes.map((p, i) => ({ ...p, order: i })) }
        }),
        project: { ...f.project, updatedAt: Date.now() }
      })),
    })
  }

  const mergeSelectedPlotBoxesUndoable = (episodeId: string, selectedIds: string[]) => {
    const file = projectStore.file
    if (!file || selectedIds.length < 2) return
    const episode = file.episodes.find(e => e.id === episodeId)
    if (!episode) return
    const plotBoxesSnap = episode.plotBoxes.map(p => ({
      ...p,
      scriptUnits: p.scriptUnits.map(u => ({ ...u })),
    }))
    executeCommand({
      description: '선택 합치기',
      execute: () => projectStore.mergeSelectedPlotBoxes(episodeId, selectedIds),
      undo: () => restoreFile(f => ({
        ...f,
        episodes: f.episodes.map(e =>
          e.id === episodeId ? { ...e, plotBoxes: plotBoxesSnap } : e
        ),
        project: { ...f.project, updatedAt: Date.now() }
      })),
    })
  }

  const splitPlotBoxUndoable = (episodeId: string, boxIndex: number, splitAtUnitIndex: number): string | undefined => {
    const file = projectStore.file
    if (!file) return undefined
    const episode = file.episodes.find(e => e.id === episodeId)
    if (!episode || boxIndex < 0 || boxIndex >= episode.plotBoxes.length) return undefined
    const plotBoxesSnap = episode.plotBoxes.map(p => ({
      ...p,
      scriptUnits: p.scriptUnits.map(u => ({ ...u })),
    }))
    let newPlotBoxId: string | undefined
    executeCommand({
      description: '플롯 분할',
      execute: () => {
        newPlotBoxId = projectStore.splitPlotBox(episodeId, boxIndex, splitAtUnitIndex)
        return newPlotBoxId
      },
      undo: () => restoreFile(f => ({
        ...f,
        episodes: f.episodes.map(e =>
          e.id === episodeId ? { ...e, plotBoxes: plotBoxesSnap } : e
        ),
        project: { ...f.project, updatedAt: Date.now() }
      })),
    })
    return newPlotBoxId
  }

  const splitPlotBoxByContentUndoable = (episodeId: string, boxIndex: number, cursorPosition: number) => {
    const file = projectStore.file
    if (!file) return
    const episode = file.episodes.find(e => e.id === episodeId)
    if (!episode || boxIndex < 0 || boxIndex >= episode.plotBoxes.length) return
    const plotBoxesSnap = episode.plotBoxes.map(p => ({
      ...p,
      scriptUnits: p.scriptUnits.map(u => ({ ...u })),
    }))
    executeCommand({
      description: '플롯 분할',
      execute: () => projectStore.splitPlotBoxByContent(episodeId, boxIndex, cursorPosition),
      undo: () => restoreFile(f => ({
        ...f,
        episodes: f.episodes.map(e =>
          e.id === episodeId ? { ...e, plotBoxes: plotBoxesSnap } : e
        ),
        project: { ...f.project, updatedAt: Date.now() }
      })),
    })
  }

  const insertPlotContentAtScenarioUndoable = (episodeId: string, sourcePlotId: string, targetPlotId: string, targetIndex: number) => {
    const file = projectStore.file
    if (!file || sourcePlotId === targetPlotId) return
    const episode = file.episodes.find(e => e.id === episodeId)
    const source = episode?.plotBoxes.find(p => p.id === sourcePlotId)
    const target = episode?.plotBoxes.find(p => p.id === targetPlotId)
    if (!episode || !source || !target) return
    const sourceSnapshot = { content: source.content, scriptUnits: source.scriptUnits.map(u => ({ ...u })) }
    const targetSnapshot = target.scriptUnits.map(u => ({ ...u }))
    executeCommand({
      description: '플롯 내용을 시나리오에 삽입',
      execute: () => projectStore.insertPlotContentAtScenario(episodeId, sourcePlotId, targetPlotId, targetIndex),
      undo: () => restoreFile(f => ({
        ...f,
        episodes: f.episodes.map(e => {
          if (e.id !== episodeId) return e
          return {
            ...e,
            plotBoxes: e.plotBoxes.map(p => {
              if (p.id === sourcePlotId) return { ...p, content: sourceSnapshot.content, scriptUnits: sourceSnapshot.scriptUnits }
              if (p.id === targetPlotId) return { ...p, scriptUnits: targetSnapshot }
              return p
            }),
          }
        }),
        project: { ...f.project, updatedAt: Date.now() }
      })),
    })
  }

  const updatePlotBoxUndoable = (episodeId: string, plotBoxId: string, updates: Partial<PlotBox>) => {
    const file = projectStore.file
    if (!file || Object.keys(updates).length === 0) return
    const ep = file.episodes.find(e => e.id === episodeId)
    const box = ep?.plotBoxes.find(p => p.id === plotBoxId)
    if (!box) return
    const prev = { ...box }
    executeCommand({
      description: '플롯 편집',
      execute: () => projectStore.updatePlotBox(episodeId, plotBoxId, updates),
      undo: () => projectStore.updatePlotBox(episodeId, plotBoxId, prev),
    })
  }

  const reorderPlotBoxesUndoable = (episodeId: string, fromIndex: number, toIndex: number) => {
    const file = projectStore.file
    if (!file || fromIndex === toIndex) return
    const ep = file.episodes.find(e => e.id === episodeId)
    if (!ep) return
    const plotBoxesSnapshot = ep.plotBoxes.map(p => ({ ...p }))
    executeCommand({
      description: '플롯 순서 변경',
      execute: () => projectStore.reorderPlotBoxes(episodeId, fromIndex, toIndex),
      undo: () => restoreFile(f => {
        const episode = f.episodes.find(e => e.id === episodeId)
        if (!episode) return f
        return {
          ...f,
          episodes: f.episodes.map(e => e.id !== episodeId ? e : { ...e, plotBoxes: plotBoxesSnapshot }),
          project: { ...f.project, updatedAt: Date.now() }
        }
      }),
    })
  }

  return {
    addPlotBoxUndoable,
    insertPlotBoxAtUndoable,
    removePlotBoxUndoable,
    mergeSelectedPlotBoxesUndoable,
    splitPlotBoxUndoable,
    splitPlotBoxByContentUndoable,
    insertPlotContentAtScenarioUndoable,
    updatePlotBoxUndoable,
    reorderPlotBoxesUndoable,
  }
}
