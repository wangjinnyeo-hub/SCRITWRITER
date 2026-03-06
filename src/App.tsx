import { useEffect, useLayoutEffect } from 'react'
import { AppLayout } from './WebAppLayout'
import { WorkspaceLayout } from './core/components/layout/WorkspaceLayout'
import { useUIStore } from './core/store/ui/uiStore'
import { useSettingsStore } from './core/store/settings/settingsStore'
import { useKeyboardShortcuts } from './core/hooks/useKeyboardShortcuts'
import { useWebAutoSave } from './useWebAutoSave'
import { getSavedThemeId, applyTheme, builtinThemes } from './core/lib/themeSystem'
import { useProjectStore } from './core/store/project/projectStore'

function App() {
  const setActiveThemeId = useUIStore(state => state.setActiveThemeId)
  const uiScalePercent = useSettingsStore(state => state.uiScalePercent)

  useKeyboardShortcuts()
  useWebAutoSave()

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

  // UI 배율(90~150%): 본 프로그램과 동일하게 document 루트에 zoom 적용
  useLayoutEffect(() => {
    const percent = Math.min(150, Math.max(90, uiScalePercent))
    const zoom = percent / 100
    const root = document.documentElement
    root.style.zoom = String(zoom)
    return () => {
      root.style.zoom = ''
    }
  }, [uiScalePercent])

  const zoom = Math.min(150, Math.max(90, uiScalePercent)) / 100
  const rootSize =
    zoom > 0 && zoom !== 1
      ? { width: `calc(100vw / ${zoom})`, height: `calc(100dvh / ${zoom})`, minWidth: `calc(100vw / ${zoom})`, minHeight: `calc(100dvh / ${zoom})` }
      : undefined

  return (
    <div
      className="app-zoom-root flex flex-col overflow-hidden h-full min-h-0"
      style={rootSize ?? { height: '100%', width: '100%', minHeight: '100dvh' }}
    >
      <div className="flex-1 min-h-0 flex flex-col">
        <AppLayout>
          <WorkspaceLayout />
        </AppLayout>
      </div>
    </div>
  )
}

export default App
