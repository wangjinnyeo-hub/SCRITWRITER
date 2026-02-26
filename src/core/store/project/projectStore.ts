import { create } from 'zustand'
import type { SWFile, Episode, PlotBox, ScriptUnit, Character } from '@/types'
import { createEmptyProject, generateId } from '@/domain/model'
import { mergePlotBoxes, mergeSelectedPlotBoxes, splitPlotBox, splitPlotBoxByContent, reorderPlotBoxes, createPlotBox, createScriptUnit, insertPlotBoxAt as insertPlotBoxAtOps } from '@/domain/ops'
import { useHistoryStore } from '@/store/history/historyStore'
import { useUIStore } from '@/store/ui/uiStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { applyDefaultSettingsToStore } from '@/store/settings/defaultSettingsStore'
import { getNextBackgroundNumber, setBackgroundSeqNum, recomputeBackgroundNumbersInPlot, recomputeBackgroundNumbersForEpisode } from '@/lib/backgroundSeq'

function updateEpisode(file: SWFile, episodeId: string, transform: (e: Episode) => Episode): SWFile {
  return {
    ...file,
    episodes: file.episodes.map(e => e.id === episodeId ? transform(e) : e),
    project: { ...file.project, updatedAt: Date.now() }
  }
}

function updatePlotBox(file: SWFile, episodeId: string, plotBoxId: string, transform: (p: PlotBox) => PlotBox): SWFile {
  return updateEpisode(file, episodeId, e => ({
    ...e,
    plotBoxes: e.plotBoxes.map(p => p.id === plotBoxId ? transform(p) : p)
  }))
}

interface ProjectState {
  file: SWFile | null
  /** 데스크톱: 현재 연/저장한 파일 경로. null이면 "다른 이름으로 저장"으로 경로 선택. */
  filePath: string | null
  isDirty: boolean
  initProject: (title?: string) => void
  loadProject: (file: SWFile, path?: string) => void
  setFilePath: (path: string | null) => void
  updateProjectTitle: (title: string) => void
  updateProject: (updates: Partial<SWFile['project']>) => void
  addCharacter: (character: Omit<Character, 'id'>, preId?: string) => void
  updateCharacter: (id: string, updates: Partial<Character>) => void
  removeCharacter: (id: string) => void
  /** 캐릭터 순서 변경. 사용처: SidebarCharacters/CharacterManager 표시, Ctrl+1~9 단축키(배열 인덱스), ScriptUnit 캐릭터 드롭다운·화살표. Phase 5에서 DnD로 호출. */
  reorderCharacters: (fromIndex: number, toIndex: number) => void
  addEpisode: (subtitle?: string) => string | undefined
  updateEpisode: (id: string, updates: Partial<Episode>) => void
  removeEpisode: (id: string) => void
  reorderEpisodes: (fromIndex: number, toIndex: number) => void
  addPlotBox: (episodeId: string) => void
  insertPlotBoxAt: (episodeId: string, index: number) => string
  updatePlotBox: (episodeId: string, plotBoxId: string, updates: Partial<PlotBox>) => void
  removePlotBox: (episodeId: string, plotBoxId: string) => void
  mergePlotBoxes: (episodeId: string, targetIndex: number, sourceIndex: number) => void
  mergeSelectedPlotBoxes: (episodeId: string, selectedIds: string[]) => void
  splitPlotBox: (episodeId: string, boxIndex: number, splitAtUnitIndex: number) => string | undefined
  splitPlotBoxByContent: (episodeId: string, boxIndex: number, cursorPosition: number) => void
  reorderPlotBoxes: (episodeId: string, fromIndex: number, toIndex: number) => void
  addScriptUnit: (episodeId: string, plotBoxId: string, type?: ScriptUnit['type'], characterId?: string, preId?: string) => void
  insertScriptUnitAfter: (episodeId: string, plotBoxId: string, afterUnitId: string, type?: ScriptUnit['type'], characterId?: string, preId?: string, initialContent?: string) => string
  insertScriptUnitBefore: (episodeId: string, plotBoxId: string, beforeUnitId: string, type?: ScriptUnit['type'], characterId?: string, preId?: string) => string
  updateScriptUnit: (episodeId: string, plotBoxId: string, unitId: string, updates: Partial<ScriptUnit>) => void
  removeScriptUnit: (episodeId: string, plotBoxId: string, unitId: string) => void
  mergeScriptUnits: (episodeId: string, plotBoxId: string, targetUnitId: string, sourceUnitId: string) => void
  reorderScriptUnits: (episodeId: string, plotBoxId: string, oldIndex: number, newIndex: number) => void
  moveScriptUnitsByIds: (episodeId: string, plotBoxId: string, unitIds: string[], toIndex: number) => void
  reorderScriptUnitGroup: (episodeId: string, plotBoxId: string, fromStartIndex: number, fromCount: number, toIndex: number) => void
  /** 시나리오 스크립트를 타 플롯박스로 이동. fromPlotId의 unitIds를 toPlotId에 추가. insertIndex 생략 시 맨 끝. */
  moveScriptUnitsToPlotBox: (episodeId: string, fromPlotId: string, toPlotId: string, unitIds: string[], insertIndex?: number) => void
  /** 여러 플롯에 걸친 선택을 한 번에 toPlotId로 이동. groups는 선택 순서대로 { fromPlotId, unitIds }. insertIndex 생략 시 맨 끝. */
  moveScriptUnitsFromMultiplePlotsToPlotBox: (episodeId: string, toPlotId: string, insertIndex: number | undefined, groups: { fromPlotId: string; unitIds: string[] }[]) => void
  /** 에피소드 내 엑스트라 이름 변경: characterId === extra.id && dialogueLabel === oldLabel인 유닛의 dialogueLabel을 newLabel로 일괄 변경 */
  renameExtraInEpisode: (episodeId: string, oldLabel: string, newLabel: string) => void
  /** 플롯박스 내용을 시나리오에 삽입: sourcePlot의 content + scriptUnits를 targetPlot의 targetIndex에 풀기. sourcePlot은 비움. */
  insertPlotContentAtScenario: (episodeId: string, sourcePlotId: string, targetPlotId: string, targetIndex: number) => void
  markClean: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  file: null,
  filePath: null,
  isDirty: false,

