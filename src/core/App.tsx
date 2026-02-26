import { useEffect, useLayoutEffect, useRef } from 'react'
import { MainScreen } from './components/screens/MainScreen'
import { AppLayout } from './components/layout/AppLayout'
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout'
import { useUIStore } from '@/store/ui/uiStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { useProjectStore } from '@/store/project/projectStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAutoSave } from '@/hooks/useAutoSave'
import { getSavedThemeId, applyTheme, builtinThemes } from '@/lib/themeSystem'

function logZoomLayout(origin: string, zoom: number, rootEl: HTMLDivElement | null) {
  const winW = window.innerWidth
  const winH = window.innerHeight
  const htmlZoom = parseFloat(getComputedStyle(document.documentElement).zoom || '1')
  const rootRect = rootEl?.getBoundingClientRect()
  fetch('http://127.0.0.1:7242/ingest/88c5408a-5008-4939-ac01-c6dc3fd592a0', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b4e779' },
    body: JSON.stringify({
      sessionId: 'b4e779',
      runId: 'zoom-layout',
      hypothesisId: 'H1-H5',
      location: 'App.tsx:logZoomLayout',
      message: 'Window vs root vs zoom',
      data: {
        origin,
        zoomFromStore: zoom,
        htmlZoomComputed: htmlZoom,
        windowInner: { w: winW, h: winH },
        rootRect: rootRect ? { w: rootRect.width, h: rootRect.height, top: rootRect.top, left: rootRect.left } : null,
        rootMatchesWindow: rootRect ? Math.abs(rootRect.height - winH) < 2 && Math.abs(rootRect.width - winW) < 2 : false,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
}

function App() {
  const currentScreen = useUIStore(state => state.currentScreen)
  const setActiveThemeId = useUIStore(state => state.setActiveThemeId)
  const uiScalePercent = useSettingsStore(state => state.uiScalePercent)
  const appZoomRootRef = useRef<HTMLDivElement>(null)

  useKeyboardShortcuts()
  useAutoSave()

  useEffect(() => {
    ;(window as Window & { __getIsDirty?: () => boolean }).__getIsDirty = () =>
      useProjectStore.getState().isDirty
    return () => {
      delete (window as Window & { __getIsDirty?: () => boolean }).__getIsDirty
    }
  }, [])

  useEffect(() => {
    const savedId = getSavedThemeId()
    if (savedId) {
      const theme = builtinThemes.find(t => t.id === savedId)
      if (theme) {
        applyTheme(theme)
        setActiveThemeId(savedId)
      }
    }
  }, [setActiveThemeId])

  // 배율을 document 루트(html)에 적용 — 설정·미리보기·서식·대시보드 등 전체 UI 통일
  useLayoutEffect(() => {
    const zoom = uiScalePercent / 100
    const root = document.documentElement
    root.style.zoom = String(zoom)
    return () => {
      root.style.zoom = ''
    }
  }, [uiScalePercent])

  // #region agent log
  useLayoutEffect(() => {
    const zoom = uiScalePercent / 100
    logZoomLayout('zoom-change', zoom, appZoomRootRef.current)
  }, [uiScalePercent])
  useEffect(() => {
    const zoom = uiScalePercent / 100
    const onResize = () => logZoomLayout('resize', zoom, appZoomRootRef.current)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [uiScalePercent])
  // #endregion

  const zoom = uiScalePercent / 100
  const content =
    currentScreen === 'main' ? (
      <MainScreen />
    ) : (
      <AppLayout>
        <WorkspaceLayout />
      </AppLayout>
    )

  // 창 기준: 루트 레이아웃을 viewport/zoom으로 두어, zoom 적용 후 항상 창을 채우도록 함 (zoom≠1일 때만)
  const rootSize =
    zoom > 0 && zoom !== 1
      ? { width: `calc(100vw / ${zoom})`, height: `calc(100dvh / ${zoom})`, minWidth: `calc(100vw / ${zoom})`, minHeight: `calc(100dvh / ${zoom})` }
      : undefined

  return (
    <div
      ref={appZoomRootRef}
      className="app-zoom-root flex flex-col overflow-hidden h-full min-h-0"
      style={rootSize ?? { height: '100%', width: '100%', minHeight: '100dvh' }}
    >
      <div className="flex-1 min-h-0 flex flex-col">
        {content}
      </div>
    </div>
  )
}

export default App
