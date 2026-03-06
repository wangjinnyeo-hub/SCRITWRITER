import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore, getDefaultWorkspaceLayout } from '@/store/ui/uiStore'
import { useHistoryStore } from '@/store/history/historyStore'
import { useRecentProjectsStore, getDedupedOrderedEntriesFrom, getUniqueProjectTitle, type RecentProjectEntry, type RecentSortMode } from '@/store/project/recentProjectsStore'
import { openFromPath, loadFromPath, loadFromLocalStorage, deserializeFile, isDesktop } from '@/lib/fileIO'
import { WindowTitleBar } from '@/components/layout/WindowTitleBar'
import { useCallback, useState, useMemo, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/Tooltip'

export function MainScreen() {
  const file = useProjectStore(state => state.file)
  const isDirty = useProjectStore(state => state.isDirty)
  const initProject = useProjectStore(state => state.initProject)
  const loadProject = useProjectStore(state => state.loadProject)
  const openUnsavedConfirmDialog = useUIStore(state => state.openUnsavedConfirmDialog)
  const setScreen = useUIStore(state => state.setScreen)
  const setActiveEpisode = useUIStore(state => state.setActiveEpisode)
  const setActivePlotBox = useUIStore(state => state.setActivePlotBox)
  const setFullViewOpen = useUIStore(state => state.setFullViewOpen)
  const setFileOperationLoading = useUIStore(state => state.setFileOperationLoading)
  const setFileErrorMessage = useUIStore(state => state.setFileErrorMessage)

  const rawEntries = useRecentProjectsStore(state => state.entries)
  const sortMode = useRecentProjectsStore(state => state.sortMode)
  const entries = useMemo(
    () => getDedupedOrderedEntriesFrom(rawEntries, sortMode),
    [rawEntries, sortMode]
  )
  const setSortMode = useRecentProjectsStore(state => state.setSortMode)
  const addOrUpdateRecent = useRecentProjectsStore(state => state.addOrUpdate)
  const removeRecent = useRecentProjectsStore(state => state.remove)
  const reorderRecent = useRecentProjectsStore(state => state.reorder)

  const [loadingPath, setLoadingPath] = useState<string | null>(null)

  const openProjectAndGo = useCallback(
    (f: NonNullable<typeof file>, path?: string) => {
      loadProject(f, path)
      addOrUpdateRecent({
        path,
        title: f.project.title,
        episodeCount: f.episodes.length,
      })
      const firstEp = f.episodes[0]
      if (firstEp) {
        setActiveEpisode(firstEp.id)
        const firstBox = firstEp.plotBoxes[0]
        if (firstBox) setActivePlotBox(firstBox.id)
      }
      setScreen('workspace')
    },
    [loadProject, addOrUpdateRecent, setActiveEpisode, setActivePlotBox, setScreen]
  )

  const filePath = useProjectStore(state => state.filePath)

  // 웹: localStorage에 저장된 세션이 있으면 최근 목록에 한 번 반영해 "이전 세션"이 보이게 함
  useEffect(() => {
    if (isDesktop()) return
    const stored = loadFromLocalStorage()
    if (!stored) return
    const hasWebEntry = rawEntries.some(e => e.path === '')
    if (!hasWebEntry) {
      addOrUpdateRecent({ path: '', title: stored.project.title, episodeCount: stored.episodes.length })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- 마운트 시 1회만

  useEffect(() => {
    if (!isDesktop() || !window.electron?.onOpenFileFromArg) return
    window.electron.onOpenFileFromArg(async (pathFromArg: string) => {
      const isDirtyNow = useProjectStore.getState().isDirty
      if (isDirtyNow) {
        const result = await openUnsavedConfirmDialog()
        if (result === 'cancel') return
      }
      useUIStore.getState().setFileOperationLoading('open')
      try {
        const loaded = await loadFromPath(pathFromArg)
        if (loaded) {
          const { loadProject: lp } = useProjectStore.getState()
          const { setActiveEpisode: setEp, setActivePlotBox: setBox, setScreen: setScr } = useUIStore.getState()
          lp(loaded, pathFromArg)
          addOrUpdateRecent({ path: pathFromArg, title: loaded.project.title, episodeCount: loaded.episodes.length })
          const firstEp = loaded.episodes[0]
          if (firstEp) {
            setEp(firstEp.id)
            const firstBox = firstEp.plotBoxes[0]
            if (firstBox) setBox(firstBox.id)
          }
          setScr('workspace')
        } else {
          useUIStore.getState().setFileErrorMessage('파일을 열 수 없습니다.')
        }
      } finally {
        useUIStore.getState().setFileOperationLoading(null)
      }
    })
  }, [addOrUpdateRecent, openUnsavedConfirmDialog])

  const handleOpenProject = useCallback(() => {
    if (!file) {
      const existingTitles = useRecentProjectsStore.getState().entries.map((e) => e.title)
      initProject(getUniqueProjectTitle('새 프로젝트', existingTitles))
      const nextFile = useProjectStore.getState().file
      if (nextFile) {
        const firstEp = nextFile.episodes[0]
        if (firstEp) {
          setActiveEpisode(firstEp.id)
          const firstBox = firstEp.plotBoxes[0]
          if (firstBox) setActivePlotBox(firstBox.id)
        }
        setScreen('workspace')
      }
      return
    }
    addOrUpdateRecent({
      path: filePath ?? undefined,
      title: file.project.title,
      episodeCount: file.episodes.length,
    })
    const firstEp = file.episodes[0]
    if (firstEp) {
      setActiveEpisode(firstEp.id)
      const firstBox = firstEp.plotBoxes[0]
      if (firstBox) setActivePlotBox(firstBox.id)
    }
    setScreen('workspace')
  }, [file, filePath, initProject, addOrUpdateRecent, setActiveEpisode, setActivePlotBox, setScreen])

  const handleOpenEpisode = useCallback(
    (episodeId: string) => {
      setActiveEpisode(episodeId)
      setScreen('workspace')
    },
    [setActiveEpisode, setScreen]
  )

  const handleOpenRecent = useCallback(
    async (entry: RecentProjectEntry) => {
      if (isDirty) {
        const result = await openUnsavedConfirmDialog()
        if (result === 'cancel') return
      }
      if (entry.path && isDesktop()) {
        setLoadingPath(entry.path)
        setFileOperationLoading('open')
        try {
          const loaded = await loadFromPath(entry.path)
          if (loaded) openProjectAndGo(loaded, entry.path)
          else setFileErrorMessage('파일을 열 수 없습니다.')
        } finally {
          setFileOperationLoading(null)
          setLoadingPath(null)
        }
      } else if (!isDesktop() && !entry.path) {
        // 웹: 이전 세션(로컬 저장소) 불러오기
        setFileOperationLoading('open')
        try {
          const loaded = loadFromLocalStorage()
          if (loaded) {
            openProjectAndGo(loaded, undefined)
            const { applyWorkspaceLayout } = useUIStore.getState()
            const layout = loaded.workspaceLayout ?? getDefaultWorkspaceLayout()
            applyWorkspaceLayout(layout)
          } else {
            setFileErrorMessage('저장된 세션이 없습니다.')
          }
        } finally {
          setFileOperationLoading(null)
        }
      } else {
        setFileOperationLoading('open')
        try {
          const opened = await openFromPath()
          if (opened) {
            const loaded = deserializeFile(opened.content)
            openProjectAndGo(loaded, opened.path || undefined)
          } else {
            setFileErrorMessage('파일을 열 수 없습니다.')
          }
        } finally {
          setFileOperationLoading(null)
        }
      }
    },
    [
      isDirty,
      openUnsavedConfirmDialog,
      openProjectAndGo,
      setFileOperationLoading,
      setFileErrorMessage,
    ]
  )

  const handleNewProject = useCallback(async () => {
    if (file && isDirty) {
      const result = await openUnsavedConfirmDialog()
      if (result === 'cancel') return
    }
    const existingTitles = useRecentProjectsStore.getState().entries.map((e) => e.title)
    initProject(getUniqueProjectTitle('새 프로젝트', existingTitles))
    useHistoryStore.getState().clear()
    const nextFile = useProjectStore.getState().file
    if (nextFile) {
      const firstEp = nextFile.episodes[0]
      if (firstEp) {
        setActiveEpisode(firstEp.id)
        const firstBox = firstEp.plotBoxes[0]
        if (firstBox) setActivePlotBox(firstBox.id)
      }
    }
    setScreen('workspace')
  }, [file, isDirty, openUnsavedConfirmDialog, initProject, setActiveEpisode, setActivePlotBox, setScreen])

  const handleOpenFile = useCallback(async () => {
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
        openProjectAndGo(loaded, opened.path || undefined)
        if (isDesktop() && opened.path && window.electron) window.electron.setLastOpenedPath(opened.path)
      } catch {
        setFileErrorMessage('파일을 열 수 없습니다.')
      }
    } finally {
      setFileOperationLoading(null)
    }
  }, [isDirty, openUnsavedConfirmDialog, openProjectAndGo, setFileOperationLoading, setFileErrorMessage])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const fromIndex = entries.findIndex((e) => e.id === active.id)
      const toIndex = entries.findIndex((e) => e.id === over.id)
      if (fromIndex !== -1 && toIndex !== -1) reorderRecent(fromIndex, toIndex)
    },
    [entries, reorderRecent]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const recentEpisodes =
    file?.episodes
      .map(ep => ({
        ...ep,
        projectTitle: file.project.title,
        updatedAt: file.project.updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6) ?? []

  return (
    <div className="h-full flex flex-col bg-background">
      <WindowTitleBar />
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        <div className="px-2 py-1 flex flex-col flex-1 min-h-0">
          {/* 툴바: 액션 + 정렬 (컴팩트) */}
          <div className="flex items-center gap-0.5 h-6 shrink-0 mb-1">
            <Tooltip content="새 프로젝트" side="bottom">
              <button
                type="button"
                onClick={handleNewProject}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="새 프로젝트"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </Tooltip>
            <Tooltip content="프로젝트 열기" side="bottom">
              <button
                type="button"
                onClick={handleOpenFile}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="프로젝트 열기"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            </Tooltip>
            <div className="flex-1 min-w-0" />
            <div className="flex items-center rounded border border-border/50 overflow-hidden">
              <SortModeButton active={sortMode === 'recent'} onClick={() => setSortMode('recent')} ariaLabel="최근순">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </SortModeButton>
              <SortModeButton active={sortMode === 'manual'} onClick={() => setSortMode('manual')} ariaLabel="수동순">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.5" />
                  <circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" />
                  <circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" />
                  <circle cx="15" cy="18" r="1.5" />
                </svg>
              </SortModeButton>
            </div>
          </div>

          {/* 좌: 프로젝트 목록 | 우: 에피소드 목록 */}
          <div className="flex gap-1.5 min-h-0 flex-1">
            {/* 프로젝트 */}
            <div className="min-w-0 flex-1 border border-border/50 rounded overflow-hidden flex flex-col">
              {file ? (
              <div className="flex items-center gap-1.5 w-full min-h-0 px-2 py-1 hover:bg-muted/30 transition-colors group shrink-0">
                <button
                  type="button"
                  onClick={handleOpenProject}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted-foreground">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="text-[11px] font-medium truncate">{file.project.title}</span>
                </button>
                <Tooltip content="전체보기" side="bottom">
                  <button
                    type="button"
                    onClick={() => {
                      if (file.episodes[0]) setActiveEpisode(file.episodes[0].id)
                      setScreen('workspace')
                      setFullViewOpen(true)
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    aria-label="전체보기"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
            ) : null}
              <div className="flex-1 min-h-0 overflow-auto">
                {entries.length > 0 ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                      <>
                        {entries.map((entry, i) => (
                          <RecentProjectRow
                            key={entry.id}
                            entry={entry}
                            loadingPath={loadingPath}
                            sortMode={sortMode}
                            onOpen={() => handleOpenRecent(entry)}
                            onRemove={() => removeRecent(entry.id)}
                            noTopBorder={!file && i === 0}
                          />
                        ))}
                      </>
                    </SortableContext>
                  </DndContext>
                ) : !file ? (
                  <div className="h-6 border-t border-dashed border-border/40" />
                ) : null}
              </div>
            </div>

            {/* 에피소드 */}
            <div className="min-w-0 flex-1 border border-border/50 rounded overflow-hidden flex flex-col">
              {recentEpisodes.length > 0 ? (
                <>
                  <div className="flex items-center justify-end px-1 py-0.5 border-b border-border/40 shrink-0">
                    <Tooltip content="워크스페이스" side="bottom">
                      <button
                        type="button"
                        onClick={handleOpenProject}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="워크스페이스"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                      </button>
                    </Tooltip>
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto">
                    {recentEpisodes.map((ep) => (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => handleOpenEpisode(ep.id)}
                        className="w-full text-left px-2 py-1 hover:bg-muted/40 transition-colors flex items-center gap-2 border-t border-border/30 first:border-t-0"
                      >
                        <span className="text-[10px] tabular-nums w-4 shrink-0 text-muted-foreground">
                          {String(ep.number).padStart(2, '0')}
                        </span>
                        <span className="text-[11px] flex-1 truncate">{ep.subtitle || '—'}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 min-h-[3rem] border-t border-dashed border-border/40" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SortModeButton({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean
  onClick: () => void
  ariaLabel: string
  children: React.ReactNode
}) {
  return (
    <Tooltip content={ariaLabel} side="bottom">
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(
          'p-0.5 transition-colors shrink-0',
          active
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function RecentProjectRow({
  entry,
  loadingPath,
  sortMode,
  onOpen,
  onRemove,
  noTopBorder,
}: {
  entry: RecentProjectEntry
  loadingPath: string | null
  sortMode: RecentSortMode
  onOpen: () => void
  onRemove: () => void
  noTopBorder?: boolean
}) {
  const canDrag = sortMode === 'manual'
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id, disabled: !canDrag })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const loading = loadingPath !== null && entry.path === loadingPath

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1.5 w-full text-left px-2 py-1 hover:bg-muted/40 transition-colors group',
        !noTopBorder && 'border-t border-border/40'
      )}
    >
      {canDrag && (
        <button
          type="button"
          className="p-0.5 rounded cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 touch-none shrink-0"
          aria-label="순서 변경"
          {...attributes}
          {...listeners}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={onOpen}
        disabled={loading}
        className="flex-1 min-w-0 flex items-center gap-2 text-left"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted-foreground">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-[11px] font-medium truncate">{entry.title}</span>
        {loading && (
          <span className="shrink-0 w-2.5 h-2.5 border border-muted-foreground border-t-transparent rounded-full animate-spin" />
        )}
      </button>
      <Tooltip content="제거" side="bottom">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 shrink-0"
          aria-label="제거"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </Tooltip>
    </div>
  )
}