  setFilePath: (path) => set({ filePath: path }),

  initProject: (title) => {
    applyDefaultSettingsToStore()
    const file = createEmptyProject(title)
    set({ file, filePath: null, isDirty: false })
    useHistoryStore.getState().clear()
    if (file.workspaceLayout) {
      useUIStore.getState().applyWorkspaceLayout(file.workspaceLayout)
    }
  },
  loadProject: (file, path) => {
    set({ file, filePath: path ?? null, isDirty: false })
    useHistoryStore.getState().clear()
    if (file.workspaceLayout) {
      useUIStore.getState().applyWorkspaceLayout(file.workspaceLayout)
    }
  },

  updateProjectTitle: (title) => {
    const { file } = get()
    if (!file) return
    set({ file: { ...file, project: { ...file.project, title, updatedAt: Date.now() } }, isDirty: true })
  },

  updateProject: (updates) => {
    const { file } = get()
    if (!file) return
    set({ file: { ...file, project: { ...file.project, ...updates, updatedAt: Date.now() } }, isDirty: true })
  },

  addCharacter: (character, preId) => {
    const { file } = get()
    if (!file) return
    const used = new Set(file.project.characters.map(c => c.shortcut).filter(s => s >= 1 && s <= 9))
    let shortcut = character.shortcut ?? -1
    if (shortcut < 1 || shortcut > 9 || used.has(shortcut)) {
      shortcut = -1
      for (let n = 1; n <= 9; n++) {
        if (!used.has(n)) {
          shortcut = n
          break
        }
      }
    }
    const newId = preId ?? generateId()
    const newChar = { ...character, id: newId, shortcut: shortcut as number }
    const extra = file.project.characters.find(c => c.name === '엑스트라')
    const newCharacters = [...file.project.characters, newChar]
    const nameToAdopt = (character.name || '').trim()
    const newFile: SWFile = {
      ...file,
      project: { ...file.project, characters: newCharacters, updatedAt: Date.now() },
      episodes: !extra || !nameToAdopt ? file.episodes : file.episodes.map(ep => ({
        ...ep,
        plotBoxes: ep.plotBoxes.map(p => ({
          ...p,
          scriptUnits: p.scriptUnits.map(u =>
            u.characterId === extra.id && u.dialogueLabel === nameToAdopt
              ? { ...u, characterId: newId, dialogueLabel: undefined }
              : u
          )
        }))
      }))
    }
    set({ file: newFile, isDirty: true })
  },

