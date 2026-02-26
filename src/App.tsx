import { useEffect } from 'react'
import { AppLayout } from './WebAppLayout'
import { WorkspaceLayout } from './core/components/layout/WorkspaceLayout'
import { useUIStore } from './core/store/ui/uiStore'
import { useKeyboardShortcuts } from './core/hooks/useKeyboardShortcuts'
import { useWebAutoSave } from './useWebAutoSave'
import { getSavedThemeId, applyTheme, builtinThemes } from './core/lib/themeSystem'
import { useProjectStore } from './core/store/project/projectStore'

function App() {
  const setActiveThemeId = useUIStore(state => state.setActiveThemeId)

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

  return (
    <div className="flex flex-col overflow-hidden h-full min-h-0" style={{ height: '100%', width: '100%', minHeight: '100dvh' }}>
      <AppLayout>
        <WorkspaceLayout />
      </AppLayout>
    </div>
  )
}

export default App
