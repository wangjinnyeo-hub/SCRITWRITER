import { create } from 'zustand'
import type { EditorLayoutMode, WorkspaceLayoutState } from '@/types'
import type { ExportIncludeOptions } from '@/lib/scriptEngine/types'

const EDITOR_LAYOUT_MODES: EditorLayoutMode[] = ['horizontal', 'horizontal-reversed', 'vertical', 'vertical-reversed']

function defaultPanelSizes(): Record<EditorLayoutMode, number[]> {
  const fiftyFifty = [50, 50]
  return Object.fromEntries(EDITOR_LAYOUT_MODES.map(m => [m, fiftyFifty])) as Record<EditorLayoutMode, number[]>
}

/** 새 파일/프로젝트용 기본 워크스페이스 레이아웃 (에피소드·시나리오 창 반반). 파일을 열 때마다 1단계로 시작하는 것은 load/init 시점에 별도 적용 */
export function getDefaultWorkspaceLayout(): WorkspaceLayoutState {
  return {
    editorLayoutMode: 'horizontal',
    leftPanelVisible: true,
    plotPanelVisible: true,
    scriptPanelVisible: true,
    plotContentVisible: true,
    panelSizes: defaultPanelSizes(),
  }
}

type Screen = 'main' | 'workspace'

interface UIState {
  currentScreen: Screen
  activeEpisodeId: string | null
  activePlotBoxId: string | null
  /** 선택(하이라이트): Ctrl+클릭·Shift+클릭·더블클릭으로만 변경. 단일 클릭으로는 변경 안 함. */
  selectedPlotBoxIds: string[]
  /** 확정(시나리오 표시): 더블클릭·Enter로만 변경. 선택과 독립. */
  confirmedPlotBoxIds: string[]
  leftPanelVisible: boolean
  plotPanelVisible: boolean
  scriptPanelVisible: boolean
  plotContentVisible: boolean
  editorLayoutMode: EditorLayoutMode
  /** 모드별 워크스페이스 패널 비율 (파일 저장 시 함께 저장) */
  workspacePanelSizes: Record<EditorLayoutMode, number[]>
  /** horizontal 진입 시마다 증가 → PanelGroup key로 사용해 1단계→기본 전환 시 defaultSize 확실 적용 */
  horizontalLayoutKey: number
  commandPaletteOpen: boolean
  statusBarVisible: boolean
  settingsDialogOpen: boolean
  settingsInitialSection: string | null
  formatDialogOpen: boolean
  exportDialogOpen: boolean
  characterManagerOpen: boolean
  fullViewOpen: boolean
  activeThemeId: string
  lastExportEpisodeId: string | null
  lastExportSelectedPlotBoxIds: string[]
  lastExportIncludeProperties: Partial<ExportIncludeOptions> | null
  requestScenarioFocus: (() => void) | null
  /** 시나리오창에서 해당 플롯 세그먼트 상단으로 스크롤 요청 (플롯 스트립 트리거용) */
  scrollToPlotBoxId: string | null
  /** 스크립트 유닛 선택(드래그 선택·Shift클릭·멀티 선택). Workspace DnD에서 사용. */
  selectedScriptUnitIds: string[]
  /** 스크립트 이동 후 해당 플롯 최초 열람 시 미리 선택할 unit ids. plotBoxId -> unitIds */
  lastMovedScriptUnitIdsByPlot: Record<string, string[]>
  unsavedConfirmDialogOpen: boolean
  unsavedConfirmResolve: ((result: 'save' | 'discard' | 'cancel') => void) | null
  /** 파일 저장/열기 실패 시 메시지 (데스크톱). 표시 후 clear. */
  fileErrorMessage: string | null
  /** 파일 열기/저장 진행 중 여부. StatusBar 등에서 "열기 중..." / "저장 중..." 표시용. */
  fileOperationLoading: 'open' | 'save' | null