  updateCharacter: (id, updates) => {
    const { file } = get()
    if (!file) return
    const extra = file.project.characters.find(c => c.name === '엑스트라')
    const newName = updates.name?.trim()
    const newChars = file.project.characters.map(c => c.id === id ? { ...c, ...updates } : c)
    const newEpisodes = newName && extra
      ? file.episodes.map(ep => ({
          ...ep,
          plotBoxes: ep.plotBoxes.map(p => ({
            ...p,
            scriptUnits: p.scriptUnits.map(u =>
              u.characterId === extra.id && u.dialogueLabel === newName
                ? { ...u, characterId: id, dialogueLabel: undefined }
                : u
            )
          }))
        }))
      : file.episodes
    set({
      file: { ...file, project: { ...file.project, characters: newChars, updatedAt: Date.now() }, episodes: newEpisodes },
      isDirty: true
    })
  },

  removeCharacter: (id) => {
    const { file } = get()
    if (!file) return
    const deleted = file.project.characters.find(c => c.id === id)
    const deletedName = deleted?.name ?? ''
    const extra = file.project.characters.find(c => c.name === '엑스트라')
    const remaining = file.project.characters.filter(c => c.id !== id)
    const extraId = extra?.id
    let next = 1
    const withShortcuts = remaining.map(c => {
      if (c.name === '엑스트라') return { ...c, shortcut: 0 }
      const s = next <= 9 ? next : -1
      if (next <= 9) next++
      return { ...c, shortcut: s }
    })
    const newFile: SWFile = {
      ...file,
      project: { ...file.project, characters: withShortcuts, updatedAt: Date.now() },
      episodes: file.episodes.map(ep => ({
        ...ep,
        plotBoxes: ep.plotBoxes.map(p => ({
          ...p,
          scriptUnits: p.scriptUnits.map(u =>
            u.characterId === id && extraId
              ? { ...u, characterId: extraId, dialogueLabel: deletedName || u.dialogueLabel }
              : u
          )
        }))
      }))
    }
    set({ file: newFile, isDirty: true })
  },

  reorderCharacters: (fromIndex, toIndex) => {
    const { file } = get()
    if (!file) return
    const characters = [...file.project.characters]
    const [moved] = characters.splice(fromIndex, 1)
    characters.splice(toIndex, 0, moved)
    let next = 1
    const withShortcuts = characters.map(c => {
      if (c.name === '엑스트라') return { ...c, shortcut: 0 }
      const s = next <= 9 ? next : -1
      if (next <= 9) next++
      return { ...c, shortcut: s }
    })
    set({ file: { ...file, project: { ...file.project, characters: withShortcuts, updatedAt: Date.now() } }, isDirty: true })
  },

  addEpisode: (subtitle = '') => {
    const { file } = get()
    if (!file) return undefined
    const newNumber = file.episodes.length > 0 ? Math.max(...file.episodes.map(e => e.number)) + 1 : 1
    const newEpisode: Episode = { id: generateId(), number: newNumber, subtitle, plotBoxes: [createPlotBox([])] }
    set({ file: { ...file, episodes: [...file.episodes, newEpisode], project: { ...file.project, updatedAt: Date.now() } }, isDirty: true })
    return newEpisode.id
  },

  updateEpisode: (id, updates) => {
    const { file } = get()
    if (!file) return
    set({ file: updateEpisode(file, id, e => ({ ...e, ...updates })), isDirty: true })
  },

  removeEpisode: (id) => {
    const { file } = get()
    if (!file) return
    const renumbered = file.episodes.filter(e => e.id !== id).map((e, i) => ({ ...e, number: i + 1 }))
    set({ file: { ...file, episodes: renumbered, project: { ...file.project, updatedAt: Date.now() } }, isDirty: true })
  },

  reorderEpisodes: (fromIndex, toIndex) => {
    const { file } = get()
    if (!file) return
    const episodes = [...file.episodes]
    const [moved] = episodes.splice(fromIndex, 1)
    episodes.splice(toIndex, 0, moved)
    set({ file: { ...file, episodes: episodes.map((e, i) => ({ ...e, number: i + 1 })), project: { ...file.project, updatedAt: Date.now() } }, isDirty: true })
  },

  addPlotBox: (episodeId) => {
    const { file } = get()
    if (!file) return
    set({ file: updateEpisode(file, episodeId, e => ({ ...e, plotBoxes: [...e.plotBoxes, createPlotBox(e.plotBoxes)] })), isDirty: true })
  },

