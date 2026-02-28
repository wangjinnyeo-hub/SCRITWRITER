import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore } from '@/store/ui/uiStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { cn } from '@/lib/utils'
import type { ScriptPropertyType } from '@/types'
import {
  ALL_FILTERABLE_TYPES,
  createUnitFilterFromTypeFilter,
  filterPlotsById,
  getSortedUnits,
  normalizeTypeFilter,
  toIncludeOptions,
} from '@/lib/scriptEngine/filters'
import { getPropertyStyle as getSharedPropertyStyle, getDialogueTypingMaxWidth } from '@/lib/scriptStyles'
import { UNKNOWN_CHARACTER_NAME } from '@/lib/scriptGrouping'
import { FullViewHeader } from './fullview/FullViewHeader'
import { FullViewSidebar } from './fullview/FullViewSidebar'
import { PDFFormat } from './fullview/formats/PDFFormat'
import type { ScriptTypeFilter } from './fullview/types'

interface UnifiedFullViewProps {
  episodeId: string
  onClose: () => void
}

export function UnifiedFullView({ episodeId, onClose }: UnifiedFullViewProps) {
  const file = useProjectStore(state => state.file)
  const propertyLabels = useSettingsStore(state => state.propertyLabels)
  const propertyStyles = useSettingsStore(state => state.propertyStyles)
  const dialogueParagraphGap = useSettingsStore(state => state.dialogueParagraphGap)
  const dialogueTypingWidth = useSettingsStore(state => state.dialogueTypingWidth)
  const dialogueTypingWidthCh = useSettingsStore(state => state.dialogueTypingWidthCh)
  const unitDivider = useSettingsStore(state => state.unitDivider)
  const dialogueColorMode = useSettingsStore(state => state.dialogueColorMode)
  const dialogueCustomColor = useSettingsStore(state => state.dialogueCustomColor)
  const defaultFontFamily = useSettingsStore(state => state.defaultFontFamily)
  const setLastExportContext = useUIStore(state => state.setLastExportContext)
  const exportDialogOpen = useUIStore(state => state.exportDialogOpen)
  const setExportDialogOpen = useUIStore(state => state.setExportDialogOpen)

  const [selectedPlotIds, setSelectedPlotIds] = useState<Set<string>>(new Set())
  const [selectedTypes, setSelectedTypes] = useState<Set<ScriptTypeFilter>>(new Set(['all']))
  const [allPlotsSelected, setAllPlotsSelected] = useState(true)
  const [fullViewSidebarCollapsed, setFullViewSidebarCollapsed] = useState(false)
  const [pdfPageViewMode, setPdfPageViewMode] = useState(false)
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1)
  const [pdfTotalPages, setPdfTotalPages] = useState(1)
  const [fullViewIncludeProjectTitle, setFullViewIncludeProjectTitle] = useState(true)
  const [fullViewIncludeEpisodeTitle, setFullViewIncludeEpisodeTitle] = useState(true)
  const [fullViewIncludePlotTitle, setFullViewIncludePlotTitle] = useState(true)
  const [fullViewIncludePlotBoxSeparator, setFullViewIncludePlotBoxSeparator] = useState(true)
  const [fullViewIncludePlotBoxContent, setFullViewIncludePlotBoxContent] = useState(true)
  const [fullViewIncludeDialogueLine, setFullViewIncludeDialogueLine] = useState(true)
  const [pdfScaleFit, setPdfScaleFit] = useState(1)
  const [measuredPdfContentHeight, setMeasuredPdfContentHeight] = useState(0)
  const [pdfBreakStarts, setPdfBreakStarts] = useState<number[]>([])
  const [pdfPageSize, setPdfPageSize] = useState<'a4' | 'letter'>('a4')
  const [pdfMarginPreset, setPdfMarginPreset] = useState<'narrow' | 'normal' | 'wide' | 'custom'>('normal')
  const [pdfCustomMarginMm, setPdfCustomMarginMm] = useState({ top: 20, right: 20, bottom: 20, left: 20 })
  const [pdfPageBreakRule, setPdfPageBreakRule] = useState<'height' | 'plot'>('height')
  const [pdfZoom, setPdfZoom] = useState<'fit' | 0.5 | 0.75 | 1 | 1.25 | 1.5>('fit')
  const pdfContentScrollRef = useRef<HTMLDivElement>(null)
  const pdfContentInnerRef = useRef<HTMLDivElement>(null)
  const pdfViewportRef = useRef<HTMLDivElement>(null)
  const isProgrammaticScrollRef = useRef(false)
  const pdfMeasurePrevRef = useRef<{ h: number; breaksJson: string }>({ h: -1, breaksJson: '' })

  const PDF_PAGE_WIDTH_PX = pdfPageSize === 'letter' ? 816 : 794
  const PDF_PAGE_HEIGHT_PX = pdfPageSize === 'letter' ? 1056 : 1122
  const MM_TO_PX = 96 / 25.4
  const PDF_PRESET_MM: Record<'narrow' | 'normal' | 'wide', number> = { narrow: 12, normal: 20, wide: 28 }
  const effectiveMarginMm = useMemo(
    () =>
      pdfMarginPreset === 'custom'
        ? pdfCustomMarginMm
        : { top: PDF_PRESET_MM[pdfMarginPreset], right: PDF_PRESET_MM[pdfMarginPreset], bottom: PDF_PRESET_MM[pdfMarginPreset], left: PDF_PRESET_MM[pdfMarginPreset] },
    [pdfMarginPreset, pdfCustomMarginMm]
  )
  const pdfMarginPx = useMemo(
    () => ({
      top: effectiveMarginMm.top * MM_TO_PX,
      right: effectiveMarginMm.right * MM_TO_PX,
      bottom: effectiveMarginMm.bottom * MM_TO_PX,
      left: effectiveMarginMm.left * MM_TO_PX,
    }),
    [effectiveMarginMm]
  )
  const pdfContentHeightPerPage = Math.max(1, PDF_PAGE_HEIGHT_PX - pdfMarginPx.top - pdfMarginPx.bottom)
  const PDF_MARGIN_MM_STRING: Record<'narrow' | 'normal' | 'wide', string> = { narrow: '12mm', normal: '20mm', wide: '28mm' }
  const pdfEffectiveScale = pdfZoom === 'fit' ? pdfScaleFit : pdfZoom
  const episode = file?.episodes.find(e => e.id === episodeId)
  const plotBoxes = useMemo(
    () => (episode?.plotBoxes ? [...episode.plotBoxes].sort((a, b) => a.order - b.order) : []),
    [episode?.plotBoxes]
  )
  const characters = file?.project.characters || []

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (exportDialogOpen) {
        setExportDialogOpen(false)
        return
      }
      onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [exportDialogOpen, onClose, setExportDialogOpen])

  useEffect(() => {
    setSelectedPlotIds(new Set(plotBoxes.map(box => box.id)))
    setAllPlotsSelected(true)
  }, [plotBoxes])

  const togglePlot = (plotId: string) => {
    setSelectedPlotIds(prev => {
      const next = new Set(prev)
      if (next.has(plotId)) next.delete(plotId); else next.add(plotId)
      setAllPlotsSelected(next.size === plotBoxes.length)
      return next
    })
  }
  const toggleType = (type: ScriptTypeFilter) => {
    setSelectedTypes(prev => {
      const normalized = normalizeTypeFilter(prev)
      if (type === 'all') {
        return normalized.has('all') ? new Set() : new Set(['all'])
      }
      // all 상태에서 개별 클릭 → all 해제, 해당 유형만 제외
      if (normalized.has('all')) {
        const next = new Set<ScriptTypeFilter>(ALL_FILTERABLE_TYPES.filter(t => t !== type))
        return next
      }
      // 일반 토글
      const next = new Set(normalized)
      if (next.has(type)) next.delete(type); else next.add(type)
      // 5개 모두 선택되면 all로 승격
      if (next.size === ALL_FILTERABLE_TYPES.length && ALL_FILTERABLE_TYPES.every(t => next.has(t))) {
        return new Set<ScriptTypeFilter>(['all'])
      }
      return next
    })
  }
  const toggleAllPlots = () => {
    if (allPlotsSelected) { setSelectedPlotIds(new Set()); setAllPlotsSelected(false) }
    else { setSelectedPlotIds(new Set(plotBoxes.map(b => b.id))); setAllPlotsSelected(true) }
  }
  const toggleAllTypes = () => {
    setSelectedTypes(prev => prev.has('all') ? new Set() : new Set(['all']))
  }

  const getCharacterName = (id?: string, dialogueLabel?: string) => {
    const extra = characters.find(c => c.name === '엑스트라')
    if (id && extra && id === extra.id) return (dialogueLabel && dialogueLabel.trim()) ? dialogueLabel : extra.name
    const name = characters.find(c => c.id === id)?.name
    if (name) return name
    if (dialogueLabel && dialogueLabel.trim()) return dialogueLabel.trim()
    return extra?.name ?? UNKNOWN_CHARACTER_NAME
  }
  const getCharacterColor = (id?: string) => characters.find(c => c.id === id)?.color || '#111'
  const getPropertyStyle = (type: ScriptPropertyType) => getSharedPropertyStyle(propertyStyles, type, defaultFontFamily || undefined)
  const effectiveSelectedTypes = useMemo(
    () =>
      selectedTypes.has('all')
        ? selectedTypes
        : new Set<ScriptTypeFilter>([...selectedTypes, 'dialogue', 'character']),
    [selectedTypes]
  )
  const filterUnit = createUnitFilterFromTypeFilter(effectiveSelectedTypes)
  const normalizedTypes = normalizeTypeFilter(selectedTypes)
  const hideCharacterNameByFilter = !normalizedTypes.has('all') && !normalizedTypes.has('character')
  const effectiveHideCharacterName = hideCharacterNameByFilter

  const selectedPlots = filterPlotsById(plotBoxes, selectedPlotIds)
  const pdfHeightContentKey = useMemo(
    () =>
      [...selectedPlotIds].sort().join(',') +
      '|' +
      [...normalizeTypeFilter(selectedTypes)].sort().join(',') +
      '|' +
      plotBoxes
        .map(
          (p) =>
            p.id +
            ':' +
            (p.scriptUnits?.length ?? 0) +
            ':' +
            (p.scriptUnits?.reduce((acc, u) => acc + (u.content?.length ?? 0), 0) ?? 0)
        )
        .join(','),
    [selectedPlotIds, selectedTypes, plotBoxes]
  )
  const sortedSelectedPlots = selectedPlots.map(plot => ({
    ...plot,
    scriptUnits: getSortedUnits(plot),
  }))
  const formatProps = {
    plots: sortedSelectedPlots,
    allPlots: plotBoxes,
    characters,
    filterUnit,
    getPropertyStyle,
    getCharacterName,
    getCharacterColor,
    hideCharacterName: effectiveHideCharacterName,
    dialogueParagraphGap,
    dialogueTypingMaxWidth: getDialogueTypingMaxWidth(dialogueTypingWidth, dialogueTypingWidthCh),
    unitDivider,
    dialogueColorMode,
    dialogueCustomColor,
    defaultFontFamily: defaultFontFamily || undefined,
    includeDialogueLine: fullViewIncludeDialogueLine,
  }
  const baseIncludeFromTypes = useMemo(() => toIncludeOptions(selectedTypes), [selectedTypes])
  const initialIncludeProperties = useMemo(
    () => ({
      ...baseIncludeFromTypes,
      dialogue: true,
      projectTitle: fullViewIncludeProjectTitle,
      episodeTitle: fullViewIncludeEpisodeTitle,
      plotBoxTitle: fullViewIncludePlotTitle,
      plotBoxSeparator: fullViewIncludePlotBoxSeparator ?? true,
      plotBoxContent: fullViewIncludePlotBoxContent ?? true,
      dialogueLine: fullViewIncludeDialogueLine,
    }),
    [baseIncludeFromTypes, fullViewIncludeProjectTitle, fullViewIncludeEpisodeTitle, fullViewIncludePlotTitle, fullViewIncludePlotBoxSeparator, fullViewIncludePlotBoxContent, fullViewIncludeDialogueLine]
  )
  const selectedPlotIdArray = useMemo(() => [...selectedPlotIds], [selectedPlotIds])

  useEffect(() => {
    setLastExportContext({
      episodeId,
      selectedPlotBoxIds: selectedPlotIdArray,
      includeProperties: initialIncludeProperties,
    })
  }, [episodeId, selectedPlotIdArray, initialIncludeProperties, setLastExportContext])

  useLayoutEffect(() => {
    if (!pdfPageViewMode || pdfPageBreakRule !== 'height' || !pdfContentInnerRef.current)
      return
    const el = pdfContentInnerRef.current
    const h = Math.max(0, el.offsetHeight || 0)
    let breaks: number[]
    try {
      const units = Array.from(el.querySelectorAll<HTMLElement>('[data-pdf-unit]'))
      const containerRect = el.getBoundingClientRect()
      const contentH = Math.max(1, PDF_PAGE_HEIGHT_PX - pdfMarginPx.top - pdfMarginPx.bottom)
      if (units.length === 0) {
        breaks = [0]
        for (let y = 0; y < h; y += PDF_PAGE_HEIGHT_PX) breaks.push(Math.min(y + PDF_PAGE_HEIGHT_PX, h))
        if (breaks.length === 1 && h > 0) breaks.push(h)
      } else {
        const withPos = units
          .map((u) => {
            const r = u.getBoundingClientRect()
            return { top: r.top - containerRect.top, height: r.height }
          })
          .sort((a, b) => a.top - b.top)
        const totalH = Math.max(h, ...withPos.map((u) => u.top + u.height))
        breaks = [0]
        for (const u of withPos) {
          const pageStart = breaks[breaks.length - 1]
          if (u.top + u.height - pageStart > contentH && u.top > pageStart) breaks.push(u.top)
        }
        breaks.push(totalH)
      }
    } catch {
      breaks = [0]
      for (let y = 0; y < h; y += PDF_PAGE_HEIGHT_PX) breaks.push(Math.min(y + PDF_PAGE_HEIGHT_PX, h))
      if (breaks.length === 1 && h > 0) breaks.push(h)
    }
    const breaksJson = JSON.stringify(breaks)
    const prev = pdfMeasurePrevRef.current
    if (prev.h !== h || prev.breaksJson !== breaksJson) {
      pdfMeasurePrevRef.current = { h, breaksJson }
      setMeasuredPdfContentHeight(h)
      setPdfBreakStarts(breaks)
    }
  }, [pdfPageViewMode, pdfPageBreakRule, pdfHeightContentKey, effectiveHideCharacterName, pdfPageSize, PDF_PAGE_HEIGHT_PX, pdfMarginPx.top, pdfMarginPx.bottom])

  useEffect(() => {
    if (!pdfPageViewMode) return
    const total =
      pdfPageBreakRule === 'plot'
        ? Math.max(1, selectedPlots.length)
        : pdfBreakStarts.length >= 2
          ? pdfBreakStarts.length - 1
          : Math.max(1, Math.ceil((measuredPdfContentHeight || 0) / PDF_PAGE_HEIGHT_PX))
    setPdfTotalPages(total)
    setPdfCurrentPage((p) => Math.min(Math.max(1, p), total))
  }, [pdfPageViewMode, measuredPdfContentHeight, pdfPageBreakRule, selectedPlots.length, pdfPageSize, pdfBreakStarts.length])

  useEffect(() => {
    if (!pdfViewportRef.current) return
    const el = pdfViewportRef.current
    const updateFit = () => {
      const w = el.clientWidth
      const padding = 48
      const available = Math.max(100, w - padding)
      if (w <= 0) return
      if (pdfPageViewMode && pdfPageBreakRule === 'height') {
        const pageWidthWithMargins = PDF_PAGE_WIDTH_PX + pdfMarginPx.left + pdfMarginPx.right
        setPdfScaleFit(Math.min(1.5, Math.max(0.3, available / pageWidthWithMargins)))
      } else {
        setPdfScaleFit(Math.min(1.5, Math.max(0.3, available / PDF_PAGE_WIDTH_PX)))
      }
    }
    let ro: ResizeObserver | null = null
    const rafId = requestAnimationFrame(() => {
      updateFit()
      ro = new ResizeObserver(updateFit)
      ro.observe(el)
    })
    return () => {
      cancelAnimationFrame(rafId)
      ro?.disconnect()
    }
  }, [pdfPageViewMode, pdfPageBreakRule, pdfPageSize, PDF_PAGE_WIDTH_PX, pdfMarginPx.left, pdfMarginPx.right])

  useEffect(() => {
    if (!pdfPageViewMode) return
    const el = pdfContentScrollRef.current
    if (!el) return
    isProgrammaticScrollRef.current = true
    if (pdfPageBreakRule === 'height' && pdfBreakStarts.length >= 2) {
      const scale = pdfEffectiveScale
      let scrollTop = 0
      for (let i = 0; i < pdfCurrentPage - 1 && i < pdfBreakStarts.length - 1; i++) {
        const boxH =
          pdfMarginPx.top + (pdfBreakStarts[i + 1] - pdfBreakStarts[i]) + pdfMarginPx.bottom
        scrollTop += boxH * scale
      }
      el.scrollTop = scrollTop
    } else {
      el.scrollTop = (pdfCurrentPage - 1) * PDF_PAGE_HEIGHT_PX * pdfEffectiveScale
    }
    const rafId = requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false
    })
    return () => cancelAnimationFrame(rafId)
  }, [
    pdfPageViewMode,
    pdfCurrentPage,
    pdfEffectiveScale,
    pdfPageSize,
    pdfPageBreakRule,
    pdfBreakStarts,
    pdfMarginPx.top,
    pdfMarginPx.bottom,
  ])

  const handleOpenExportDialog = () => {
    setLastExportContext({
      episodeId,
      selectedPlotBoxIds: selectedPlotIdArray,
      includeProperties: initialIncludeProperties,
    })
    setExportDialogOpen(true)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-background">
      <FullViewHeader
        episodeNumber={episode?.number || 0}
        episodeSubtitle={episode?.subtitle}
        onOpenExportDialog={handleOpenExportDialog}
        onClose={onClose}
      />

      <div className="flex-1 overflow-hidden flex">
        <FullViewSidebar
          plotBoxes={plotBoxes}
          selectedPlotIds={selectedPlotIds}
          allPlotsSelected={allPlotsSelected}
          togglePlot={togglePlot}
          toggleAllPlots={toggleAllPlots}
          selectedTypes={selectedTypes}
          toggleType={toggleType}
          toggleAllTypes={toggleAllTypes}
          propertyLabels={propertyLabels}
          includeProjectTitle={fullViewIncludeProjectTitle}
          setIncludeProjectTitle={setFullViewIncludeProjectTitle}
          includeEpisodeTitle={fullViewIncludeEpisodeTitle}
          setIncludeEpisodeTitle={setFullViewIncludeEpisodeTitle}
          includePlotTitle={fullViewIncludePlotTitle}
          setIncludePlotTitle={setFullViewIncludePlotTitle}
          includePlotBoxSeparator={fullViewIncludePlotBoxSeparator}
          setIncludePlotBoxSeparator={setFullViewIncludePlotBoxSeparator}
          includePlotBoxContent={fullViewIncludePlotBoxContent}
          setIncludePlotBoxContent={setFullViewIncludePlotBoxContent}
          includeDialogueLine={fullViewIncludeDialogueLine}
          setIncludeDialogueLine={setFullViewIncludeDialogueLine}
          collapsed={fullViewSidebarCollapsed}
          onToggleCollapsed={() => setFullViewSidebarCollapsed((v) => !v)}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedPlots.length > 0 && (
            <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-2 border-b border-border bg-muted/20">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={pdfPageViewMode}
                  onChange={(e) => {
                    setPdfPageViewMode(e.target.checked)
                    if (!e.target.checked) setPdfCurrentPage(1)
                  }}
                  className="w-3 h-3"
                />
                페이지별 보기
              </label>
              <span className="text-muted-foreground/60 text-[10px]">|</span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground shrink-0">배율</span>
                <select
                  value={pdfZoom === 'fit' ? 'fit' : String(pdfZoom)}
                  onChange={(e) => {
                    const v = e.target.value
                    setPdfZoom(v === 'fit' ? 'fit' : (Number(v) as 0.5 | 0.75 | 1 | 1.25 | 1.5))
                  }}
                  className="h-7 px-2 rounded border border-border bg-background text-xs"
                >
                  <option value="fit">맞춤</option>
                  <option value="0.5">50%</option>
                  <option value="0.75">75%</option>
                  <option value="1">100%</option>
                  <option value="1.25">125%</option>
                  <option value="1.5">150%</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground shrink-0">여백</span>
                <select
                  value={pdfMarginPreset}
                  onChange={(e) => setPdfMarginPreset(e.target.value as 'narrow' | 'normal' | 'wide' | 'custom')}
                  className="h-7 px-2 rounded border border-border bg-background text-xs"
                >
                  <option value="narrow">좁음</option>
                  <option value="normal">보통</option>
                  <option value="wide">넓음</option>
                  <option value="custom">커스텀</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground shrink-0">페이지 나누기</span>
                <select
                  value={pdfPageBreakRule}
                  onChange={(e) => setPdfPageBreakRule(e.target.value as 'height' | 'plot')}
                  className="h-7 px-2 rounded border border-border bg-background text-xs"
                >
                  <option value="height">높이 기준 (A4)</option>
                  <option value="plot">플롯 단위</option>
                </select>
              </div>
              {pdfPageViewMode && (
                <>
                  <span className="text-muted-foreground/60 text-[10px]">|</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPdfCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={pdfCurrentPage <= 1}
                      className="p-1.5 rounded border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center"
                      aria-label="이전 페이지"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={pdfTotalPages}
                        value={pdfCurrentPage}
                        onChange={(e) => {
                          const v = e.target.valueAsNumber
                          if (!Number.isNaN(v)) setPdfCurrentPage(Math.max(1, Math.min(pdfTotalPages, v)))
                        }}
                        onBlur={(e) => {
                          const v = e.target.valueAsNumber
                          if (Number.isNaN(v) || v < 1) setPdfCurrentPage(1)
                          else if (v > pdfTotalPages) setPdfCurrentPage(pdfTotalPages)
                        }}
                        className="w-9 h-7 px-1 text-center text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        aria-label="페이지 번호"
                      />
                      <span>/ {pdfTotalPages}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPdfCurrentPage((p) => Math.min(pdfTotalPages, p + 1))}
                      disabled={pdfCurrentPage >= pdfTotalPages}
                      className="p-1.5 rounded border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center"
                      aria-label="다음 페이지"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <div
            ref={pdfViewportRef}
            className={cn(
              'flex-1 min-h-0',
              pdfPageViewMode && pdfPageBreakRule === 'height'
                ? 'overflow-hidden flex flex-col items-center'
                : pdfPageViewMode
                  ? 'overflow-auto flex flex-col items-center'
                  : 'overflow-auto'
            )}
          >
            <div
              id="fullview-content"
              className={cn(
                'mx-auto',
                !pdfPageViewMode && 'px-8 py-6 pb-32 max-w-4xl',
                pdfPageViewMode && pdfPageBreakRule === 'height' && 'flex flex-col flex-1 min-h-0 w-full max-w-full px-2 py-1 pb-2'
              )}
            >
              {selectedPlots.length === 0 ? (
                <div className="text-center text-muted-foreground text-[11px] py-12">
                  플롯을 선택하세요.
                </div>
              ) : (
                (() => {
                  const marginVal = pdfMarginPreset === 'custom'
                    ? `${pdfCustomMarginMm.top}mm ${pdfCustomMarginMm.right}mm ${pdfCustomMarginMm.bottom}mm ${pdfCustomMarginMm.left}mm`
                    : PDF_MARGIN_MM_STRING[pdfMarginPreset as 'narrow' | 'normal' | 'wide']
                  const showHeader = fullViewIncludeProjectTitle || fullViewIncludeEpisodeTitle
                  const innerContent = (
                    <div className="min-h-full" style={{ width: PDF_PAGE_WIDTH_PX }}>
                      {showHeader && (
                        <div data-pdf-unit className="border-b border-gray-200 pb-4 mb-6">
                          {fullViewIncludeProjectTitle && (
                            <h1 className="text-[22px] font-bold m-0 leading-tight">
                              {file?.project.title ?? '제목 없음'}
                            </h1>
                          )}
                          {fullViewIncludeEpisodeTitle && (
                            <p className="text-[13px] text-gray-500 m-0 mt-1">
                              {episode?.number ?? 0}화{episode?.subtitle ? ` – ${episode.subtitle}` : ''}
                            </p>
                          )}
                        </div>
                      )}
                      <PDFFormat {...formatProps} plots={sortedSelectedPlots} includePlotTitle={fullViewIncludePlotTitle} includePlotBoxSeparator={fullViewIncludePlotBoxSeparator} includePlotBoxContent={fullViewIncludePlotBoxContent} />
                    </div>
                  )
                  const renderPageContent = (plots: typeof sortedSelectedPlots, showHeaderInPage: boolean) => (
                    <div
                      ref={
                        pdfPageBreakRule !== 'height' && plots.length === sortedSelectedPlots.length
                          ? pdfContentInnerRef
                          : undefined
                      }
                      className="min-h-full bg-white text-black rounded-md shadow-lg border border-border"
                      style={{
                        padding: marginVal,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                        minHeight: pdfPageViewMode && pdfPageBreakRule === 'height' ? PDF_PAGE_HEIGHT_PX : undefined,
                        ...(pdfPageBreakRule === 'plot' && pdfPageViewMode
                          ? { maxHeight: PDF_PAGE_HEIGHT_PX, overflowY: 'auto' as const }
                          : {}),
                      }}
                    >
                      {showHeaderInPage && showHeader && (
                        <div data-pdf-unit className="border-b border-gray-200 pb-4 mb-6">
                          {fullViewIncludeProjectTitle && (
                            <h1 className="text-[22px] font-bold m-0 leading-tight">
                              {file?.project.title ?? '제목 없음'}
                            </h1>
                          )}
                          {fullViewIncludeEpisodeTitle && (
                            <p className="text-[13px] text-gray-500 m-0 mt-1">
                              {episode?.number ?? 0}화{episode?.subtitle ? ` – ${episode.subtitle}` : ''}
                            </p>
                          )}
                        </div>
                      )}
                      <PDFFormat {...formatProps} plots={plots} includePlotTitle={fullViewIncludePlotTitle} includePlotBoxSeparator={fullViewIncludePlotBoxSeparator} includePlotBoxContent={fullViewIncludePlotBoxContent} />
                    </div>
                  )
                  const singlePageContent = renderPageContent(sortedSelectedPlots, showHeader)

                  if (pdfPageViewMode && pdfPageBreakRule === 'plot') {
                    const scale = pdfEffectiveScale
                    const wrappedWidth = PDF_PAGE_WIDTH_PX * scale
                    const pageHeightScaled = PDF_PAGE_HEIGHT_PX * scale
                    const plotCount = sortedSelectedPlots.length
                    const totalHeight = plotCount * pageHeightScaled
                    return (
                      <div
                        ref={pdfContentScrollRef}
                        onScroll={() => {
                          if (isProgrammaticScrollRef.current) return
                          const el = pdfContentScrollRef.current
                          if (el)
                            setPdfCurrentPage(
                              Math.max(
                                1,
                                Math.min(plotCount, Math.floor(el.scrollTop / pageHeightScaled) + 1)
                              )
                            )
                        }}
                        className="overflow-auto"
                        style={{ height: pageHeightScaled, width: wrappedWidth }}
                      >
                        <div
                          style={{
                            position: 'relative',
                            width: wrappedWidth,
                            height: totalHeight,
                          }}
                        >
                          {sortedSelectedPlots.map((plot, index) => (
                            <div
                              key={plot.id}
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: index * pageHeightScaled,
                                width: wrappedWidth,
                                height: pageHeightScaled,
                              }}
                            >
                              <div
                                style={{
                                  transform: `scale(${scale})`,
                                  transformOrigin: '0 0',
                                  width: PDF_PAGE_WIDTH_PX,
                                  height: PDF_PAGE_HEIGHT_PX,
                                }}
                              >
                                {renderPageContent([plot], index === 0 && (fullViewIncludeProjectTitle || fullViewIncludeEpisodeTitle))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  if (pdfPageViewMode && pdfPageBreakRule === 'height') {
                    const scale = pdfEffectiveScale
                    const pageHeights = pdfBreakStarts.length >= 2
                      ? pdfBreakStarts.slice(0, -1).map((_, i) => pdfMarginPx.top + (pdfBreakStarts[i + 1] - pdfBreakStarts[i]) + pdfMarginPx.bottom)
                      : []
                    const usePageBoxes = pdfBreakStarts.length >= 2 && pageHeights.length > 0
                    const pageCount = usePageBoxes
                      ? pdfBreakStarts.length - 1
                      : Math.max(1, Math.ceil((measuredPdfContentHeight || PDF_PAGE_HEIGHT_PX) / PDF_PAGE_HEIGHT_PX))
                    const totalContentH = usePageBoxes
                      ? pdfBreakStarts[pdfBreakStarts.length - 1] - pdfBreakStarts[0]
                      : measuredPdfContentHeight || PDF_PAGE_HEIGHT_PX
                    const totalScrollH = usePageBoxes
                      ? pageHeights.reduce((a, b) => a + b, 0) * scale
                      : totalContentH * scale
                    const pageWidthWithMargins = PDF_PAGE_WIDTH_PX + pdfMarginPx.left + pdfMarginPx.right
                    const wrappedWidth = pageWidthWithMargins * scale

                    return (
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          flex: 1,
                          minHeight: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                        }}
                      >
                        <div
                          ref={pdfContentInnerRef}
                          aria-hidden
                          style={{
                            position: 'absolute',
                            left: -9999,
                            top: 0,
                            width: PDF_PAGE_WIDTH_PX,
                            visibility: 'hidden',
                            pointerEvents: 'none',
                            zIndex: -1,
                          }}
                        >
                          {innerContent}
                        </div>
                        <div
                          ref={pdfContentScrollRef}
                          onScroll={() => {
                            if (isProgrammaticScrollRef.current) return
                            const el = pdfContentScrollRef.current
                            if (!el || !usePageBoxes) return
                            let acc = 0
                            const pageHeightScaled = pageHeights.map((h) => h * scale)
                            for (let i = 0; i < pageHeightScaled.length; i++) {
                              acc += pageHeightScaled[i]
                              if (el.scrollTop < acc) {
                                setPdfCurrentPage(i + 1)
                                return
                              }
                            }
                            setPdfCurrentPage(pageCount)
                          }}
                          className="overflow-auto"
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            flex: 1,
                            minHeight: 0,
                            width: '100%',
                          }}
                        >
                          {usePageBoxes ? (
                            <div style={{ width: wrappedWidth, height: totalScrollH, margin: '0 auto' }}>
                              {pdfBreakStarts.slice(0, -1).map((start, i) => {
                                const contentH = pdfBreakStarts[i + 1] - start
                                const boxH = pdfMarginPx.top + contentH + pdfMarginPx.bottom
                                const top = pageHeights.slice(0, i).reduce((a, b) => a + b, 0) * scale
                                return (
                                  <div
                                    key={i}
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      top,
                                      width: wrappedWidth,
                                      height: boxH * scale,
                                      padding: `${pdfMarginPx.top * scale}px ${pdfMarginPx.right * scale}px ${pdfMarginPx.bottom * scale}px ${pdfMarginPx.left * scale}px`,
                                      boxSizing: 'border-box',
                                      background: 'white',
                                      border: '1px solid var(--border)',
                                      borderRadius: '6px',
                                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: PDF_PAGE_WIDTH_PX * scale,
                                        height: contentH * scale,
                                        overflow: 'hidden',
                                      }}
                                    >
                                      <div
                                        style={{
                                          transform: `scale(${scale}) translateY(-${start}px)`,
                                          transformOrigin: '0 0',
                                          width: PDF_PAGE_WIDTH_PX,
                                          height: contentH,
                                        }}
                                      >
                                        {innerContent}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div style={{ width: wrappedWidth, height: totalContentH * scale, margin: '0 auto' }}>
                              <div
                                style={{
                                  transform: `scale(${scale})`,
                                  transformOrigin: '0 0',
                                  width: PDF_PAGE_WIDTH_PX,
                                  height: totalContentH,
                                  minHeight: PDF_PAGE_HEIGHT_PX,
                                }}
                              >
                                {singlePageContent}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div className="flex justify-center">
                      <div
                        style={{
                          transform: `scale(${pdfEffectiveScale})`,
                          transformOrigin: 'top center',
                          width: PDF_PAGE_WIDTH_PX,
                        }}
                      >
                        {singlePageContent}
                      </div>
                    </div>
                  )
                })()
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