  setScreen: (screen: Screen) => void
  setFileErrorMessage: (msg: string | null) => void
  setFileOperationLoading: (value: 'open' | 'save' | null) => void
  setRequestScenarioFocus: (fn: (() => void) | null) => void
  setScrollToPlotBoxId: (id: string | null) => void
  setActiveEpisode: (id: string | null) => void
  setActivePlotBox: (id: string | null) => void
  setSelectedPlotBoxIds: (idsOrUpdater: string[] | ((prev: string[]) => string[])) => void
  setConfirmedPlotBoxIds: (idsOrUpdater: string[] | ((prev: string[]) => string[])) => void
  toggleLeftPanel: () => void
  togglePlotPanel: () => void
  toggleScriptPanel: () => void
  setPlotContentVisible: (visible: boolean) => void
  togglePlotContentVisible: () => void
  setEditorLayoutMode: (mode: EditorLayoutMode) => void
  setWorkspacePanelSizes: (mode: EditorLayoutMode, sizes: number[]) => void
  /** 현재 UI 상태를 파일 저장용 스냅샷으로 반환 */
  getWorkspaceLayoutSnapshot: () => WorkspaceLayoutState
  /** 파일에서 불러온 레이아웃을 UI에 적용 (파일 열 때) */
  applyWorkspaceLayout: (layout: WorkspaceLayoutState) => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  toggleStatusBar: () => void
  /** 열 때 특정 탭으로 열기: setSettingsDialogOpen(true, 'shortcuts') */
  setSettingsDialogOpen: (open: boolean, initialSection?: string) => void
  defaultSettingsDialogOpen: boolean
  setDefaultSettingsDialogOpen: (open: boolean) => void
  setFormatDialogOpen: (open: boolean) => void
  setExportDialogOpen: (open: boolean) => void
  setCharacterManagerOpen: (open: boolean) => void
  setFullViewOpen: (open: boolean) => void
  closeFullView: () => void
  helpDialogOpen: boolean
  setHelpDialogOpen: (open: boolean) => void
  setActiveThemeId: (id: string) => void
  setSelectedScriptUnitIds: (idsOrUpdater: string[] | ((prev: string[]) => string[])) => void
  /** 플롯·스크립트 선택 모두 해제 */
  clearAllSelection: () => void
  setLastMovedScriptUnitIdsByPlot: (plotBoxId: string, unitIds: string[]) => void
  clearLastMovedScriptUnitIdsForPlot: (plotBoxId: string) => void
  setLastExportContext: (payload: {
    episodeId: string
    selectedPlotBoxIds: string[]
    includeProperties: Partial<ExportIncludeOptions>
  }) => void
  openUnsavedConfirmDialog: () => Promise<'save' | 'discard' | 'cancel'>
  resolveUnsavedConfirm: (result: 'save' | 'discard' | 'cancel') => void
}

/** 안전 셀렉터: selectedPlotBoxIds가 배열이 아니면 [] 반환. useUIStore(selectSelectedPlotBoxIds) 로 사용. */
export const selectSelectedPlotBoxIds = (state: UIState): string[] =>
  Array.isArray(state.selectedPlotBoxIds) ? state.selectedPlotBoxIds : []

/** 안전 셀렉터: confirmedPlotBoxIds가 배열이 아니면 [] 반환. useUIStore(selectConfirmedPlotBoxIds) 로 사용. */
export const selectConfirmedPlotBoxIds = (state: UIState): string[] =>
  Array.isArray(state.confirmedPlotBoxIds) ? state.confirmedPlotBoxIds : []

function applyArrayUpdater(
  prev: string[],
  idsOrUpdater: string[] | ((prev: string[]) => string[])
): string[] {
  const next = typeof idsOrUpdater === 'function' ? idsOrUpdater(prev) : idsOrUpdater
  return Array.isArray(next) ? next : []
}