  insertPlotBoxAt: (episodeId, index) => {
    const { file } = get()
    if (!file) return ''
    const ep = file.episodes.find(e => e.id === episodeId)
    if (!ep) return ''
    const { plotBoxes, newId } = insertPlotBoxAtOps(ep.plotBoxes, index)
    set({ file: updateEpisode(file, episodeId, e => e.id === episodeId ? { ...e, plotBoxes } : e), isDirty: true })
    return newId
  },

  updatePlotBox: (episodeId, plotBoxId, updates) => {
    const { file } = get()
    if (!file) return
    set({ file: updatePlotBox(file, episodeId, plotBoxId, p => ({ ...p, ...updates })), isDirty: true })
  },

  removePlotBox: (episodeId, plotBoxId) => {
    const { file } = get()
    if (!file) return
    set({
      file: updateEpisode(file, episodeId, e => ({
        ...e,
        plotBoxes: e.plotBoxes.filter(p => p.id !== plotBoxId).map((p, i) => ({ ...p, order: i }))
      })),
      isDirty: true
    })
  },

  mergePlotBoxes: (episodeId, targetIndex, sourceIndex) => {
    const { file } = get()
    if (!file) return
    set({ file: updateEpisode(file, episodeId, e => ({ ...e, plotBoxes: mergePlotBoxes(e.plotBoxes, targetIndex, sourceIndex) })), isDirty: true })
  },

  mergeSelectedPlotBoxes: (episodeId, selectedIds) => {
    const { file } = get()
    if (!file) return
    set({ file: updateEpisode(file, episodeId, e => ({ ...e, plotBoxes: mergeSelectedPlotBoxes(e.plotBoxes, selectedIds) })), isDirty: true })
  },

  splitPlotBox: (episodeId, boxIndex, splitAtUnitIndex) => {
    const { file } = get()
    if (!file) return undefined
    const { plotBoxes, newPlotBoxId } = splitPlotBox(file.episodes.find(e => e.id === episodeId)?.plotBoxes ?? [], boxIndex, splitAtUnitIndex)
    if (!newPlotBoxId) return undefined
    set({ file: updateEpisode(file, episodeId, e => ({ ...e, plotBoxes })), isDirty: true })
    return newPlotBoxId
  },

  splitPlotBoxByContent: (episodeId, boxIndex, cursorPosition) => {
    const { file } = get()
    if (!file) return
    set({ file: updateEpisode(file, episodeId, e => ({ ...e, plotBoxes: splitPlotBoxByContent(e.plotBoxes, boxIndex, cursorPosition) })), isDirty: true })
  },

  reorderPlotBoxes: (episodeId, fromIndex, toIndex) => {
    const { file } = get()
    if (!file) return
    const s = useSettingsStore.getState()
    const episode = file.episodes.find(e => e.id === episodeId)
    set({
      file: updateEpisode(file, episodeId, e => {
        const reordered = reorderPlotBoxes(e.plotBoxes, fromIndex, toIndex)
        const updated = { ...e, plotBoxes: reordered }
        if (episode && s.backgroundSeqEnabled && s.backgroundSeqScope === 'episode') {
          return recomputeBackgroundNumbersForEpisode(updated, s.backgroundSeqPrefix, s.backgroundSeqSuffix, true)
        }
        return updated
      }),
      isDirty: true
    })
  },

  addScriptUnit: (episodeId, plotBoxId, type = 'action', characterId, preId) => {
    const { file } = get()
    if (!file) return
    const settings = useSettingsStore.getState()
    const scope = settings.backgroundSeqScope
    const enabled = settings.backgroundSeqEnabled
    const prefix = settings.backgroundSeqPrefix
    const suffix = settings.backgroundSeqSuffix
    const episode = file.episodes.find(e => e.id === episodeId)
    set({
      file: updatePlotBox(file, episodeId, plotBoxId, p => {
        const newUnit = createScriptUnit(p.scriptUnits, type, characterId)
        if (preId) newUnit.id = preId
        if (type === 'background' && episode && enabled) {
          const nextNum = getNextBackgroundNumber(episode, plotBoxId, scope, undefined, prefix, suffix)
          newUnit.content = setBackgroundSeqNum(newUnit.content, nextNum, prefix, suffix)
        }
        return { ...p, scriptUnits: [...p.scriptUnits, newUnit] }
      }),
      isDirty: true
    })
  },

