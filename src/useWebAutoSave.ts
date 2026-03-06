import { useEffect } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore } from '@/store/ui/uiStore'
import { clearLocalStorageFile } from '@/lib/fileIO'
import { getDefaultWorkspaceLayout } from '@/store/ui/uiStore'
import { createGuideProject } from '@/domain/model'

/**
 * 웹: 진입·세션 변경 시 항상 새 가이드 파일 제공. 파일 저장 없음.
 */
export function useWebAutoSave() {
  useEffect(() => {
    clearLocalStorageFile()
    const guide = createGuideProject()
    useProjectStore.getState().loadProject(guide)
    useUIStore.getState().applyWorkspaceLayout(getDefaultWorkspaceLayout())
    const firstEp = guide.episodes[0]
    if (firstEp) {
      useUIStore.getState().setActiveEpisode(firstEp.id)
      const firstBox = firstEp.plotBoxes[0]
      if (firstBox) useUIStore.getState().setActivePlotBox(firstBox.id)
    }
    useUIStore.getState().setScreen('workspace')
  }, [])
}
