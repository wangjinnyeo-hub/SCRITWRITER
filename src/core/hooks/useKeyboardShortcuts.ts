import { useEffect, useCallback } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useEditorStore } from '@/store/editor/editorStore'
import { useUIStore } from '@/store/ui/uiStore'
import { useHistoryStore } from '@/store/history/historyStore'
import {
  saveToLocalStorage,
  openFilePicker,
  downloadFile,
  attachWorkspaceLayout,
  isDesktop,
  saveToPath,
  getDefaultSavePath,
  openFromPath,
  deserializeFile,
  showSaveDialog,
  sanitizeTitleForFilename,
  DEFAULT_PROJECT_EXT,
} from '@/lib/fileIO'
import { commandRegistry } from '@/lib/commandRegistry'
import { useRecentProjectsStore, getUniqueProjectTitle } from '@/store/project/recentProjectsStore'

export function useKeyboardShortcuts() {
  const file = useProjectStore(state => state.file)
  const markClean = useProjectStore(state => state.markClean)
  const setCurrentCharacter = useEditorStore(state => state.setCurrentCharacter)
  const setPropertyType = useEditorStore(state => state.setPropertyType)
  const toggleBold = useEditorStore(state => state.toggleBold)
  const toggleItalic = useEditorStore(state => state.toggleItalic)
  const toggleUnderline = useEditorStore(state => state.toggleUnderline)
  const toggleLeftPanel = useUIStore(state => state.toggleLeftPanel)

  const undo = useHistoryStore(state => state.undo)
  const redo = useHistoryStore(state => state.redo)
  const canUndo = useHistoryStore(state => state.canUndo)
  const canRedo = useHistoryStore(state => state.canRedo)

  const characters = file?.project.characters || []

  useEffect(() => {
    commandRegistry.register({
      id: 'file.save',
      label: '저장',
      category: 'file',
      shortcut: 'Ctrl+S',
      run: async () => {
        if (!isDesktop()) return // 웹: 저장 비활성화
        try {
          const f = useProjectStore.getState().file
          if (!f) return
          const layout = useUIStore.getState().getWorkspaceLayoutSnapshot()
          const fileWithLayout = attachWorkspaceLayout(f, layout)
          const filePath = useProjectStore.getState().filePath
          const pathToSave = filePath ?? (await getDefaultSavePath(f.project.title))
          if (!pathToSave) return
          const result = await saveToPath(fileWithLayout, pathToSave)
          if (result.error) {
            useUIStore.getState().setFileErrorMessage(result.error)
            return
          }
          useProjectStore.getState().setFilePath(pathToSave)
          useProjectStore.getState().markClean()
        } catch (err) {
          useUIStore.getState().setFileErrorMessage(err instanceof Error ? err.message : '작업을 완료할 수 없습니다.')
        }
      },
    })
    commandRegistry.register({
      id: 'file.new',
      label: '새로 만들기',
      category: 'file',
      shortcut: 'Ctrl+N',
      run: () => {
        const doNew = async () => {
          try {
            if (useProjectStore.getState().isDirty) {
              const result = await useUIStore.getState().openUnsavedConfirmDialog()
              if (result === 'cancel') return
            }
            const existingTitles = useRecentProjectsStore.getState().entries.map((e) => e.title)
            useProjectStore.getState().initProject(getUniqueProjectTitle('새 프로젝트', existingTitles))
            useHistoryStore.getState().clear()
            const nextFile = useProjectStore.getState().file
            const firstEp = nextFile?.episodes[0]
            if (firstEp) {
              useUIStore.getState().setActiveEpisode(firstEp.id)
              const firstBox = firstEp.plotBoxes[0]
              if (firstBox) useUIStore.getState().setActivePlotBox(firstBox.id)
            }
            useUIStore.getState().setScreen('workspace')
          } catch (err) {
            useUIStore.getState().setFileErrorMessage(err instanceof Error ? err.message : '작업을 완료할 수 없습니다.')
          }
        }
        doNew()
      },
    })
    commandRegistry.register({
      id: 'file.saveAs',
      label: '다른 이름으로 저장',
      category: 'file',
      shortcut: 'Ctrl+Shift+S',
      run: async () => {
        if (!isDesktop()) return // 웹: 다른 이름으로 저장 비활성화
        const f = useProjectStore.getState().file
        if (!f) return
        useUIStore.getState().setFileOperationLoading('save')
        try {
          const layout = useUIStore.getState().getWorkspaceLayoutSnapshot()
          const fileWithLayout = attachWorkspaceLayout(f, layout)
          const defaultName = `${sanitizeTitleForFilename(f.project.title)}.${DEFAULT_PROJECT_EXT}`
          const newPath = await showSaveDialog(defaultName)
          if (!newPath) return
          const result = await saveToPath(fileWithLayout, newPath)
          if (result.error) useUIStore.getState().setFileErrorMessage(result.error)
          else {
            useProjectStore.getState().setFilePath(newPath)
            useProjectStore.getState().markClean()
          }
        } finally {
          useUIStore.getState().setFileOperationLoading(null)
        }
      },
    })
    commandRegistry.register({
      id: 'file.newWindow',
      label: '새 창',
      category: 'file',
      shortcut: 'Ctrl+Shift+N',
      run: () => {
        if (isDesktop() && typeof window !== 'undefined' && window.electron?.openNewWindow) {
          window.electron.openNewWindow()
        } else if (typeof window !== 'undefined') {
          window.open(window.location.href, '_blank', 'noopener,noreferrer')
        }
      },
    })
    commandRegistry.register({
      id: 'file.open',
      label: '열기',
      category: 'file',
      shortcut: 'Ctrl+O',
      run: async () => {
        try {
          if (useProjectStore.getState().isDirty) {
            const result = await useUIStore.getState().openUnsavedConfirmDialog()
            if (result === 'cancel') return
          }
          const opened = await openFromPath()
          if (!opened) return
          try {
            const file = deserializeFile(opened.content)
            useProjectStore.getState().loadProject(file, opened.path || undefined)
            if (isDesktop() && opened.path && window.electron) {
              window.electron.setLastOpenedPath(opened.path)
            }
          } catch (err) {
            useUIStore.getState().setFileErrorMessage(err instanceof Error ? err.message : '파일을 열 수 없습니다.')
          }
        } catch (err) {
          useUIStore.getState().setFileErrorMessage(err instanceof Error ? err.message : '작업을 완료할 수 없습니다.')
        }
      },
    })
    commandRegistry.register({
      id: 'edit.undo',
      label: '되돌아가기',
      category: 'edit',
      shortcut: 'Ctrl+Z',
      run: () => { if (useHistoryStore.getState().canUndo()) useHistoryStore.getState().undo() },
      isEnabled: () => useHistoryStore.getState().canUndo(),
    })
    commandRegistry.register({
      id: 'edit.redo',
      label: '다시 실행',
      category: 'edit',
      shortcut: 'Ctrl+Y',
      run: () => { if (useHistoryStore.getState().canRedo()) useHistoryStore.getState().redo() },
      isEnabled: () => useHistoryStore.getState().canRedo(),
    })
    commandRegistry.register({
      id: 'format.bold',
      label: '볼드',
      category: 'format',
      shortcut: 'Ctrl+B',
      run: () => useEditorStore.getState().toggleBold(),
    })
    commandRegistry.register({
      id: 'format.italic',
      label: '기울임',
      category: 'format',
      shortcut: 'Ctrl+I',
      run: () => useEditorStore.getState().toggleItalic(),
    })
    commandRegistry.register({
      id: 'format.underline',
      label: '밑줄',
      category: 'format',
      shortcut: 'Ctrl+U',
      run: () => useEditorStore.getState().toggleUnderline(),
    })
    commandRegistry.register({
      id: 'view.toggleSidebar',
      label: '사이드바 토글',
      category: 'view',
      shortcut: 'Ctrl+\\',
      run: () => useUIStore.getState().toggleLeftPanel(),
    })
  }, [])

  /** Ctrl(Win/Linux) 또는 Cmd(Mac) — 전역 단축키가 입력/텍스트영역보다 먼저 처리되도록 캡처 단계에서 사용 */
  const mod = (e: KeyboardEvent) => e.ctrlKey || e.metaKey

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (mod(e) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault()
      e.stopPropagation()
      if (canUndo()) undo()
      return
    }
    if (mod(e) && !e.shiftKey && !e.altKey && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault()
      e.stopPropagation()
      if (canRedo()) redo()
      return
    }
    if (mod(e) && !e.altKey && !e.shiftKey) {
      switch (e.key) {
        case 's':
          e.preventDefault()
          if (file) {
            const layout = useUIStore.getState().getWorkspaceLayoutSnapshot()
            const fileWithLayout = attachWorkspaceLayout(file, layout)
            if (isDesktop()) {
              useUIStore.getState().setFileOperationLoading('save')
              const filePath = useProjectStore.getState().filePath
              const pathToUse = filePath ?? null
              if (pathToUse) {
                saveToPath(fileWithLayout, pathToUse)
                  .then((result) => {
                    if (result.error) useUIStore.getState().setFileErrorMessage(result.error)
                    else markClean()
                  })
                  .catch((err) => useUIStore.getState().setFileErrorMessage(err instanceof Error ? err.message : '작업을 완료할 수 없습니다.'))
                  .finally(() => useUIStore.getState().setFileOperationLoading(null))
              } else {
                getDefaultSavePath(file.project.title)
                  .then((pathToSave) => {
                    if (!pathToSave) return
                    return saveToPath(fileWithLayout, pathToSave).then((result) => {
                      if (result.error) useUIStore.getState().setFileErrorMessage(result.error)
                      else {
                        useProjectStore.getState().setFilePath(pathToSave)
                        markClean()
                      }
                    })
                  })
                  .catch((err) => useUIStore.getState().setFileErrorMessage(err instanceof Error ? err.message : '작업을 완료할 수 없습니다.'))
                  .finally(() => useUIStore.getState().setFileOperationLoading(null))
              }
            } else {
              saveToLocalStorage(fileWithLayout)
              markClean()
            }
          }
          return
        case 'n':
          e.preventDefault()
          if (useProjectStore.getState().isDirty) {
            useUIStore.getState().openUnsavedConfirmDialog()
              .then((result) => {
                if (result === 'cancel') return
                const existingTitles = useRecentProjectsStore.getState().entries.map((e) => e.title)
                useProjectStore.getState().initProject(getUniqueProjectTitle('새 프로젝트', existingTitles))
                useHistoryStore.getState().clear()
                const nextFile = useProjectStore.getState().file
                const firstEp = nextFile?.episodes[0]
                if (firstEp) {
                  useUIStore.getState().setActiveEpisode(firstEp.id)
                  const firstBox = firstEp.plotBoxes[0]
                  if (firstBox) useUIStore.getState().setActivePlotBox(firstBox.id)
                }
                useUIStore.getState().setScreen('workspace')
              })
              .catch((err) => useUIStore.getState().setFileErrorMessage(err instanceof Error ? err.message : '작업을 완료할 수 없습니다.'))
          } else {
            const existingTitles = useRecentProjectsStore.getState().entries.map((e) => e.title)
            useProjectStore.getState().initProject(getUniqueProjectTitle('새 프로젝트', existingTitles))
            useHistoryStore.getState().clear()
            const nextFile = useProjectStore.getState().file
            const firstEp = nextFile?.episodes[0]
            if (firstEp) {
              useUIStore.getState().setActiveEpisode(firstEp.id)
              const firstBox = firstEp.plotBoxes[0]
              if (firstBox) useUIStore.getState().setActivePlotBox(firstBox.id)
            }
            useUIStore.getState().setScreen('workspace')
          }
          return
        case 'o':
          e.preventDefault()
          useUIStore.getState().setFileOperationLoading('open')
          if (useProjectStore.getState().isDirty) {
            useUIStore.getState().openUnsavedConfirmDialog()
              .then((result) => {
                if (result === 'cancel') return
                return openFromPath().then((opened) => {
                  if (!opened) return
                  try {
                    const loaded = deserializeFile(opened.content)
                    useProjectStore.getState().loadProject(loaded, opened.path || undefined)
                    if (isDesktop() && opened.path && window.electron) window.electron.setLastOpenedPath(opened.path)
                  } catch (err) {
                    useUIStore.getState().setFileErrorMessage(err instanceof Error ? err.message : '파일을 열 수 없습니다.')
                  }
                })
              })
              .catch((err) => useUIStore.getState().setFileErrorMessage(err instanceof Error ? err.message : '작업을 완료할 수 없습니다.'))
              .finally(() => useUIStore.getState().setFileOperationLoading(null))
          } else {
            openFromPath()
              .then((opened) => {
                if (!opened) return
                try {
                  const loaded = deserializeFile(opened.content)
                  useProjectStore.getState().loadProject(loaded, opened.path || undefined)
                  if (isDesktop() && opened.path && window.electron) window.electron.setLastOpenedPath(opened.path)
                } catch (err) {
                  useUIStore.getState().setFileErrorMessage(err instanceof Error ? err.message : '파일을 열 수 없습니다.')
                }
              })
              .catch((err) => useUIStore.getState().setFileErrorMessage(err instanceof Error ? err.message : '작업을 완료할 수 없습니다.'))
              .finally(() => useUIStore.getState().setFileOperationLoading(null))
          }
          return
        case 'b':
          e.preventDefault()
          toggleBold()
          return
        case 'i':
          e.preventDefault()
          toggleItalic()
          return
        case 'u':
          e.preventDefault()
          toggleUnderline()
          return
        case '\\':
          e.preventDefault()
          toggleLeftPanel()
          return
      }
    }
    if (mod(e) && e.shiftKey && !e.altKey && (e.key === 'N' || e.key === 'n')) {
      e.preventDefault()
      commandRegistry.get('file.newWindow')?.run()
      return
    }
    if (mod(e) && e.shiftKey && !e.altKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault()
      commandRegistry.get('file.saveAs')?.run()
      return
    }
    if (mod(e) && !e.altKey && !e.shiftKey) {
      const num = e.key === '0' ? 0 : parseInt(e.key, 10)
      if (num >= 0 && num <= 9 && e.key.length === 1) {
        e.preventDefault()
        const char = characters.find(c => c.shortcut === num)
        if (char) {
          setCurrentCharacter(char.id)
          setPropertyType('dialogue')
        }
      }
    }
  }, [characters, setCurrentCharacter, setPropertyType, file, markClean, undo, redo, canUndo, canRedo, toggleBold, toggleItalic, toggleUnderline, toggleLeftPanel])

  useEffect(() => {
    const opts: AddEventListenerOptions = { capture: true }
    document.addEventListener('keydown', handleKeyDown, opts)
    return () => document.removeEventListener('keydown', handleKeyDown, opts)
  }, [handleKeyDown])
}