  insertScriptUnitAfter: (episodeId, plotBoxId, afterUnitId, type = 'action', characterId, preId, initialContent) => {
    const { file } = get()
    if (!file) return ''
    const newId = preId || generateId()
    const settings = useSettingsStore.getState()
    const scope = settings.backgroundSeqScope
    const enabled = settings.backgroundSeqEnabled
    const prefix = settings.backgroundSeqPrefix
    const suffix = settings.backgroundSeqSuffix
    const episode = file.episodes.find(e => e.id === episodeId)
    set({
      file: updatePlotBox(file, episodeId, plotBoxId, p => {
        const sorted = [...p.scriptUnits].sort((a, b) => a.order - b.order)
        const afterIndex = sorted.findIndex(s => s.id === afterUnitId)
        const insertIndex = afterIndex >= 0 ? afterIndex + 1 : sorted.length
        let content = typeof initialContent === 'string' ? initialContent : ''
        if (content === '' && type === 'background' && episode && enabled) {
          const insertCtx = { plotUnits: sorted, insertIndex, plotBoxId }
          const nextNum = getNextBackgroundNumber(episode, plotBoxId, scope, insertCtx, prefix, suffix)
          content = setBackgroundSeqNum('', nextNum, prefix, suffix)
        }
        const newUnit: ScriptUnit = { id: newId, order: insertIndex, type, characterId, content }
        const updated = sorted.map((s, i) => ({ ...s, order: i < insertIndex ? i : i + 1 }))
        updated.splice(insertIndex, 0, newUnit)
        const reordered = updated.map((s, i) => ({ ...s, order: i }))
        const recomputed = type === 'background' && enabled ? recomputeBackgroundNumbersInPlot(reordered, prefix, suffix, true) : reordered
        return { ...p, scriptUnits: recomputed }
      }),
      isDirty: true
    })
    return newId
  },

  insertScriptUnitBefore: (episodeId, plotBoxId, beforeUnitId, type = 'action', characterId, preId) => {
    const { file } = get()
    if (!file) return ''
    const newId = preId || generateId()
    const settings = useSettingsStore.getState()
    const episode = file.episodes.find(e => e.id === episodeId)
    set({
      file: updatePlotBox(file, episodeId, plotBoxId, p => {
        const sorted = [...p.scriptUnits].sort((a, b) => a.order - b.order)
        const beforeIndex = sorted.findIndex(s => s.id === beforeUnitId)
        const insertIndex = beforeIndex >= 0 ? beforeIndex : 0
        let content = ''
        if ((type || 'action') === 'background' && episode && settings.backgroundSeqEnabled) {
          const insertCtx = { plotUnits: sorted, insertIndex, plotBoxId }
          const nextNum = getNextBackgroundNumber(
            episode,
            plotBoxId,
            settings.backgroundSeqScope,
            insertCtx,
            settings.backgroundSeqPrefix,
            settings.backgroundSeqSuffix
          )
          content = setBackgroundSeqNum('', nextNum, settings.backgroundSeqPrefix, settings.backgroundSeqSuffix)
        }
        const newUnit: ScriptUnit = { id: newId, order: insertIndex, type: type || 'action', characterId, content }
        const inserted = [...sorted.slice(0, insertIndex), newUnit, ...sorted.slice(insertIndex)].map((s, i) => ({ ...s, order: i }))
        const recomputed = (type || 'action') === 'background' && settings.backgroundSeqEnabled
          ? recomputeBackgroundNumbersInPlot(inserted, settings.backgroundSeqPrefix, settings.backgroundSeqSuffix, true)
          : inserted
        return { ...p, scriptUnits: recomputed }
      }),
      isDirty: true
    })
    return newId
  },

  updateScriptUnit: (episodeId, plotBoxId, unitId, updates) => {
    const { file } = get()
    if (!file) return
    set({
      file: updatePlotBox(file, episodeId, plotBoxId, p => {
        const unit = p.scriptUnits.find(s => s.id === unitId)
        if (!unit) return p
        const next = { ...unit, ...updates }
        if (updates.type === 'background') {
          const episode = file.episodes.find(e => e.id === episodeId)
          const settings = useSettingsStore.getState()
          if (episode && settings.backgroundSeqEnabled) {
            const sorted = [...p.scriptUnits].sort((a, b) => a.order - b.order)
            const unitIndex = sorted.findIndex(s => s.id === unitId)
            const insertCtx = { plotUnits: sorted, insertIndex: unitIndex, plotBoxId }
            const nextNum = getNextBackgroundNumber(
              episode,
              plotBoxId,
              settings.backgroundSeqScope,
              insertCtx,
              settings.backgroundSeqPrefix,
              settings.backgroundSeqSuffix
            )
            const mergedContent = updates.content !== undefined ? updates.content : unit.content
            next.content = setBackgroundSeqNum(mergedContent, nextNum, settings.backgroundSeqPrefix, settings.backgroundSeqSuffix)
          }
        }
        return { ...p, scriptUnits: p.scriptUnits.map(s => (s.id === unitId ? next : s)) }
      }),
      isDirty: true
    })
  },