export const useUIStore = create<UIState>((set, get) => ({
  currentScreen: 'main',
  activeEpisodeId: null,
  activePlotBoxId: null,
  selectedPlotBoxIds: [],
  confirmedPlotBoxIds: [],
  leftPanelVisible: true,
  plotPanelVisible: true,
  scriptPanelVisible: true,
  plotContentVisible: true,
  editorLayoutMode: 'horizontal',
  workspacePanelSizes: defaultPanelSizes(),
  horizontalLayoutKey: 0,
  commandPaletteOpen: false,
  statusBarVisible: true,
  settingsDialogOpen: false,
  settingsInitialSection: null,
  defaultSettingsDialogOpen: false,
  formatDialogOpen: false,
  exportDialogOpen: false,
  characterManagerOpen: false,
  fullViewOpen: false,
  helpDialogOpen: false,
  activeThemeId: 'light',
  lastExportEpisodeId: null,
  lastExportSelectedPlotBoxIds: [],
  lastExportIncludeProperties: null,
  requestScenarioFocus: null,
  scrollToPlotBoxId: null,
  selectedScriptUnitIds: [],
  lastMovedScriptUnitIdsByPlot: {},
  unsavedConfirmDialogOpen: false,
  unsavedConfirmResolve: null,
  fileErrorMessage: null,
  fileOperationLoading: null,

  setScreen: (screen) => set({ currentScreen: screen }),
  setFileErrorMessage: (msg) => set({ fileErrorMessage: msg }),
  setFileOperationLoading: (value) => set({ fileOperationLoading: value }),
  setRequestScenarioFocus: (fn) => set({ requestScenarioFocus: fn }),
  setScrollToPlotBoxId: (id) => set({ scrollToPlotBoxId: id }),
  setSelectedScriptUnitIds: (idsOrUpdater) =>
    set((state) => {
      const next = applyArrayUpdater(state.selectedScriptUnitIds, idsOrUpdater)
      return {
        selectedScriptUnitIds: next,
        ...(next.length > 0 ? { selectedPlotBoxIds: [] } : {}),
      }
    }),
  setActiveEpisode: (id) => set({ activeEpisodeId: id }),
  setActivePlotBox: (id) => set({ activePlotBoxId: id }),
  setSelectedPlotBoxIds: (idsOrUpdater) =>
    set((state) => {
      const next = applyArrayUpdater(state.selectedPlotBoxIds, idsOrUpdater)
      return {
        selectedPlotBoxIds: next,
        ...(next.length > 0 ? { selectedScriptUnitIds: [] } : {}),
      }
    }),
  clearAllSelection: () => set({ selectedPlotBoxIds: [], selectedScriptUnitIds: [] }),
  setConfirmedPlotBoxIds: (idsOrUpdater) =>
    set((state) => ({ confirmedPlotBoxIds: applyArrayUpdater(state.confirmedPlotBoxIds, idsOrUpdater) })),
  toggleLeftPanel: () => set((state) => ({ leftPanelVisible: !state.leftPanelVisible })),
  togglePlotPanel: () => set((state) => ({ plotPanelVisible: !state.plotPanelVisible })),
  toggleScriptPanel: () => set((state) => ({ scriptPanelVisible: !state.scriptPanelVisible })),
  setPlotContentVisible: (visible) => set({ plotContentVisible: visible }),
  togglePlotContentVisible: () => set((state) => ({ plotContentVisible: !state.plotContentVisible })),
  setEditorLayoutMode: (mode) =>
    set((state) => {
      const currentMode = state.editorLayoutMode
      const currentSizes = state.workspacePanelSizes[currentMode]
      const fiftyFifty = [50, 50] as const
      if (!Array.isArray(currentSizes) || currentSizes.length < 2) {
        return {
          editorLayoutMode: mode,
          workspacePanelSizes: { ...state.workspacePanelSizes, [mode]: [...fiftyFifty] },
        }
      }
      // horizontal/vertical: 첫 패널이 플롯(에피소드). *-reversed: 두 번째 패널이 플롯.
      const plotShare =
        currentMode === 'horizontal' || currentMode === 'vertical'
          ? currentSizes[0]
          : currentSizes[1]
      let sizesForNewMode: number[]
      if (mode === 'horizontal') {
        // 기본 모드 진입 시 플롯이 50% 미만이면 50/50 적용 → 다른 모드에서 넓힌 뒤 전환해도 텍스트 잘림 방지
        sizesForNewMode =
          plotShare < 50 ? [...fiftyFifty] : [plotShare, 100 - plotShare]
      } else {
        // vertical: 첫 패널이 플롯. *-reversed: 두 번째가 플롯.
        sizesForNewMode =
          mode === 'vertical'
            ? [plotShare, 100 - plotShare]
            : [100 - plotShare, plotShare]
      }
      // #region agent log
      if (mode === 'horizontal') {
        fetch('http://127.0.0.1:7242/ingest/88c5408a-5008-4939-ac01-c6dc3fd592a0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8468c1'},body:JSON.stringify({sessionId:'8468c1',location:'uiStore.ts:setEditorLayoutMode',message:'switch to horizontal',data:{from:currentMode,plotShare,sizesForNewMode},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      return {
        editorLayoutMode: mode,
        workspacePanelSizes: { ...state.workspacePanelSizes, [mode]: sizesForNewMode },
        ...(mode === 'horizontal' ? { horizontalLayoutKey: state.horizontalLayoutKey + 1 } : {}),
      }
    }),
  setWorkspacePanelSizes: (mode, sizes) =>
    set((state) => ({
      workspacePanelSizes: { ...state.workspacePanelSizes, [mode]: sizes },
    })),
  getWorkspaceLayoutSnapshot: () => {
    const s = get()
    return {
      editorLayoutMode: s.editorLayoutMode,
      leftPanelVisible: s.leftPanelVisible,
      plotPanelVisible: s.plotPanelVisible,
      scriptPanelVisible: s.scriptPanelVisible,
      plotContentVisible: s.plotContentVisible,
      panelSizes: { ...s.workspacePanelSizes },
    }
  },
  applyWorkspaceLayout: (layout) =>
    set({
      editorLayoutMode: layout.editorLayoutMode,
      leftPanelVisible: layout.leftPanelVisible,
      plotPanelVisible: layout.plotPanelVisible,
      scriptPanelVisible: layout.scriptPanelVisible,
      plotContentVisible: layout.plotContentVisible,
      workspacePanelSizes: layout.panelSizes
        ? { ...defaultPanelSizes(), ...layout.panelSizes }
        : defaultPanelSizes(),
    }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleStatusBar: () => set((state) => ({ statusBarVisible: !state.statusBarVisible })),
  setSettingsDialogOpen: (open, initialSection) =>
    set((s) => ({
      settingsDialogOpen: open,
      settingsInitialSection: open && initialSection != null ? initialSection : null,
    })),
  setDefaultSettingsDialogOpen: (open) => set({ defaultSettingsDialogOpen: open }),
  setFormatDialogOpen: (open) => set({ formatDialogOpen: open }),
  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
  setCharacterManagerOpen: (open) => set({ characterManagerOpen: open }),
  setFullViewOpen: (open) => set({ fullViewOpen: open }),
  closeFullView: () => set({ fullViewOpen: false }),
  setHelpDialogOpen: (open) => set({ helpDialogOpen: open }),
  setActiveThemeId: (id) => set({ activeThemeId: id }),
  setLastMovedScriptUnitIdsByPlot: (plotBoxId, unitIds) =>
    set((state) => ({
      lastMovedScriptUnitIdsByPlot: { ...state.lastMovedScriptUnitIdsByPlot, [plotBoxId]: unitIds },
    })),
  clearLastMovedScriptUnitIdsForPlot: (plotBoxId) =>
    set((state) => {
      const { [plotBoxId]: _removed, ...rest } = state.lastMovedScriptUnitIdsByPlot
      return { lastMovedScriptUnitIdsByPlot: rest }
    }),
  setLastExportContext: ({ episodeId, selectedPlotBoxIds, includeProperties }) =>
    set({
      lastExportEpisodeId: episodeId,
      lastExportSelectedPlotBoxIds: selectedPlotBoxIds,
      lastExportIncludeProperties: includeProperties,
    }),
  openUnsavedConfirmDialog: () =>
    new Promise<'save' | 'discard' | 'cancel'>((resolve) => {
      set({ unsavedConfirmDialogOpen: true, unsavedConfirmResolve: resolve })
    }),
  resolveUnsavedConfirm: (result) => {
    const { unsavedConfirmResolve } = get()
    if (unsavedConfirmResolve) unsavedConfirmResolve(result)
    set({ unsavedConfirmDialogOpen: false, unsavedConfirmResolve: null })
  },
}))
