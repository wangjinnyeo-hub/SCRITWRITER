import { useEffect, useRef } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore } from '@/store/ui/uiStore'
import {
  saveToLocalStorage,
  attachWorkspaceLayout,
  clearLocalStorageFile,
} from '@/lib/fileIO'
import { createGuideProject } from '@/domain/model'
import { getDefaultWorkspaceLayout } from '@/store/ui/uiStore'
import type { SWFile } from '@/types'

const AUTOSAVE_INTERVAL = 5000

export function useWebAutoSave() {
  const file = useProjectStore((state: { file: SWFile | null }) => state.file)
  const isDirty = useProjectStore((state: { isDirty: boolean }) => state.isDirty)
  const markClean = useProjectStore((state: { markClean: () => void }) => state.markClean)
  const loadProject = useProjectStore((state: { loadProject: (file: SWFile) => void }) => state.loadProject)
  const lastSaveRef = useRef<number>(0)

  // 진입 시 무조건 가이드. 재진입(새 탭/새로고침) 시 기존 저장 데이터는 쓰지 않고 새 가이드로 시작.
  useEffect(() => {
    clearLocalStorageFile()
    const guide = createGuideProject()
    loadProject(guide)
    useUIStore.getState().applyWorkspaceLayout(getDefaultWorkspaceLayout())
    const firstEp = guide.episodes[0]
    if (firstEp) {
      useUIStore.getState().setActiveEpisode(firstEp.id)
      const firstBox = firstEp.plotBoxes[0]
      if (firstBox) useUIStore.getState().setActivePlotBox(firstBox.id)
    }
    useUIStore.getState().setScreen('workspace')
  }, [loadProject])

  useEffect(() => {
    if (!file || !isDirty) return
    const layout = useUIStore.getState().getWorkspaceLayoutSnapshot()
    const fileWithLayout = attachWorkspaceLayout(file, layout)
    const doSave = () => {
      saveToLocalStorage(fileWithLayout)
      markClean()
      lastSaveRef.current = Date.now()
    }
    const now = Date.now()
    if (now - lastSaveRef.current >= AUTOSAVE_INTERVAL) {
      doSave()
    } else {
      const t = setTimeout(doSave, AUTOSAVE_INTERVAL - (now - lastSaveRef.current))
      return () => clearTimeout(t)
    }
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