  removeScriptUnit: (episodeId, plotBoxId, unitId) => {
    const { file } = get()
    if (!file) return
    set({
      file: updatePlotBox(file, episodeId, plotBoxId, p => ({
        ...p,
        scriptUnits: p.scriptUnits.filter(s => s.id !== unitId).map((s, i) => ({ ...s, order: i }))
      })),
      isDirty: true
    })
  },

  mergeScriptUnits: (episodeId, plotBoxId, targetUnitId, sourceUnitId) => {
    const { file } = get()
    if (!file) return
    set({
      file: updatePlotBox(file, episodeId, plotBoxId, p => {
        const target = p.scriptUnits.find(s => s.id === targetUnitId)
        const source = p.scriptUnits.find(s => s.id === sourceUnitId)
        if (!target || !source) return p
        return {
          ...p,
          scriptUnits: p.scriptUnits
            .filter(s => s.id !== sourceUnitId)
            .map(s => s.id === targetUnitId ? { ...s, content: target.content + '\n' + source.content } : s)
            .map((s, i) => ({ ...s, order: i }))
        }
      }),
      isDirty: true
    })
  },

  reorderScriptUnits: (episodeId, plotBoxId, oldIndex, newIndex) => {
    const { file } = get()
    if (!file) return
    const s = useSettingsStore.getState()
    set({
      file: updatePlotBox(file, episodeId, plotBoxId, p => {
        const sorted = [...p.scriptUnits].sort((a, b) => a.order - b.order)
        const [moved] = sorted.splice(oldIndex, 1)
        sorted.splice(newIndex, 0, moved)
        const reordered = sorted.map((s2, i) => ({ ...s2, order: i }))
        return { ...p, scriptUnits: recomputeBackgroundNumbersInPlot(reordered, s.backgroundSeqPrefix, s.backgroundSeqSuffix, s.backgroundSeqEnabled) }
      }),
      isDirty: true
    })
  },

  /** 선택된 unitIds(순서 유지)를 toIndex 위치로 이동. 비연속 선택 지원. */
  moveScriptUnitsByIds: (episodeId, plotBoxId, unitIds, toIndex) => {
    const { file } = get()
    if (!file || unitIds.length === 0) return
    const s = useSettingsStore.getState()
    set({
      file: updatePlotBox(file, episodeId, plotBoxId, p => {
        const sorted = [...p.scriptUnits].sort((a, b) => a.order - b.order)
        const idSet = new Set(unitIds)
        const toMove = unitIds.map(id => sorted.find(u => u.id === id)).filter((u): u is ScriptUnit => u != null)
        const remaining = sorted.filter(u => !idSet.has(u.id))
        const insertAt = Math.min(toIndex, remaining.length)
        const merged = [...remaining.slice(0, insertAt), ...toMove, ...remaining.slice(insertAt)].map((s2, i) => ({ ...s2, order: i }))
        return { ...p, scriptUnits: recomputeBackgroundNumbersInPlot(merged, s.backgroundSeqPrefix, s.backgroundSeqSuffix, s.backgroundSeqEnabled) }
      }),
      isDirty: true
    })
  },

  reorderScriptUnitGroup: (episodeId, plotBoxId, fromStartIndex, fromCount, toIndex) => {
    const { file } = get()
    if (!file || fromCount <= 0) return
    const s = useSettingsStore.getState()
    set({
      file: updatePlotBox(file, episodeId, plotBoxId, p => {
        const sorted = [...p.scriptUnits].sort((a, b) => a.order - b.order)
        const removed = sorted.splice(fromStartIndex, fromCount)
        const insertAt = toIndex > fromStartIndex ? toIndex - fromCount : toIndex
        sorted.splice(insertAt, 0, ...removed)
        const reordered = sorted.map((s2, i) => ({ ...s2, order: i }))
        return { ...p, scriptUnits: recomputeBackgroundNumbersInPlot(reordered, s.backgroundSeqPrefix, s.backgroundSeqSuffix, s.backgroundSeqEnabled) }
      }),
      isDirty: true
    })
  },

