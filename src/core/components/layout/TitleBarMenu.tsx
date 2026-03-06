import { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore } from '@/store/ui/uiStore'
import { useHistoryStore } from '@/store/history/historyStore'
import {
  saveToLocalStorage,
  attachWorkspaceLayout,
  isDesktop,
  saveToPath,
  getDefaultSavePath,
  getDefaultProjectPath,
  openFromPath,
  deserializeFile,
  showSaveDialog,
  loadFromPath,
  downloadFile,
  sanitizeTitleForFilename,
  DEFAULT_PROJECT_EXT,
} from '@/lib/fileIO'
import { useRecentProjectsStore, getDedupedOrderedEntriesFrom, getUniqueProjectTitle, type RecentProjectEntry } from '@/store/project/recentProjectsStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { applyTheme, builtinThemes } from '@/lib/themeSystem'
import { createGuideProject } from '@/domain/model'
import { cn } from '@/lib/utils'

const UI_SCALE_OPTIONS = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150] as const

/** 타이틀 바용 파일·환경설정·도움말 메뉴. */
export function TitleBarMenu() {
  const file = useProjectStore(state => state.file)
  const isDirty = useProjectStore(state => state.isDirty)
  const loadProject = useProjectStore(state => state.loadProject)
  const initProject = useProjectStore(state => state.initProject)
  const markClean = useProjectStore(state => state.markClean)
  const setFilePath = useProjectStore(state => state.setFilePath)
  const setFileErrorMessage = useUIStore(state => state.setFileErrorMessage)
  const setFileOperationLoading = useUIStore(state => state.setFileOperationLoading)
  const openUnsavedConfirmDialog = useUIStore(state => state.openUnsavedConfirmDialog)
  const setScreen = useUIStore(state => state.setScreen)
  const setActiveEpisode = useUIStore(state => state.setActiveEpisode)
  const setActivePlotBox = useUIStore(state => state.setActivePlotBox)

  const addOrUpdateRecent = useRecentProjectsStore(state => state.addOrUpdate)
  const recentEntries = useRecentProjectsStore(state => state.entries)
  const recentSortMode = useRecentProjectsStore(state => state.sortMode)
  const recentList = getDedupedOrderedEntriesFrom(recentEntries, recentSortMode)

  const [openMenu, setOpenMenu] = useState<'file' | 'preferences' | 'help' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const activeThemeId = useUIStore(state => state.activeThemeId)
  const setActiveThemeId = useUIStore(state => state.setActiveThemeId)
  const statusBarVisible = useUIStore(state => state.statusBarVisible)
  const toggleStatusBar = useUIStore(state => state.toggleStatusBar)
  const setSettingsDialogOpen = useUIStore(state => state.setSettingsDialogOpen)
  const setDefaultSettingsDialogOpen = useUIStore(state => state.setDefaultSettingsDialogOpen)
  const colonAsDialogue = useSettingsStore(state => state.colonAsDialogue)
  const setColonAsDialogue = useSettingsStore(state => state.setColonAsDialogue)
  const uiScalePercent = useSettingsStore(state => state.uiScalePercent)
  const setUiScalePercent = useSettingsStore(state => state.setUiScalePercent)
  const setHelpDialogOpen = useUIStore(state => state.setHelpDialogOpen)

  const handleSave = async () => {
    const f = useProjectStore.getState().file
    if (!f) return
    setFileOperationLoading('save')
    try {
      const layout = useUIStore.getState().getWorkspaceLayoutSnapshot()
      const fileWithLayout = attachWorkspaceLayout(f, layout)
      if (isDesktop()) {
        const filePath = useProjectStore.getState().filePath
        const pathToUse = filePath ?? (await getDefaultSavePath(f.project.title))
        if (!pathToUse) return
        const result = await saveToPath(fileWithLayout, pathToUse)
        if (result.error) setFileErrorMessage(result.error)
        else {
          if (!filePath) setFilePath(pathToUse)
          markClean()
        }
      } else {
        saveToLocalStorage(fileWithLayout)
        markClean()
      }
    } finally {
      setFileOperationLoading(null)
    }
  }

  const handleOpen = async () => {
    if (isDirty) {
      const result = await openUnsavedConfirmDialog()
      if (result === 'cancel') return
    }
    setFileOperationLoading('open')
    try {
      const opened = await openFromPath()
      if (!opened) {
        setFileErrorMessage('파일을 열 수 없습니다.')
        return
      }
      try {
        const loaded = deserializeFile(opened.content)
        loadProject(loaded, opened.path || undefined)
        addOrUpdateRecent({
          path: opened.path || undefined,
          title: loaded.project.title,
          episodeCount: loaded.episodes.length,
        })
        if (isDesktop() && opened.path && window.electron) window.electron.setLastOpenedPath(opened.path)
      } catch (err) {
        setFileErrorMessage(err instanceof Error ? err.message : '파일을 열 수 없습니다.')
      }
    } finally {
      setFileOperationLoading(null)
    }
  }

  const handleNew = async () => {
    if (isDirty) {
      const result = await openUnsavedConfirmDialog()
      if (result === 'cancel') return
    }
    const existingTitles = useRecentProjectsStore.getState().entries.map((e) => e.title)
    initProject(getUniqueProjectTitle('새 프로젝트', existingTitles))
    useHistoryStore.getState().clear()
    const nextFile = useProjectStore.getState().file
    const firstEp = nextFile?.episodes[0]
    if (firstEp) {
      setActiveEpisode(firstEp.id)
      const firstBox = firstEp.plotBoxes[0]
      if (firstBox) setActivePlotBox(firstBox.id)
    }
    setScreen('workspace')
  }

  const handleNewGuide = async () => {
    if (isDirty) {
      const result = await openUnsavedConfirmDialog()
      if (result === 'cancel') return
    }
    const guide = createGuideProject()
    let guidePath: string | undefined
    if (isDesktop() && window.electron) {
      guidePath = await getDefaultProjectPath('가이드.scrwrt') ?? undefined
    }
    loadProject(guide, guidePath)
    if (guidePath) setFilePath(guidePath)
    useHistoryStore.getState().clear()
    addOrUpdateRecent({
      path: guidePath,
      title: guide.project.title,
      episodeCount: guide.episodes.length,
    })
    const firstEp = guide.episodes[0]
    if (firstEp) {
      setActiveEpisode(firstEp.id)
      const firstBox = firstEp.plotBoxes[0]
      if (firstBox) setActivePlotBox(firstBox.id)
    }
    setScreen('workspace')
  }

  const handleSaveAs = async () => {
    const f = useProjectStore.getState().file
    if (!f) return
    setFileOperationLoading('save')
    try {
      const layout = useUIStore.getState().getWorkspaceLayoutSnapshot()
      const fileWithLayout = attachWorkspaceLayout(f, layout)
      if (isDesktop()) {
        const defaultName = `${sanitizeTitleForFilename(f.project.title)}.${DEFAULT_PROJECT_EXT}`
        const newPath = await showSaveDialog(defaultName)
        if (!newPath) return
        const result = await saveToPath(fileWithLayout, newPath)
        if (result.error) setFileErrorMessage(result.error)
        else {
          setFilePath(newPath)
          markClean()
        }
      } else {
        downloadFile(fileWithLayout, `${sanitizeTitleForFilename(f.project.title)}.${DEFAULT_PROJECT_EXT}`)
      }
    } finally {
      setFileOperationLoading(null)
    }
  }

  useEffect(() => {
    if (!openMenu) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openMenu])

  const handleOpenRecentItem = async (entry: RecentProjectEntry) => {
    setOpenMenu(null)
    if (isDirty) {
      const result = await openUnsavedConfirmDialog()
      if (result === 'cancel') return
    }
    if (entry.path && isDesktop()) {
      setFileOperationLoading('open')
      try {
        const loaded = await loadFromPath(entry.path)
        if (loaded) {
          loadProject(loaded, entry.path)
          addOrUpdateRecent({ path: entry.path, title: loaded.project.title, episodeCount: loaded.episodes.length })
          if (window.electron) window.electron.setLastOpenedPath(entry.path)
          const firstEp = loaded.episodes[0]
          if (firstEp) {
            setActiveEpisode(firstEp.id)
            const firstBox = firstEp.plotBoxes[0]
            if (firstBox) setActivePlotBox(firstBox.id)
          }
          setScreen('workspace')
        } else setFileErrorMessage('파일을 열 수 없습니다.')
      } finally {
        setFileOperationLoading(null)
      }
    } else {
      handleOpen()
    }
  }

  const switchTheme = (id: string) => {
    const theme = builtinThemes.find(t => t.id === id)
    if (theme) {
      applyTheme(theme)
      setActiveThemeId(id)
    }
  }

  const menuBtnClass = 'px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm h-6 transition-colors'
  return (
    <div ref={menuRef} className={cn('flex items-center h-full relative gap-1', openMenu && 'z-[100]')}>
      {isDesktop() && (
        <button
          type="button"
          onClick={() => setScreen('main')}
          className="flex items-center justify-center shrink-0 w-5 h-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="메인 화면"
          aria-label="메인 화면"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}
        className={menuBtnClass}
      >
        파일
      </button>
      <button
        type="button"
        onClick={() => setOpenMenu(openMenu === 'preferences' ? null : 'preferences')}
        className={menuBtnClass}
      >
        환경설정
      </button>
      <button
        type="button"
        onClick={() => setOpenMenu(openMenu === 'help' ? null : 'help')}
        className={menuBtnClass}
      >
        도움말
      </button>
      {openMenu === 'file' && (
        <div className="absolute left-0 top-full mt-0.5 min-w-[180px] py-1 bg-card text-card-foreground border border-border rounded-md shadow-lg shadow-black/15">
          <button type="button" onClick={() => { setOpenMenu(null); handleNew() }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted rounded-sm flex items-center justify-between gap-2">
            새 프로젝트
            <span className="text-[9px] text-muted-foreground shrink-0">Ctrl+N</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenMenu(null)
              if (isDesktop() && window.electron?.openNewWindow) window.electron.openNewWindow()
              else window.open(window.location.href, '_blank', 'noopener,noreferrer')
            }}
            className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted rounded-sm flex items-center justify-between gap-2"
          >
            새 창
            <span className="text-[9px] text-muted-foreground shrink-0">Ctrl+Shift+N</span>
          </button>
          <button type="button" onClick={() => { setOpenMenu(null); handleNewGuide() }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted rounded-sm">새 가이드 파일 생성</button>
          {isDesktop() && (
            <>
              <button type="button" onClick={() => { setOpenMenu(null); handleSave() }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted rounded-sm flex items-center justify-between gap-2">
                저장
                <span className="text-[9px] text-muted-foreground shrink-0">Ctrl+S</span>
              </button>
              <button type="button" onClick={() => { setOpenMenu(null); handleSaveAs() }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted rounded-sm flex items-center justify-between gap-2">
                다른 이름으로 저장
                <span className="text-[9px] text-muted-foreground shrink-0">Ctrl+Shift+S</span>
              </button>
            </>
          )}
          <button type="button" onClick={() => { setOpenMenu(null); handleOpen() }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted rounded-sm flex items-center justify-between gap-2">
            열기
            <span className="text-[9px] text-muted-foreground shrink-0">Ctrl+O</span>
          </button>
          <div className="h-px bg-border my-1" />
          <div className="px-2 py-1 text-[10px] text-muted-foreground">최근 프로젝트</div>
          {recentList.slice(0, 8).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => handleOpenRecentItem(entry)}
              className="w-full text-left px-3 py-1 text-[11px] truncate hover:bg-muted rounded-sm"
              title={entry.path || entry.title}
            >
              {entry.title || '(제목 없음)'}
            </button>
          ))}
          {recentList.length === 0 && <div className="px-3 py-1 text-[10px] text-muted-foreground">없음</div>}
        </div>
      )}
      {openMenu === 'preferences' && (
        <div className="absolute left-0 top-full mt-0.5 min-w-[200px] py-1 bg-card text-card-foreground border border-border rounded-md shadow-lg shadow-black/15">
          <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium">테마</div>
          <div className="flex flex-wrap gap-0.5 px-2 pb-1">
            {builtinThemes.map((t) => (
              <button key={t.id} type="button" onClick={() => switchTheme(t.id)} className={cn('px-2 py-0.5 text-[10px] rounded-sm', activeThemeId === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted/70 hover:bg-muted')}>{t.nameKo}</button>
            ))}
          </div>
          <div className="h-px bg-border my-1" />
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] hover:bg-muted rounded-sm">
            <span>배율</span>
            <select
              value={uiScalePercent}
              onChange={(e) => setUiScalePercent(Number(e.target.value))}
              className="h-5 text-[10px] border border-border rounded px-1 bg-background min-w-[52px]"
              onClick={(e) => e.stopPropagation()}
            >
              {UI_SCALE_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}%</option>
              ))}
            </select>
          </div>
          <div className="h-px bg-border my-1" />
          <label className="flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-muted rounded-sm cursor-pointer">
            <input type="checkbox" checked={statusBarVisible} onChange={() => toggleStatusBar()} className="w-3.5 h-3.5" />
            상태바 표시
          </label>
          <button type="button" onClick={() => { setOpenMenu(null); setSettingsDialogOpen(true, 'shortcuts') }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted rounded-sm">단축키 설정...</button>
          <button type="button" onClick={() => { setOpenMenu(null); setDefaultSettingsDialogOpen(true) }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted rounded-sm">기본설정</button>
          <label className="flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-muted rounded-sm cursor-pointer">
            <input type="checkbox" checked={colonAsDialogue} onChange={(e) => setColonAsDialogue(e.target.checked)} className="w-3.5 h-3.5" />
            모든 &apos; : &apos; 를 대사로 인식
          </label>
        </div>
      )}
      {openMenu === 'help' && (
        <div className="absolute left-0 top-full mt-0.5 min-w-[160px] py-1 bg-card text-card-foreground border border-border rounded-md shadow-lg shadow-black/15">
          <button type="button" onClick={() => { setOpenMenu(null); setHelpDialogOpen(true) }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted rounded-sm">사용법 및 플로우</button>
        </div>
      )}
    </div>
  )
}
