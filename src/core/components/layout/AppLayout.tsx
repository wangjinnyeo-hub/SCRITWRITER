import type { ReactNode } from 'react'
import { lazy, Suspense } from 'react'
import { WindowTitleBar } from './WindowTitleBar'
import { Header } from './Header'
import { Sidebar } from './sidebars/Sidebar'
import { StatusBar } from './StatusBar'
import { useUIStore } from '@/store/ui/uiStore'
import { FormatDialog } from '@/components/format/FormatDialog'
import { CharacterManager } from '@/components/character/CharacterManager'

const SettingsDialog = lazy(() => import('@/components/settings/SettingsDialog').then(m => ({ default: m.SettingsDialog })))
const DefaultSettingsDialog = lazy(() => import('@/components/settings/SettingsDialog').then(m => ({ default: m.DefaultSettingsDialog })))
const ExportDialog = lazy(() => import('@/components/export/ExportDialog').then(m => ({ default: m.ExportDialog })))
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
  const leftPanelVisible = useUIStore(state => state.leftPanelVisible)
  const statusBarVisible = useUIStore(state => state.statusBarVisible)
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

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <WindowTitleBar />
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