  insertPlotContentAtScenario: (episodeId, sourcePlotId, targetPlotId, targetIndex) => {
    const { file } = get()
    if (!file || sourcePlotId === targetPlotId) return
    const episode = file.episodes.find(e => e.id === episodeId)
    const source = episode?.plotBoxes.find(p => p.id === sourcePlotId)
    const target = episode?.plotBoxes.find(p => p.id === targetPlotId)
    if (!episode || !source || !target) return
    const s = useSettingsStore.getState()
    const sortedSourceUnits = [...source.scriptUnits].sort((a, b) => a.order - b.order)
    const contentAsAction: ScriptUnit | null = source.content.trim()
      ? { id: generateId(), order: 0, type: 'action', content: source.content.trim() }
      : null
    const unitsToMove = sortedSourceUnits.map((u, i) => ({ ...u, order: i }))
    if (unitsToMove.length === 0 && !contentAsAction) return
    set({
      file: updateEpisode(file, episodeId, e => ({
        ...e,
        plotBoxes: e.plotBoxes.map(p => {
          if (p.id === sourcePlotId) {
            const sourceRemaining = contentAsAction
              ? [contentAsAction].map((u, i) => ({ ...u, order: i }))
              : []
            return { ...p, content: '', scriptUnits: sourceRemaining }
          }
          if (p.id !== targetPlotId) return p
          const existing = [...p.scriptUnits].sort((a, b) => a.order - b.order)
          const insertAt = Math.min(targetIndex, existing.length)
          const merged = [...existing.slice(0, insertAt), ...unitsToMove, ...existing.slice(insertAt)].map((u, i) => ({ ...u, order: i }))
          return { ...p, scriptUnits: recomputeBackgroundNumbersInPlot(merged, s.backgroundSeqPrefix, s.backgroundSeqSuffix, s.backgroundSeqEnabled) }
        }),
      })),
      isDirty: true,
    })
  },

  renameExtraInEpisode: (episodeId, oldLabel, newLabel) => {
    const { file } = get()
    if (!file || !oldLabel.trim() || !newLabel.trim() || oldLabel === newLabel) return
    const extra = file.project.characters.find(c => c.name === '엑스트라')
    if (!extra) return
    const ep = file.episodes.find(e => e.id === episodeId)
    if (!ep) return
    set({
      file: updateEpisode(file, episodeId, e => ({
        ...e,
        plotBoxes: e.plotBoxes.map(p => ({
          ...p,
          scriptUnits: p.scriptUnits.map(u =>
            u.characterId === extra.id && u.dialogueLabel === oldLabel
              ? { ...u, dialogueLabel: newLabel.trim() }
              : u
          ),
        })),
      })),
      isDirty: true,
    })
  },

  moveScriptUnitsToPlotBox: (episodeId, fromPlotId, toPlotId, unitIds, insertIndex) => {
    const { file } = get()
    if (!file || unitIds.length === 0 || fromPlotId === toPlotId) return
    const episode = file.episodes.find(e => e.id === episodeId)
    if (!episode) return
    const fromBox = episode.plotBoxes.find(p => p.id === fromPlotId)
    const toBox = episode.plotBoxes.find(p => p.id === toPlotId)
    if (!fromBox || !toBox) return
    const toMove = unitIds
      .map(id => fromBox.scriptUnits.find(u => u.id === id))
      .filter((u): u is ScriptUnit => u != null)
      .sort((a, b) => fromBox.scriptUnits.indexOf(a) - fromBox.scriptUnits.indexOf(b))
    if (toMove.length === 0) return
    const s = useSettingsStore.getState()
    const { backgroundSeqPrefix, backgroundSeqSuffix, backgroundSeqEnabled, backgroundSeqScope } = s

    const transformEp = (ep: Episode): Episode => {
      const updated = {
        ...ep,
        plotBoxes: ep.plotBoxes.map(p => {
          if (p.id === fromPlotId) {
            const remaining = p.scriptUnits
              .filter(u => !unitIds.includes(u.id))
              .map((u, i) => ({ ...u, order: i }))
            return { ...p, scriptUnits: remaining }
          }
          if (p.id === toPlotId) {
            const existing = [...p.scriptUnits].sort((a, b) => a.order - b.order)
            const idx = insertIndex != null ? Math.max(0, Math.min(insertIndex, existing.length)) : existing.length
            const inserted = toMove.map((u, i) => ({ ...u, id: u.id, order: idx + i }))
            const merged = [...existing.slice(0, idx), ...inserted, ...existing.slice(idx)].map((u, i) => ({ ...u, order: i }))
            return { ...p, scriptUnits: merged }
          }
          return p
        }),
      }
      if (backgroundSeqEnabled && backgroundSeqScope === 'episode') {
        return recomputeBackgroundNumbersForEpisode(updated, backgroundSeqPrefix, backgroundSeqSuffix, true)
      }
      if (backgroundSeqEnabled && backgroundSeqScope === 'plot') {
        return {
          ...updated,
          plotBoxes: updated.plotBoxes.map(p => ({
            ...p,
            scriptUnits: recomputeBackgroundNumbersInPlot(p.scriptUnits, backgroundSeqPrefix, backgroundSeqSuffix, true),
          })),
        }
      }
      return updated
    }

    set({
      file: updateEpisode(file, episodeId, transformEp),
      isDirty: true,
    })
  },

