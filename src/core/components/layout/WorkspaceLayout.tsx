import { useCallback, useEffect, useMemo } from 'react'
import { PlotEditor } from '@/components/editor/PlotEditor'
import { WorkspaceDndWrapper } from '@/components/layout/WorkspaceDndWrapper'
import { ScriptEditor } from '@/components/editor/ScriptEditor'
import { useUIStore } from '@/store/ui/uiStore'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import type { EditorLayoutMode } from '@/types'

const WORKSPACE_LAYOUT_KEY = 'script-writer-workspace-panel-layout'
const DEFAULT_PANEL_SIZES = [50, 50] as const

function getStoredLayout(mode: string): number[] | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(`${WORKSPACE_LAYOUT_KEY}-${mode}`)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as number[]
    if (Array.isArray(parsed) && parsed.length >= 2) return parsed
  } catch {
    // ignore
  }
  return undefined
}

function saveLayout(mode: string, sizes: number[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${WORKSPACE_LAYOUT_KEY}-${mode}`, JSON.stringify(sizes))
  } catch {
    // ignore
  }
}

export function WorkspaceLayout() {
  const activeEpisodeId = useUIStore(state => state.activeEpisodeId)
  const plotPanelVisible = useUIStore(state => state.plotPanelVisible)
  const scriptPanelVisible = useUIStore(state => state.scriptPanelVisible)
  const editorLayoutMode = useUIStore(state => state.editorLayoutMode)
  const workspacePanelSizes = useUIStore(state => state.workspacePanelSizes)
  const horizontalLayoutKey = useUIStore(state => state.horizontalLayoutKey)
  const setWorkspacePanelSizes = useUIStore(state => state.setWorkspacePanelSizes)
  const bothVisible = plotPanelVisible && scriptPanelVisible
  const noneVisible = !plotPanelVisible && !scriptPanelVisible

  const defaultLayoutByMode = useMemo(() => {
    const fallback = (mode: EditorLayoutMode) =>
      workspacePanelSizes[mode] ?? getStoredLayout(mode) ?? [...DEFAULT_PANEL_SIZES]
    return {
      vertical: fallback('vertical'),
      'vertical-reversed': fallback('vertical-reversed'),
      horizontal: fallback('horizontal'),
      'horizontal-reversed': fallback('horizontal-reversed'),
    }
  }, [workspacePanelSizes])

  const onLayoutSave = useCallback(
    (mode: EditorLayoutMode) => (sizes: number[]) => {
      saveLayout(mode, sizes)
      setWorkspacePanelSizes(mode, sizes)
    },
    [setWorkspacePanelSizes]
  )

  // #region agent log
  useEffect(() => {
    if (editorLayoutMode === 'horizontal') {
      fetch('http://127.0.0.1:7242/ingest/88c5408a-5008-4939-ac01-c6dc3fd592a0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8468c1'},body:JSON.stringify({sessionId:'8468c1',location:'WorkspaceLayout.tsx:horizontal',message:'horizontal mode active',data:{editorLayoutMode,horizontalSizes:defaultLayoutByMode.horizontal},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
    }
  }, [editorLayoutMode, defaultLayoutByMode.horizontal])
  // #endregion

  return (
    <>
      <div className="h-full overflow-hidden">
        {!activeEpisodeId ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[11px] text-muted-foreground/40">에피소드를 선택하세요</p>
          </div>
        ) : noneVisible ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[11px] text-muted-foreground/40">패널을 활성화하세요</p>
          </div>
        ) : bothVisible ? (
          <WorkspaceDndWrapper episodeId={activeEpisodeId}>
          {editorLayoutMode === 'vertical' ? (
            <ResizablePanelGroup direction="vertical" id="workspace-vertical" onLayout={onLayoutSave('vertical')}>
              <ResizablePanel defaultSize={defaultLayoutByMode.vertical[0]} minSize={16} className="min-w-0 min-h-0">
                <PlotEditor episodeId={activeEpisodeId} layoutMode="vertical" useExternalDndContext />
              </ResizablePanel>
              <ResizableHandle direction="vertical" />
              <ResizablePanel defaultSize={defaultLayoutByMode.vertical[1]} minSize={12} className="min-w-0 min-h-0">
                <ScriptEditor episodeId={activeEpisodeId} layoutMode="vertical" useExternalDndContext />
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : editorLayoutMode === 'vertical-reversed' ? (
            <ResizablePanelGroup direction="vertical" id="workspace-vertical-reversed" onLayout={onLayoutSave('vertical-reversed')}>
              <ResizablePanel defaultSize={defaultLayoutByMode['vertical-reversed'][0]} minSize={10} className="min-w-0 min-h-0">
                <ScriptEditor episodeId={activeEpisodeId} layoutMode="vertical" useExternalDndContext />
              </ResizablePanel>
              <ResizableHandle direction="vertical" />
              <ResizablePanel defaultSize={defaultLayoutByMode['vertical-reversed'][1]} minSize={16} className="min-w-0 min-h-0">
                <PlotEditor episodeId={activeEpisodeId} layoutMode="vertical" useExternalDndContext />
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : editorLayoutMode === 'horizontal-reversed' ? (
            <ResizablePanelGroup direction="horizontal" id="workspace-horizontal-reversed" onLayout={onLayoutSave('horizontal-reversed')}>
              <ResizablePanel defaultSize={defaultLayoutByMode['horizontal-reversed'][0]} minSize={12} className="min-w-0 min-h-0">
                <ScriptEditor episodeId={activeEpisodeId} useExternalDndContext />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={defaultLayoutByMode['horizontal-reversed'][1]} minSize={3} className="min-w-0 min-h-0">
                <PlotEditor episodeId={activeEpisodeId} layoutMode="horizontal" useExternalDndContext />
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <ResizablePanelGroup key={`workspace-horizontal-${horizontalLayoutKey}`} direction="horizontal" id="workspace-horizontal" onLayout={onLayoutSave('horizontal')}>
              <ResizablePanel defaultSize={defaultLayoutByMode.horizontal[0]} minSize={3} className="min-w-0 min-h-0">
                <PlotEditor episodeId={activeEpisodeId} layoutMode="horizontal" useExternalDndContext />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={defaultLayoutByMode.horizontal[1]} minSize={12} className="min-w-0 min-h-0">
                <ScriptEditor episodeId={activeEpisodeId} useExternalDndContext />
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
          </WorkspaceDndWrapper>
        ) : plotPanelVisible ? (
          <PlotEditor episodeId={activeEpisodeId} />
        ) : (
          <ScriptEditor episodeId={activeEpisodeId} />
        )}
      </div>
    </>
  )
}
