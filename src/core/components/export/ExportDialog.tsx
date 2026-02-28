import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore } from '@/store/ui/uiStore'
import { useSettingsStore } from '@/store/settings/settingsStore'
import {
  type ExportTextFormat,
  type ExportIncludeOptions,
  DEFAULT_EXPORT_INCLUDE,
  generateExportTextFromContext,
  downloadAsFile,
  copyToClipboard,
  exportToPdfFromContext,
  exportToPdfDownload,
} from '@/lib/exportText'
import { sanitizeTitleForFilename } from '@/lib/fileIO'
import type { ScriptEngineContext } from '@/lib/scriptEngine/types'
import { WorkspaceStyleDialog } from '@/components/ui/WorkspaceStyleDialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  episodeIdOverride?: string
  initialSelectedPlotBoxIds?: string[]
  initialIncludeProperties?: Partial<ExportIncludeOptions>
}

type ExportFormat = ExportTextFormat | 'pdf'
type NoticeTone = 'success' | 'error'
const COPY_TIMEOUT_MS = 1800

export function ExportDialog({
  open,
  onClose,
  episodeIdOverride,
  initialSelectedPlotBoxIds,
  initialIncludeProperties,
}: ExportDialogProps) {
  const file = useProjectStore(state => state.file)
  const activeEpisodeId = useUIStore(state => state.activeEpisodeId)
  const propertyLabels = useSettingsStore(state => state.propertyLabels)
  const propertyStyles = useSettingsStore(state => state.propertyStyles)
  const dialogueColorMode = useSettingsStore(state => state.dialogueColorMode)
  const dialogueCustomColor = useSettingsStore(state => state.dialogueCustomColor)
  const defaultFontFamily = useSettingsStore(state => state.defaultFontFamily)
  const dialogueParagraphGap = useSettingsStore(state => state.dialogueParagraphGap)
  const pdfPageSize = useSettingsStore(state => state.pdfPageSize)
  const pdfCustomMarginMm = useSettingsStore(state => state.pdfCustomMarginMm)
  const targetEpisodeId = episodeIdOverride ?? activeEpisodeId
  
  const [format, setFormat] = useState<ExportFormat>('clipstudio')
  const [includeProperties, setIncludeProperties] = useState<ExportIncludeOptions>({
    ...DEFAULT_EXPORT_INCLUDE,
    ...initialIncludeProperties,
  })
  
  const episode = file?.episodes.find(e => e.id === targetEpisodeId)
  const plotBoxes = episode?.plotBoxes || []
  const allPlotIds = useMemo(() => plotBoxes.map(p => p.id), [plotBoxes])
  
  const [selectedPlotBoxIds, setSelectedPlotBoxIds] = useState<Set<string>>(
    new Set(initialSelectedPlotBoxIds ?? allPlotIds)
  )
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [plotGroupOpen, setPlotGroupOpen] = useState(false)
  const [dialogueGroupOpen, setDialogueGroupOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const safeInitial = (initialSelectedPlotBoxIds && initialSelectedPlotBoxIds.length > 0)
      ? initialSelectedPlotBoxIds.filter(id => allPlotIds.includes(id))
      : allPlotIds
    setSelectedPlotBoxIds(new Set(safeInitial))
    setIncludeProperties({
      ...DEFAULT_EXPORT_INCLUDE,
      ...initialIncludeProperties,
    })
    setNotice(null)
    setIsExporting(false)
  }, [open, allPlotIds, initialSelectedPlotBoxIds, initialIncludeProperties])
  
  const handleToggleProperty = (property: keyof typeof includeProperties) => {
    setIncludeProperties(prev => ({
      ...prev,
      [property]: !prev[property],
    }))
  }
  
  const handleTogglePlotBox = (id: string) => {
    setSelectedPlotBoxIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  
  const handleSelectAllPlots = () => {
    setSelectedPlotBoxIds(new Set(plotBoxes.map(p => p.id)))
  }
  
  const handleDeselectAllPlots = () => {
    setSelectedPlotBoxIds(new Set())
  }
  
  const getExportOutput = () => {
    if (!episode || !file) return ''
    const textFormat: ExportTextFormat = format === 'pdf' ? 'clipstudio' : format
    const context: ScriptEngineContext = {
      plotBoxes,
      characters: file.project.characters,
      projectTitle: file.project.title,
      episodeTitle: `${episode.number}화${episode.subtitle ? ` - ${episode.subtitle}` : ''}`,
      selectedPlotIds: selectedPlotBoxIds,
      include: includeProperties,
    }
    return generateExportTextFromContext({
      context,
      format: textFormat,
    })
  }

  const copyWithTimeout = async (content: string) => {
    await Promise.race([
      copyToClipboard(content),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error('copy-timeout')), COPY_TIMEOUT_MS)
      }),
    ])
  }

  const getCopyFailureMessage = (error: unknown) => {
    if (error instanceof Error) {
      if ('name' in error && (error as Error).name === 'NotAllowedError') {
        return '클립보드 권한이 거부되었습니다. 브라우저 권한을 허용해 주세요.'
      }
      if (error.message === 'copy-timeout') {
        return '클립보드 응답이 지연되어 복사에 실패했습니다. 다시 시도해 주세요.'
      }
      if (error.message === 'copy-unsupported') {
        return '이 환경에서는 클립보드 API를 지원하지 않습니다.'
      }
    }
    return '클립보드 복사에 실패했습니다. 권한을 확인해 주세요.'
  }

  const handleExport = async () => {
    if (!episode || !file) return
    setIsExporting(true)
    const output = getExportOutput()

    let exportSucceeded = false

    try {
      if (format === 'pdf') {
        const plotBoxesToExport = plotBoxes.filter(p => selectedPlotBoxIds.has(p.id))
        exportSucceeded = exportToPdfFromContext({
          title: file.project.title,
          subtitle: episode.subtitle,
          episodeNum: episode.number,
          plotBoxes: plotBoxesToExport,
          characters: file.project.characters,
          include: includeProperties,
          propertyStyles,
          dialogueColorMode,
          dialogueCustomColor,
          defaultFontFamily: defaultFontFamily || undefined,
          dialogueParagraphGap,
          pageSize: pdfPageSize,
          marginMm: pdfCustomMarginMm,
        })
        if (!exportSucceeded) {
          setNotice({ tone: 'error', text: '팝업이 차단되어 인쇄 창을 열지 못했습니다. 브라우저 팝업 허용 후 다시 시도해 주세요.' })
          return
        }
      } else {
        const ext = format === 'markdown' ? 'md' : 'txt'
        downloadAsFile(output, `${file.project.title}_${episode.number}화_${format}.${ext}`)
        exportSucceeded = true
      }

      await copyWithTimeout(output)
      setNotice({
        tone: 'success',
        text: format === 'pdf'
          ? '인쇄 창을 열고 클립보드에 복사했습니다.'
          : '파일 다운로드와 클립보드 복사를 완료했습니다.',
      })
      if (exportSucceeded) {
        setTimeout(() => onClose(), 500)
      }
    } catch (error) {
      setNotice({
        tone: 'error',
        text: exportSucceeded
          ? `내보내기는 완료했지만 ${getCopyFailureMessage(error)}`
          : '내보내기에 실패했습니다.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopyOnly = async () => {
    setIsExporting(true)
    try {
      await copyWithTimeout(getExportOutput())
      setNotice({ tone: 'success', text: '클립보드 복사를 완료했습니다.' })
      setTimeout(() => onClose(), 400)
    } catch (error) {
      setNotice({ tone: 'error', text: getCopyFailureMessage(error) })
    } finally {
      setIsExporting(false)
    }
  }

  const handlePdfDownload = async () => {
    if (!episode || !file) return
    setIsExporting(true)
    try {
      const plotBoxesToExport = plotBoxes.filter(p => selectedPlotBoxIds.has(p.id))
      const ok = await exportToPdfDownload({
        title: file.project.title,
        subtitle: episode.subtitle,
        episodeNum: episode.number,
        plotBoxes: plotBoxesToExport,
        characters: file.project.characters,
        include: includeProperties,
        propertyStyles,
        dialogueColorMode,
        dialogueCustomColor,
        defaultFontFamily: defaultFontFamily || undefined,
        dialogueParagraphGap,
        pageSize: pdfPageSize,
        marginMm: pdfCustomMarginMm,
        filename: `${sanitizeTitleForFilename(file.project.title)}_${episode.number}화.pdf`,
      })
      if (ok) {
        setNotice({ tone: 'success', text: 'PDF 파일을 다운로드했습니다.' })
        setTimeout(() => onClose(), 500)
      } else {
        setNotice({ tone: 'error', text: 'PDF 생성에 실패했습니다.' })
      }
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'PDF 생성 중 오류가 발생했습니다.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  if (!episode) {
    return null
  }
  
  return (
    <WorkspaceStyleDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="내보내기"
      size="medium"
      description="내보낼 형식, 포함 유형, 플롯을 선택해 결과를 생성합니다."
    >
      <div className="flex-1 overflow-auto px-4 py-3 space-y-4 flex flex-col min-h-0">
          <section>
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">내보내기 형식</h3>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'clipstudio', label: '클립스튜디오' },
                { value: 'pdf', label: 'PDF' },
                { value: 'txt', label: 'TXT' },
                { value: 'markdown', label: '마크다운' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormat(value as ExportFormat)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    format === value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  aria-pressed={format === value}
                >
                  {label}
                </button>
              ))}
            </div>
            {format === 'clipstudio' && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                클립스튜디오 형식: 모든 줄바꿈이 큰 문단 단위로 변환됩니다
              </p>
            )}
          </section>

          <section>
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">포함할 유형</h3>
            <div className="space-y-2">
              <div className="border border-border rounded-md overflow-hidden bg-muted/10">
                <button
                  type="button"
                  onClick={() => setPlotGroupOpen(v => !v)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs font-medium hover:bg-muted/50"
                >
                  <span>플롯박스</span>
                  <span className="text-muted-foreground">{plotGroupOpen ? '▲' : '▼'}</span>
                </button>
                {plotGroupOpen && (
                  <div className="px-2.5 pb-2 flex flex-wrap gap-x-4 gap-y-0.5">
                    <label className="flex items-center gap-1.5 py-1 cursor-pointer hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={includeProperties.plotBoxTitle}
                        onChange={() => handleToggleProperty('plotBoxTitle')}
                        className="w-3 h-3 rounded border-input"
                      />
                      <span className="text-xs">플롯박스 제목</span>
                    </label>
                    <label className="flex items-center gap-1.5 py-1 cursor-pointer hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={includeProperties.plotBoxSeparator}
                        onChange={() => handleToggleProperty('plotBoxSeparator')}
                        className="w-3 h-3 rounded border-input"
                      />
                      <span className="text-xs">구분선</span>
                    </label>
                    <label className="flex items-center gap-1.5 py-1 cursor-pointer hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={includeProperties.plotBoxContent}
                        onChange={() => handleToggleProperty('plotBoxContent')}
                        className="w-3 h-3 rounded border-input"
                      />
                      <span className="text-xs">내 플롯 내용</span>
                    </label>
                    <label className="flex items-center gap-1.5 py-1 cursor-pointer hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={includeProperties.dialogue || includeProperties.action || includeProperties.narration || includeProperties.background || includeProperties.direction}
                        onChange={() => {
                          const on = !(includeProperties.dialogue || includeProperties.action || includeProperties.narration || includeProperties.background || includeProperties.direction)
                          setIncludeProperties(prev => ({ ...prev, dialogue: on, action: on, narration: on, background: on, direction: on }))
                        }}
                        className="w-3 h-3 rounded border-input"
                      />
                      <span className="text-xs">플롯박스 내용</span>
                    </label>
                  </div>
                )}
              </div>
              <div className="border border-border rounded-md overflow-hidden bg-muted/10">
                <button
                  type="button"
                  onClick={() => setDialogueGroupOpen(v => !v)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs font-medium hover:bg-muted/50"
                >
                  <span>대사</span>
                  <span className="text-muted-foreground">{dialogueGroupOpen ? '▲' : '▼'}</span>
                </button>
                {dialogueGroupOpen && (
                  <div className="px-2.5 pb-2 flex flex-wrap gap-x-4 gap-y-0.5">
                    <label className="flex items-center gap-1.5 py-1 cursor-pointer hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={includeProperties.characterName}
                        onChange={() => handleToggleProperty('characterName')}
                        className="w-3 h-3 rounded border-input"
                      />
                      <span className="text-xs">캐릭터 이름</span>
                    </label>
                    <label className="flex items-center gap-1.5 py-1 cursor-pointer hover:text-foreground">
                      <input
                        type="checkbox"
                        checked={includeProperties.dialogueLine ?? true}
                        onChange={() => handleToggleProperty('dialogueLine')}
                        className="w-3 h-3 rounded border-input"
                      />
                      <span className="text-xs">대사선(좌측선)</span>
                    </label>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1 border-t border-border/50">
                <label className="flex items-center gap-1.5 py-1 cursor-pointer hover:text-foreground">
                  <input
                    type="checkbox"
                    checked={includeProperties.projectTitle}
                    onChange={() => handleToggleProperty('projectTitle')}
                    className="w-3 h-3 rounded border-input"
                  />
                  <span className="text-xs">프로젝트 제목</span>
                </label>
                <label className="flex items-center gap-1.5 py-1 cursor-pointer hover:text-foreground">
                  <input
                    type="checkbox"
                    checked={includeProperties.episodeTitle}
                    onChange={() => handleToggleProperty('episodeTitle')}
                    className="w-3 h-3 rounded border-input"
                  />
                  <span className="text-xs">에피소드 제목</span>
                </label>
                {(['dialogue', 'action', 'narration', 'background', 'direction'] as const).map(key => (
                  <label key={key} className="flex items-center gap-1.5 py-1 cursor-pointer hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={includeProperties[key]}
                      onChange={() => handleToggleProperty(key)}
                      className="w-3 h-3 rounded border-input"
                    />
                    <span className="text-xs">{propertyLabels[key]}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">플롯 선택</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSelectAllPlots}
                  className="text-[10px] text-primary hover:underline py-0.5"
                >
                  전체 선택
                </button>
                <span className="text-muted-foreground/60">·</span>
                <button
                  type="button"
                  onClick={handleDeselectAllPlots}
                  className="text-[10px] text-primary hover:underline py-0.5"
                >
                  전체 해제
                </button>
              </div>
            </div>
            <div className="border border-border rounded-md max-h-36 overflow-auto bg-muted/20">
              {plotBoxes.map((box, index) => (
                <label
                  key={box.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted/60 cursor-pointer border-b border-border/50 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedPlotBoxIds.has(box.id)}
                    onChange={() => handleTogglePlotBox(box.id)}
                    className="w-3 h-3 rounded border-input"
                  />
                  <span className="text-xs truncate">
                    P{index + 1}
                    {box.title && <span className="text-muted-foreground"> — {box.title}</span>}
                  </span>
                </label>
              ))}
            </div>
          </section>
      </div>

      <div className="border-t border-border px-4 py-3 space-y-2 bg-[var(--panel-header)]/50 shrink-0">
        {notice && (
          <div
            role="alert"
            aria-live="assertive"
            className={cn(
              'text-[11px] px-2.5 py-1.5 rounded-md border',
              notice.tone === 'success'
                ? 'text-foreground border-primary/30 bg-primary/10'
                : 'text-destructive border-destructive/30 bg-destructive/10'
            )}
          >
            {notice.text}
          </div>
        )}
        <div className="flex justify-end gap-2 flex-wrap">
          <Button onClick={onClose} variant="ghost" size="sm" className="h-7 px-2.5 text-xs" disabled={isExporting}>
            취소
          </Button>
          <Button onClick={handleCopyOnly} variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={isExporting}>
            {isExporting ? '내보내는 중...' : '클립보드만'}
          </Button>
          {format === 'pdf' && (
            <Button onClick={handlePdfDownload} variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={isExporting}>
              {isExporting ? '내보내는 중...' : 'PDF 다운로드'}
            </Button>
          )}
          <Button onClick={handleExport} size="sm" className="h-7 px-2.5 text-xs" disabled={isExporting}>
            {isExporting ? '내보내는 중...' : format === 'pdf' ? '인쇄 창 + 복사' : '다운로드 + 복사'}
          </Button>
        </div>
      </div>
    </WorkspaceStyleDialog>
  )
}
