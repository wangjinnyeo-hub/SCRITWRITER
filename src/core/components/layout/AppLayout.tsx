import type { ReactNode } from 'react'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { WindowTitleBar } from './WindowTitleBar'
import { Header } from './Header'
import { Sidebar } from './sidebars/Sidebar'
import { StatusBar } from './StatusBar'
import { useUIStore } from '@/store/ui/uiStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { FormatDialog } from '@/components/format/FormatDialog'
import { CharacterManager } from '@/components/character/CharacterManager'

/** 화면(모니터) 대비 창 너비 비율. 이 비율 이하로 좁혀졌을 때만 패널 숨김 트리거. (너무 이르게 트리거되지 않도록) */
const RATIO_ALL = 0.7
const RATIO_SCRIPT_HIDE = 0.55
const RATIO_PLOT_HIDE = 0.4
const RATIO_SIDEBAR_HIDE = 0.28
const HEIGHT_STATUSBAR_HIDE = 600

/** 상하/좌우 최소 (Electron setMinimumSize 등용). */
const MIN_WINDOW_HEIGHT_PX = 32 + 28 + 8 + 72
const SIDEBAR_MIN_PX = 180
const MIN_WINDOW_WIDTH_PX = Math.round(SIDEBAR_MIN_PX / 0.12)

