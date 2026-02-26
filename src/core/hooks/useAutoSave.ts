import { useEffect, useRef } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore } from '@/store/ui/uiStore'
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  attachWorkspaceLayout,
  isDesktop,
  saveToPath,
  loadFromPath,
  getDefaultProjectPath,
  getDefaultSavePath,
} from '@/lib/fileIO'
import { createGuideProject } from '@/domain/model'

const AUTOSAVE_INTERVAL = 5000

export function useAutoSave() {
  const file = useProjectStore(state => state.file)
  const isDirty = useProjectStore(state => state.isDirty)
  const markClean = useProjectStore(state => state.markClean)
  const loadProject = useProjectStore(state => state.loadProject)
  const lastSaveRef = useRef<number>(0)

  useEffect(() => {
    const init = async () => {
      try {
        if (isDesktop() && window.electron) {
          const pendingPath = await window.electron.getPendingOpenPath()
          if (pendingPath) {
            const loaded = await loadFromPath(pendingPath)
            if (loaded) {
              loadProject(loaded, pendingPath)
              return
            }
          }
          const lastPath = await window.electron.getLastOpenedPath()
          if (lastPath) {
            const loaded = await loadFromPath(lastPath)
            if (loaded) {
              loadProject(loaded, lastPath)
              return
            }
          }
          const guidePath = await getDefaultProjectPath('가이드.scrwrt')
          const guide = createGuideProject()
          loadProject(guide, guidePath ?? undefined)
          return
        }
        const saved = loadFromLocalStorage()
        if (saved) {
          loadProject(saved)
          return
        }
        loadProject(createGuideProject())
      } catch {
        useUIStore.getState().setFileErrorMessage('저장된 파일을 복원하지 못했습니다.')
      }
    }
    init()
  }, [loadProject])

  useEffect(() => {
    if (!file || !isDirty) return

    const saveWithLayout = async () => {
      const f = useProjectStore.getState().file
      if (!f) return
      const layout = useUIStore.getState().getWorkspaceLayoutSnapshot()
      const fileWithLayout = attachWorkspaceLayout(f, layout)
      try {
        if (isDesktop()) {
          const filePath = useProjectStore.getState().filePath
          const pathToUse = filePath ?? (await getDefaultSavePath(f.project.title))
          if (pathToUse) {
            const result = await saveToPath(fileWithLayout, pathToUse)
            if (!result.error) {
              if (!filePath) useProjectStore.getState().setFilePath(pathToUse)
              markClean()
              lastSaveRef.current = Date.now()
            } else {
              useUIStore.getState().setFileErrorMessage(result.error)
            }
          } else {
            saveToLocalStorage(fileWithLayout)
            markClean()
            lastSaveRef.current = Date.now()
          }
        } else {
          saveToLocalStorage(fileWithLayout)
          markClean()
          lastSaveRef.current = Date.now()
        }
      } catch (err) {
        useUIStore.getState().setFileErrorMessage(err instanceof Error ? err.message : '자동 저장에 실패했습니다.')
      }
    }

    const now = Date.now()
    if (now - lastSaveRef.current < AUTOSAVE_INTERVAL) {
      const timeout = setTimeout(() => saveWithLayout(), AUTOSAVE_INTERVAL - (now - lastSaveRef.current))
      return () => clearTimeout(timeout)
    }

    saveWithLayout()
  }, [file, isDirty, markClean])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && file) {
        const f = useProjectStore.getState().file
        if (f) {
          const layout = useUIStore.getState().getWorkspaceLayoutSnapshot()
          saveToLocalStorage(attachWorkspaceLayout(f, layout))
        }
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [file, isDirty])
}
