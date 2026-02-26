import { useState, useEffect } from 'react'
import { isDesktop } from '@/lib/fileIO'
import { TitleBarMenu } from './TitleBarMenu'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore } from '@/store/ui/uiStore'

/** 맨 위 한 줄: 파일·환경설정 등 메뉴 + 중앙(프로젝트/에피소드). exe일 때 오른쪽에 최소/최대/닫기 버튼. */
export function WindowTitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const desktop = isDesktop() && typeof window.electron !== 'undefined'
  const currentScreen = useUIStore(state => state.currentScreen)
  const file = useProjectStore(state => state.file)
  const activeEpisodeId = useUIStore(state => state.activeEpisodeId)
  const activeEpisode = file?.episodes.find(e => e.id === activeEpisodeId)

  useEffect(() => {
    if (typeof window.electron?.windowIsMaximized !== 'function') return
    window.electron.windowIsMaximized().then(setIsMaximized)
  }, [])

  const handleMinimize = () => window.electron?.windowMinimize()
  const handleMaximize = () => {
    if (!window.electron) return
    if (isMaximized) {
      window.electron.windowUnmaximize()
      setIsMaximized(false)
    } else {
      window.electron.windowMaximize()
      setIsMaximized(true)
    }
  }
  const handleClose = () => window.electron?.windowClose()

  const centerLabel =
    currentScreen !== 'main' && file
      ? activeEpisode
        ? `${file.project.title} / ${String(activeEpisode.number).padStart(2, '0')}${activeEpisode.subtitle ? ` ${activeEpisode.subtitle}` : ''}`
        : file.project.title
      : 'Script Writer'

  useEffect(() => {
    document.title = centerLabel
    if (typeof window.electron?.setWindowTitle === 'function') {
      window.electron.setWindowTitle(centerLabel)
    }
  }, [centerLabel])

  return (
    <div className="h-8 flex items-center flex-shrink-0 bg-[var(--panel-header)] window-drag-region pl-2 pr-2 overflow-visible border-b border-border">
      <div className="flex items-center shrink-0 min-w-0">
        <TitleBarMenu />
      </div>
      <div className="flex-1 min-w-0 flex justify-center overflow-hidden">
        <span className="text-[11px] text-muted-foreground truncate px-2" title={centerLabel}>
          {centerLabel}
        </span>
      </div>
      {desktop ? (
        <div className="flex items-stretch h-full shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            type="button"
            onClick={handleMinimize}
            className="w-11 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="최소화"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            className="w-11 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={isMaximized ? '복원' : '최대화'}
          >
            {isMaximized ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 0 2-2v-3" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="w-11 h-full flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
            aria-label="닫기"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  )
}
