import { useProjectStore } from '@/store/project/projectStore'
import { useHistoryStore } from '@/store/history/historyStore'
import { useUIStore } from '@/store/ui/uiStore'
import type { Character, Episode } from '@/types'
import { generateId } from '@/domain/model'
import { restoreFile } from './restoreFile'

export function useEpisodeAndCharacterActions() {
  const executeCommand = useHistoryStore(state => state.executeCommand)
  const projectStore = useProjectStore()

  const addCharacterUndoable = (character: Omit<Character, 'id'>) => {
    const charId = generateId()
    executeCommand({
      description: `캐릭터 추가: ${character.name}`,
      execute: () => projectStore.addCharacter(character, charId),
      undo: () => projectStore.removeCharacter(charId),
    })
  }

  const removeCharacterUndoable = (characterId: string) => {
    const file = projectStore.file
    if (!file) return
    const snap = file.project.characters.find(c => c.id === characterId)
    if (!snap) return
    const charSnap = { ...snap }
    const idxSnap = file.project.characters.findIndex(c => c.id === characterId)
    executeCommand({
      description: `캐릭터 삭제: ${charSnap.name}`,
      execute: () => projectStore.removeCharacter(characterId),
      undo: () => restoreFile(f => {
        const chars = [...f.project.characters]; chars.splice(idxSnap, 0, charSnap)
        return { ...f, project: { ...f.project, characters: chars, updatedAt: Date.now() } }
      }),
    })
  }

  const updateCharacterUndoable = (characterId: string, updates: Partial<Character>) => {
    const file = projectStore.file
    if (!file) return
    const old = file.project.characters.find(c => c.id === characterId)
    if (!old) return
    const oldState = { ...old }
    executeCommand({
      description: '캐릭터 수정',
      execute: () => projectStore.updateCharacter(characterId, updates),
      undo: () => projectStore.updateCharacter(characterId, oldState),
    })
  }

  const addEpisodeUndoable = () => {
    let addedEpisodeId: string | undefined
    executeCommand({
      description: '에피소드 추가',
      execute: () => { addedEpisodeId = projectStore.addEpisode(); return addedEpisodeId },
      undo: () => { if (addedEpisodeId) projectStore.removeEpisode(addedEpisodeId) },
    })
    if (addedEpisodeId) useUIStore.getState().setActiveEpisode(addedEpisodeId)
  }

  const renameExtraInEpisodeUndoable = (episodeId: string, oldLabel: string, newLabel: string) => {
    if (!oldLabel.trim() || !newLabel.trim() || oldLabel === newLabel) return
    executeCommand({
      description: `엑스트라 이름 변경: ${oldLabel} → ${newLabel}`,
      execute: () => projectStore.renameExtraInEpisode(episodeId, oldLabel, newLabel),
      undo: () => projectStore.renameExtraInEpisode(episodeId, newLabel, oldLabel),
    })
  }

  const removeEpisodeUndoable = (episodeId: string) => {
    const file = projectStore.file
    if (!file) return
    const snap = file.episodes.find(e => e.id === episodeId)
    if (!snap) return
    const epSnap = { ...snap }
    const idxSnap = file.episodes.findIndex(e => e.id === episodeId)
    executeCommand({
      description: '에피소드 삭제',
      execute: () => projectStore.removeEpisode(episodeId),
      undo: () => restoreFile(f => {
        const eps = [...f.episodes]; eps.splice(idxSnap, 0, epSnap)
        return { ...f, episodes: eps.map((e, i) => ({ ...e, number: i + 1 })), project: { ...f.project, updatedAt: Date.now() } }
      }),
    })
  }

  const updateEpisodeUndoable = (episodeId: string, updates: Partial<Episode>) => {
    const file = projectStore.file
    if (!file || Object.keys(updates).length === 0) return
    const ep = file.episodes.find(e => e.id === episodeId)
    if (!ep) return
    const prev = { ...ep }
    executeCommand({
      description: '에피소드 편집',
      execute: () => projectStore.updateEpisode(episodeId, updates),
      undo: () => projectStore.updateEpisode(episodeId, prev),
    })
  }

  const reorderEpisodesUndoable = (fromIndex: number, toIndex: number) => {
    const file = projectStore.file
    if (!file || fromIndex === toIndex) return
    const orderSnapshot = file.episodes.map(e => e.id)
    executeCommand({
      description: '에피소드 순서 변경',
      execute: () => projectStore.reorderEpisodes(fromIndex, toIndex),
      undo: () => restoreFile(f => {
        const restored = orderSnapshot.map(id => f.episodes.find(e => e.id === id)).filter(Boolean) as typeof f.episodes
        if (restored.length !== orderSnapshot.length) return f
        return { ...f, episodes: restored.map((e, i) => ({ ...e, number: i + 1 })), project: { ...f.project, updatedAt: Date.now() } }
      }),
    })
  }

  return {
    addCharacterUndoable,
    removeCharacterUndoable,
    updateCharacterUndoable,
    addEpisodeUndoable,
    removeEpisodeUndoable,
    renameExtraInEpisodeUndoable,
    updateEpisodeUndoable,
    reorderEpisodesUndoable,
  }
}
