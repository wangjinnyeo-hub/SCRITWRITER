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
import { ScriptFormat } from './fullview/formats/ScriptFormat'
import { PlotScriptFormat } from './fullview/formats/PlotScriptFormat'
import { EpisodeFormat } from './fullview/formats/EpisodeFormat'
import type { ViewFormat, ScriptTypeFilter } from './fullview/types'

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

  const [viewFormat, setViewFormat] = useState<ViewFormat>('script')
  const [selectedPlotIds, setSelectedPlotIds] = useState<Set<string>>(new Set())
  const [selectedTypes, setSelectedTypes] = useState<Set<ScriptTypeFilter>>(new Set(['all']))
  const [allPlotsSelected, setAllPlotsSelected] = useState(true)
  const [fullViewSidebarCollapsed, setFullViewSidebarCollapsed] = useState(false)
  const [pdfPageViewMode, setPdfPageViewMode] = useState(false)
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1)
  const [pdfTotalPages, setPdfTotalPages] = useState(1)
  const [pdfZoom, setPdfZoom] = useState<'fit' | 0.5 | 0.75 | 1 | 1.25 | 1.5>('fit')
  const [pdfMargin, setPdfMargin] = useState<'narrow' | 'normal' | 'wide'>('normal')
  const [pdfPageBreakRule, setPdfPageBreakRule] = useState<'height' | 'plot'>('height')
  const [pdfScaleFit, setPdfScaleFit] = useState(1)
  const [measuredPdfContentHeight, setMeasuredPdfContentHeight] = useState(0)
  const pdfContentScrollRef = useRef<HTMLDivElement>(null)
  const pdfContentInnerRef = useRef<HTMLDivElement>(null)
  const pdfViewportRef = useRef<HTMLDivElement>(null)
  const isProgrammaticScrollRef = useRef(false)

  const PDF_PAGE_WIDTH_PX = 794
  const PDF_PAGE_HEIGHT_PX = 1122
  const PDF_MARGIN_MM: Record<'narrow' | 'normal' | 'wide', string> = {
    narrow: '12mm',
    normal: '20mm',
    wide: '28mm',
  }
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
  const getPropertyStyle = (type: ScriptPropertyType) => {
    return getSharedPropertyStyle(propertyStyles, type, defaultFontFamily || undefined)
  }
  const filterUnit = createUnitFilterFromTypeFilter(selectedTypes)
  const normalizedTypes = normalizeTypeFilter(selectedTypes)
  const hideCharacterNameByFilter = !normalizedTypes.has('all') && !normalizedTypes.has('character')
  const effectiveHideCharacterName = hideCharacterNameByFilter

  const selectedPlots = filterPlotsById(plotBoxes, selectedPlotIds)
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
  }
  const initialIncludeProperties = useMemo(() => toIncludeOptions(selectedTypes), [selectedTypes])
  const selectedPlotIdArray = useMemo(() => [...selectedPlotIds], [selectedPlotIds])

  useEffect(() => {
    setLastExportContext({
      episodeId,
      selectedPlotBoxIds: selectedPlotIdArray,
      includeProperties: initialIncludeProperties,
    })
  }, [episodeId, selectedPlotIdArray, initialIncludeProperties, setLastExportContext])

  useLayoutEffect(() => {
    if (viewFormat !== 'pdf' || !pdfPageViewMode || pdfPageBreakRule !== 'height' || !pdfContentInnerRef.current)
      return
    const h = pdfContentInnerRef.current.offsetHeight
    setMeasuredPdfContentHeight(h)
  }, [viewFormat, pdfPageViewMode, pdfPageBreakRule, selectedPlots, selectedTypes, effectiveHideCharacterName])

  useEffect(() => {
    if (viewFormat !== 'pdf' || !pdfPageViewMode) return
    const total =
      pdfPageBreakRule === 'plot'
        ? Math.max(1, selectedPlots.length)
        : Math.max(1, Math.ceil(measuredPdfContentHeight / PDF_PAGE_HEIGHT_PX))
    setPdfTotalPages(total)
    setPdfCurrentPage((p) => Math.min(p, total))
  }, [viewFormat, pdfPageViewMode, measuredPdfContentHeight, pdfPageBreakRule, selectedPlots.length])

  useEffect(() => {
    if (viewFormat !== 'pdf' || !pdfViewportRef.current) return
    const el = pdfViewportRef.current
    const updateFit = () => {
      const w = el.clientWidth
      const padding = 48
      const available = Math.max(100, w - padding)
      if (w > 0) setPdfScaleFit(Math.min(1.5, Math.max(0.3, available / PDF_PAGE_WIDTH_PX)))
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
  }, [viewFormat, pdfPageViewMode])

  useEffect(() => {
    if (!pdfPageViewMode || viewFormat !== 'pdf') return
    const el = pdfContentScrollRef.current
    if (!el) return
    isProgrammaticScrollRef.current = true
    el.scrollTop = (pdfCurrentPage - 1) * PDF_PAGE_HEIGHT_PX * pdfEffectiveScale
    const rafId = requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false
    })
    return () => cancelAnimationFrame(rafId)
  }, [pdfPageViewMode, pdfCurrentPage, viewFormat, pdfEffectiveScale])

  const handleOpenExportDialog = () => {
    setLastExportContext({
      episodeId,
      selectedPlotBoxIds: selectedPlotIdArray,
      includeProperties: initialIncludeProperties,
    })
    setExportDialogOpen(true)
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <FullViewHeader
        episodeNumber={episode?.number || 0}
        episodeSubtitle={episode?.subtitle}
        onOpenExportDialog={handleOpenExportDialog}
        onClose={onClose}
      />

      <div className="flex-1 overflow-hidden flex">
        <FullViewSidebar
          viewFormat={viewFormat}
          setViewFormat={setViewFormat}
          plotBoxes={plotBoxes}
          selectedPlotIds={selectedPlotIds}
          allPlotsSelected={allPlotsSelected}
          togglePlot={togglePlot}
          toggleAllPlots={toggleAllPlots}
          selectedTypes={selectedTypes}
          toggleType={toggleType}
          toggleAllTypes={toggleAllTypes}
          propertyLabels={propertyLabels}
          collapsed={fullViewSidebarCollapsed}
          onToggleCollapsed={() => setFullViewSidebarCollapsed((v) => !v)}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {viewFormat === 'pdf' && selectedPlots.length > 0 && (
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
                  value={pdfMargin}
                  onChange={(e) => setPdfMargin(e.target.value as 'narrow' | 'normal' | 'wide')}
                  className="h-7 px-2 rounded border border-border bg-background text-xs"
                >
                  <option value="narrow">좁음</option>
                  <option value="normal">보통</option>
                  <option value="wide">넓음</option>
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <div
            ref={viewFormat === 'pdf' ? pdfViewportRef : undefined}
            className={cn('flex-1 min-h-0 overflow-auto', viewFormat === 'pdf' && pdfPageViewMode && 'flex flex-col items-center')}
          >
            <div
              id="fullview-content"
              className={cn(
                'mx-auto px-8 py-6 pb-32',
                viewFormat !== 'pdf' && 'max-w-4xl',
                viewFormat === 'pdf' && !pdfPageViewMode && 'max-w-4xl'
              )}
            >
              {selectedPlots.length === 0 ? (
                <div className="text-center text-muted-foreground text-[11px] py-12">
                  플롯을 선택하세요.
                </div>
              ) : viewFormat === 'pdf' ? (
                (() => {
                  const marginVal = PDF_MARGIN_MM[pdfMargin]
                  const renderPageContent = (plots: typeof sortedSelectedPlots, showHeader: boolean) => (
                    <div
                      ref={
                        pdfPageBreakRule === 'height' && plots.length === sortedSelectedPlots.length
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
                      {showHeader && (
                        <div className="border-b border-gray-200 pb-4 mb-6">
                          <h1 className="text-[22px] font-bold m-0 leading-tight">
                            {file?.project.title ?? '제목 없음'}
                          </h1>
                          <p className="text-[13px] text-gray-500 m-0 mt-1">
                            {episode?.number ?? 0}화{episode?.subtitle ? ` – ${episode.subtitle}` : ''}
                          </p>
                        </div>
                      )}
                      <PDFFormat {...formatProps} plots={plots} />
                    </div>
                  )
                  const singlePageContent = renderPageContent(sortedSelectedPlots, true)

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
                                {renderPageContent([plot], index === 0)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  if (pdfPageViewMode && pdfPageBreakRule === 'height') {
                    const scale = pdfEffectiveScale
                    const contentH =
                      measuredPdfContentHeight > 0 ? measuredPdfContentHeight : PDF_PAGE_HEIGHT_PX
                    const wrappedHeight = contentH * scale
                    const wrappedWidth = PDF_PAGE_WIDTH_PX * scale
                    return (
                      <div
                        ref={pdfContentScrollRef}
                        onScroll={() => {
                          if (isProgrammaticScrollRef.current) return
                          const el = pdfContentScrollRef.current
                          if (el)
                            setPdfCurrentPage(
                              Math.max(1, Math.floor(el.scrollTop / (PDF_PAGE_HEIGHT_PX * scale)) + 1)
                            )
                        }}
                        className="overflow-auto"
                        style={{ height: PDF_PAGE_HEIGHT_PX * scale, width: wrappedWidth }}
                      >
                        <div style={{ width: wrappedWidth, height: wrappedHeight }}>
                          <div
                            style={{
                              transform: `scale(${scale})`,
                              transformOrigin: '0 0',
                              width: PDF_PAGE_WIDTH_PX,
                              height:
                                measuredPdfContentHeight > 0 ? measuredPdfContentHeight : undefined,
                              minHeight: PDF_PAGE_HEIGHT_PX,
                            }}
                          >
                            {singlePageContent}
                          </div>
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
              ) : viewFormat === 'script' ? (
                <ScriptFormat {...formatProps} />
              ) : viewFormat === 'plot-script' ? (
                <PlotScriptFormat {...formatProps} />
              ) : (
                <EpisodeFormat {...formatProps} episode={episode} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