const SettingsDialog = lazy(() => import('@/components/settings/SettingsDialog').then(m => ({ default: m.SettingsDialog })))
const DefaultSettingsDialog = lazy(() => import('@/components/settings/SettingsDialog').then(m => ({ default: m.DefaultSettingsDialog })))
const ExportDialog = lazy(() => import('@/components/export/ExportDialog').then(m => ({ default: m.ExportDialog })))
const UnifiedFullView = lazy(() => import('@/components/viewer/UnifiedFullView').then(m => ({ default: m.UnifiedFullView })))
import { UnsavedConfirmDialog } from '@/components/dialogs/UnsavedConfirmDialog'
import { HelpDialog } from '@/components/dialogs/HelpDialog'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const uiScalePercent = useSettingsStore(state => state.uiScalePercent)
  const leftPanelVisible = useUIStore(state => state.leftPanelVisible)
  const plotPanelVisible = useUIStore(state => state.plotPanelVisible)
  const scriptPanelVisible = useUIStore(state => state.scriptPanelVisible)
  const statusBarVisible = useUIStore(state => state.statusBarVisible)
  const setLeftPanelVisible = useUIStore(state => state.setLeftPanelVisible)
  const setPlotPanelVisible = useUIStore(state => state.setPlotPanelVisible)
  const setScriptPanelVisible = useUIStore(state => state.setScriptPanelVisible)
  const setStatusBarVisible = useUIStore(state => state.setStatusBarVisible)
  const settingsDialogOpen = useUIStore(state => state.settingsDialogOpen)
  const settingsInitialSection = useUIStore(state => state.settingsInitialSection)
  const defaultSettingsDialogOpen = useUIStore(state => state.defaultSettingsDialogOpen)
  const formatDialogOpen = useUIStore(state => state.formatDialogOpen)
  const exportDialogOpen = useUIStore(state => state.exportDialogOpen)
  const characterManagerOpen = useUIStore(state => state.characterManagerOpen)
  const fullViewOpen = useUIStore(state => state.fullViewOpen)
  const helpDialogOpen = useUIStore(state => state.helpDialogOpen)
  const activeEpisodeId = useUIStore(state => state.activeEpisodeId)
  const lastExportEpisodeId = useUIStore(state => state.lastExportEpisodeId)
  const lastExportSelectedPlotBoxIds = useUIStore(state => state.lastExportSelectedPlotBoxIds)
  const lastExportIncludeProperties = useUIStore(state => state.lastExportIncludeProperties)
  const hasSyncedExportContext = Boolean(lastExportEpisodeId && (fullViewOpen || (activeEpisodeId && lastExportEpisodeId === activeEpisodeId)))

  // 좁아질 때만 시나리오 → 플롯 → 사이드바 순 숨김. 확대 시에는 사용자 패널 상태 유지(트리거 무효화).
  const wideLeftRef = useRef(leftPanelVisible)
  const widePlotRef = useRef(plotPanelVisible)
  const wideScriptRef = useRef(scriptPanelVisible)
  const wideStatusRef = useRef(statusBarVisible)
  const prevSizeRef = useRef<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const zoom = Math.max(0.01, uiScalePercent / 100)
    const getEffective = () => {
      if (typeof window === 'undefined') return { w: 2000, h: 1000, screenW: 1920, screenH: 1080 }
      const screenW = (window.screen?.width ?? 1920) / zoom
      const screenH = (window.screen?.height ?? 1080) / zoom
      return {
        w: window.innerWidth / zoom,
        h: window.innerHeight / zoom,
        screenW,
        screenH,
      }
    }
    const apply = () => {
      const state = useUIStore.getState()
      if (state.fullViewOpen) return
      const { w, h, screenW, screenH } = getEffective()
      const prev = prevSizeRef.current
      prevSizeRef.current = { w, h }
      const editorLayoutMode = state.editorLayoutMode
      const isHorizontalMode = editorLayoutMode === 'horizontal' || editorLayoutMode === 'horizontal-reversed'
      const isVerticalMode = editorLayoutMode === 'vertical' || editorLayoutMode === 'vertical-reversed'

      let isWidening: boolean
      let isWideAll: boolean
      let isWideScript: boolean
      let isWidePlot: boolean
      if (isHorizontalMode) {
        isWidening = prev != null && w > prev.w
        const widthAll = screenW * RATIO_ALL
        const widthScriptHide = screenW * RATIO_SCRIPT_HIDE
        const widthPlotHide = screenW * RATIO_PLOT_HIDE
        isWideAll = w >= widthAll
        isWideScript = w >= widthScriptHide
        isWidePlot = w >= widthPlotHide
      } else if (isVerticalMode) {
        isWidening = prev != null && h > prev.h
        const heightAll = screenH * RATIO_ALL
        const heightScriptHide = screenH * RATIO_SCRIPT_HIDE
        const heightPlotHide = screenH * RATIO_PLOT_HIDE
        isWideAll = h >= heightAll
        isWideScript = h >= heightScriptHide
        isWidePlot = h >= heightPlotHide
      } else {
        isWidening = true
        isWideAll = true
        isWideScript = true
        isWidePlot = true
      }
      const isNarrowHeight = h < HEIGHT_STATUSBAR_HIDE

      if (h >= HEIGHT_STATUSBAR_HIDE) wideStatusRef.current = state.statusBarVisible
      if (isWideAll) {
        wideLeftRef.current = state.leftPanelVisible
        widePlotRef.current = state.plotPanelVisible
        wideScriptRef.current = state.scriptPanelVisible
      } else if (isWideScript) {
        wideLeftRef.current = state.leftPanelVisible
        widePlotRef.current = state.plotPanelVisible
      } else if (isWidePlot) {
        wideLeftRef.current = state.leftPanelVisible
      }

      if (isWidening) {
        // 확대 중: 패널 가시성 건드리지 않음. 사용자가 연 패널 유지.
      } else {
        if (isWideAll) {
          setLeftPanelVisible(wideLeftRef.current)
          setPlotPanelVisible(widePlotRef.current)
          setScriptPanelVisible(wideScriptRef.current)
        } else if (isWideScript) {
          setLeftPanelVisible(wideLeftRef.current)
          setPlotPanelVisible(widePlotRef.current)
          setScriptPanelVisible(false)
        } else if (isWidePlot) {
          setLeftPanelVisible(wideLeftRef.current)
          setPlotPanelVisible(false)
          setScriptPanelVisible(false)
        } else {
          setLeftPanelVisible(false)
          setPlotPanelVisible(false)
          setScriptPanelVisible(true)
        }
      }

      if (isNarrowHeight) setStatusBarVisible(false)
      else setStatusBarVisible(wideStatusRef.current)
    }
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [uiScalePercent, fullViewOpen, setLeftPanelVisible, setPlotPanelVisible, setScriptPanelVisible, setStatusBarVisible])

  const showFullView = fullViewOpen && activeEpisodeId

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <WindowTitleBar />
      {/* exe 전체보기: fullscreen API 미사용. 타이틀바 유지, 콘텐츠는 타이틀바 아래만 표시. */}
      {showFullView ? (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Suspense fallback={null}>
            <UnifiedFullView episodeId={activeEpisodeId!} onClose={() => useUIStore.getState().closeFullView()} />
          </Suspense>
        </div>
      ) : (
        <>
          <Header />
          <div className="flex-1 min-h-0 overflow-hidden">
            <ResizablePanelGroup direction="horizontal">
              {leftPanelVisible && (
                <>
                  <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
                    <Sidebar />
                  </ResizablePanel>
                  <ResizableHandle />
                </>
              )}
              <ResizablePanel defaultSize={leftPanelVisible ? 82 : 100}>
                {children}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
          {statusBarVisible && <StatusBar />}
        </>
      )}

      {settingsDialogOpen && (
        <Suspense fallback={null}>
          <SettingsDialog
            open={settingsDialogOpen}
            onClose={() => useUIStore.getState().setSettingsDialogOpen(false)}
            initialSection={settingsInitialSection as 'general' | 'terminology' | 'shortcuts' | 'directions' | undefined}
          />
        </Suspense>
      )}
      {defaultSettingsDialogOpen && (
        <Suspense fallback={null}>
          <DefaultSettingsDialog
            open={defaultSettingsDialogOpen}
            onClose={() => useUIStore.getState().setDefaultSettingsDialogOpen(false)}
          />
        </Suspense>
      )}
      <FormatDialog open={formatDialogOpen} onClose={() => useUIStore.getState().setFormatDialogOpen(false)} />
      {exportDialogOpen && (
        <Suspense fallback={null}>
          <ExportDialog
            open={exportDialogOpen}
            onClose={() => useUIStore.getState().setExportDialogOpen(false)}
            episodeIdOverride={hasSyncedExportContext ? (lastExportEpisodeId ?? undefined) : undefined}
            initialSelectedPlotBoxIds={hasSyncedExportContext ? lastExportSelectedPlotBoxIds : undefined}
            initialIncludeProperties={hasSyncedExportContext ? (lastExportIncludeProperties ?? undefined) : undefined}
          />
        </Suspense>
      )}
      <CharacterManager open={characterManagerOpen} onClose={() => useUIStore.getState().setCharacterManagerOpen(false)} />
      <UnsavedConfirmDialog />
      <HelpDialog open={helpDialogOpen} onClose={() => useUIStore.getState().setHelpDialogOpen(false)} />
    </div>
  )
}
