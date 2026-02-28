import { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore } from '@/store/ui/uiStore'
import { Tooltip } from '@/components/ui/Tooltip'

export function Header() {
  const isDirty = useProjectStore(state => state.isDirty)
  const leftPanelVisible = useUIStore(state => state.leftPanelVisible)
  const plotPanelVisible = useUIStore(state => state.plotPanelVisible)
  const scriptPanelVisible = useUIStore(state => state.scriptPanelVisible)
  const editorLayoutMode = useUIStore(state => state.editorLayoutMode)

  return (
    <header className="h-7 border-b border-border bg-[var(--panel-header)] flex items-center px-1 gap-0.5 select-none">
      {/* 사이드바 | 패널 | 레이아웃 | 보기/설정 (파일 관련은 타이틀 바 메뉴로 통일) */}
      <IconBtn
        onClick={() => useUIStore.getState().toggleLeftPanel()}
        title="사이드바"
        active={leftPanelVisible}
      >
        <rect x="3" y="3" width="7" height="18" rx="1" />
        <rect x="14" y="3" width="7" height="18" rx="1" />
      </IconBtn>
      <Sep />
      <IconBtn
        onClick={() => useUIStore.getState().togglePlotPanel()}
        title="플롯 패널"
        active={plotPanelVisible}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="12" y1="3" x2="12" y2="21" />
      </IconBtn>
      <IconBtn
        onClick={() => useUIStore.getState().toggleScriptPanel()}
        title="시나리오 패널"
        active={scriptPanelVisible}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
      </IconBtn>
      <IconBtn
        onClick={() => useUIStore.getState().setEditorLayoutMode(getNextHorizontalMode(editorLayoutMode))}
        title="좌우 레이아웃"
        ariaLabel={`좌우 레이아웃. ${layoutModeLabelMap[editorLayoutMode]}. 클릭 시 전환`}
        active={editorLayoutMode === 'horizontal' || editorLayoutMode === 'horizontal-reversed'}
      >
        <path d="M4 7h16M4 17h16" />
        <path d="M9 3 5 7l4 4" />
        <path d="m15 21 4-4-4-4" />
      </IconBtn>
      <IconBtn
        onClick={() => useUIStore.getState().setEditorLayoutMode(getNextVerticalMode(editorLayoutMode))}
        title="상하 레이아웃"
        ariaLabel={`상하 레이아웃. ${layoutModeLabelMap[editorLayoutMode]}. 클릭 시 전환`}
        active={editorLayoutMode === 'vertical' || editorLayoutMode === 'vertical-reversed'}
      >
        <path d="M7 4v16M17 4v16" />
        <path d="M3 15 L7 19 L11 15" />
        <path d="M13 9 L17 5 L21 9" />
      </IconBtn>
      <div className="flex-1 min-w-0" />
      <Sep />
      <IconBtn onClick={() => useUIStore.getState().setFullViewOpen(true)} title="전체보기">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      </IconBtn>
      <IconBtn onClick={() => useUIStore.getState().setExportDialogOpen(true)} title="내보내기 형식">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5-5 5 5M12 15V3" />
      </IconBtn>
      <IconBtn onClick={() => useUIStore.getState().setFormatDialogOpen(true)} title="서식">
        <line x1="21" y1="10" x2="7" y2="10" />
        <line x1="21" y1="6" x2="3" y2="6" />
        <line x1="21" y1="14" x2="3" y2="14" />
        <line x1="21" y1="18" x2="7" y2="18" />
      </IconBtn>
      <IconBtn onClick={() => useUIStore.getState().setSettingsDialogOpen(true)} title="설정">
        <circle cx="12" cy="12" r="3" />
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      </IconBtn>
      {isDirty && <span className="w-1 h-1 rounded-full bg-foreground/60 ml-0.5 shrink-0" aria-label="저장되지 않음" />}
    </header>
  )
}

const layoutModeLabelMap = {
  horizontal: '좌우',
  'horizontal-reversed': '좌우 반전',
  vertical: '상하',
  'vertical-reversed': '상하 반전',
} as const

function getNextHorizontalMode(mode: keyof typeof layoutModeLabelMap): keyof typeof layoutModeLabelMap {
  if (mode === 'horizontal') return 'horizontal-reversed'
  if (mode === 'horizontal-reversed') return 'horizontal'
  return 'horizontal'
}

function getNextVerticalMode(mode: keyof typeof layoutModeLabelMap): keyof typeof layoutModeLabelMap {
  if (mode === 'vertical') return 'vertical-reversed'
  if (mode === 'vertical-reversed') return 'vertical'
  return 'vertical'
}

function IconBtn({ children, onClick, onDoubleClick, title, disabled, active, dimmed, ariaLabel }: {
  children: React.ReactNode
  onClick?: () => void
  onDoubleClick?: () => void
  title?: string
  disabled?: boolean
  active?: boolean
  dimmed?: boolean
  ariaLabel?: string
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!onDoubleClick || onClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onDoubleClick()
    }
  }

  const btn = (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={ariaLabel ?? title}
      className={`w-6 h-6 flex items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        dimmed ? 'opacity-60 text-muted-foreground' : ''
      } ${
        !dimmed && (active
          ? 'text-foreground hover:bg-muted'
          : disabled
            ? 'text-muted-foreground/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted')
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
  if (title) {
    return <Tooltip content={title} side="bottom">{btn}</Tooltip>
  }
  return btn
}

function Sep() {
  return <div className="h-2.5 w-px bg-border mx-0.5 shrink-0" />
}