  moveScriptUnitsFromMultiplePlotsToPlotBox: (episodeId, toPlotId, insertIndex, groups) => {
    const { file } = get()
    if (!file || groups.length === 0 || groups.every(g => g.unitIds.length === 0)) return
    const episode = file.episodes.find(e => e.id === episodeId)
    if (!episode) return
    const toBox = episode.plotBoxes.find(p => p.id === toPlotId)
    if (!toBox) return
    const s = useSettingsStore.getState()
    const { backgroundSeqPrefix, backgroundSeqSuffix, backgroundSeqEnabled, backgroundSeqScope } = s

    const insertedUnits: ScriptUnit[] = []
    const fromPlotIds = new Set<string>()
    for (const { fromPlotId, unitIds } of groups) {
      if (unitIds.length === 0) continue
      const fromBox = episode.plotBoxes.find(p => p.id === fromPlotId)
      if (!fromBox || fromPlotId === toPlotId) continue
      fromPlotIds.add(fromPlotId)
      const units = unitIds
        .map(id => fromBox.scriptUnits.find(u => u.id === id))
        .filter((u): u is ScriptUnit => u != null)
        .sort((a, b) => fromBox.scriptUnits.indexOf(a) - fromBox.scriptUnits.indexOf(b))
      insertedUnits.push(...units)
    }
    if (insertedUnits.length === 0) return

    const baseInsertIndex = insertIndex != null ? Math.max(0, Math.min(insertIndex, toBox.scriptUnits.length)) : toBox.scriptUnits.length

    const insertedIds = new Set(insertedUnits.map(u => u.id))
    const transformEp = (ep: Episode): Episode => {
      const toPlot = ep.plotBoxes.find(p => p.id === toPlotId)
      if (!toPlot) return ep
      const toExisting = [...toPlot.scriptUnits].sort((a, b) => a.order - b.order).filter(u => !insertedIds.has(u.id))
      const safeInsertIndex = Math.min(baseInsertIndex, toExisting.length)
      const toInsert = insertedUnits.map((u, i) => ({ ...u, order: safeInsertIndex + i }))
      const merged = [...toExisting.slice(0, safeInsertIndex), ...toInsert, ...toExisting.slice(safeInsertIndex)].map((x, i) => ({ ...x, order: i }))

      return {
        ...ep,
        plotBoxes: ep.plotBoxes.map(p => {
          if (p.id === toPlotId) return { ...p, scriptUnits: merged }
          if (fromPlotIds.has(p.id)) {
            const idsToRemove = new Set(groups.find(g => g.fromPlotId === p.id)?.unitIds ?? [])
            const remaining = p.scriptUnits.filter(u => !idsToRemove.has(u.id)).map((u, i) => ({ ...u, order: i }))
            return { ...p, scriptUnits: remaining }
          }
          return p
        }),
      }
    }

    let updated = transformEp(episode)
    if (backgroundSeqEnabled && backgroundSeqScope === 'episode') {
      updated = recomputeBackgroundNumbersForEpisode(updated, backgroundSeqPrefix, backgroundSeqSuffix, true)
    } else if (backgroundSeqEnabled && backgroundSeqScope === 'plot') {
      updated = {
        ...updated,
        plotBoxes: updated.plotBoxes.map(p => ({
          ...p,
          scriptUnits: recomputeBackgroundNumbersInPlot(p.scriptUnits, backgroundSeqPrefix, backgroundSeqSuffix, true),
        })),
      }
    }

    set({
      file: updateEpisode(file, episodeId, () => updated),
      isDirty: true,
    })
  },

  markClean: () => set({ isDirty: false })
}))
