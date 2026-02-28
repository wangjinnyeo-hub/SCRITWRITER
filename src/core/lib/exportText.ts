import type { PlotBox, Character, ScriptPropertyType, PropertyStyle } from '@/types'
import type { ExportIncludeOptions, ScriptEngineContext } from '@/lib/scriptEngine/types'
import { DEFAULT_EXPORT_INCLUDE, createUnitFilterFromInclude, filterPlotsById, getSortedUnits } from '@/lib/scriptEngine/filters'
import { getPropertyStyle as getResolvedPropertyStyle, resolveDialogueTextColor } from '@/lib/scriptStyles'
import { groupScriptUnitsByCharacter, UNKNOWN_CHARACTER_NAME } from '@/lib/scriptGrouping'
import { sanitizeTitleForFilename } from '@/lib/fileIO'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export type { ExportIncludeOptions } from '@/lib/scriptEngine/types'
export { DEFAULT_EXPORT_INCLUDE } from '@/lib/scriptEngine/filters'

/** 내보내기 텍스트 포맷 (다운로드/클립보드용) */
export type ExportTextFormat = 'clipstudio' | 'txt' | 'markdown'
export type PdfPageSize = 'a4' | 'a5' | 'b5' | 'letter' | 'legal'
export interface PdfMarginMm { top: number; right: number; bottom: number; left: number }

/**
 * 플롯 박스 목록과 옵션으로 내보내기용 텍스트 생성.
 * ExportDialog·전체보기 등에서 공통 사용.
 */
export function generateExportText(params: {
  plotBoxes: PlotBox[]
  characters: Character[]
  projectTitle?: string
  episodeTitle?: string
  format: ExportTextFormat
  include: ExportIncludeOptions
}): string {
  const { plotBoxes, characters, projectTitle, episodeTitle, format, include } = params
  const context: ScriptEngineContext = {
    plotBoxes,
    characters,
    projectTitle,
    episodeTitle,
    include,
  }
  return generateExportTextFromContext({
    context,
    format,
  })
}

export function generateExportTextFromContext(params: {
  context: ScriptEngineContext
  format: ExportTextFormat
}): string {
  const { context, format } = params
  const include = context.include ?? DEFAULT_EXPORT_INCLUDE
  const plotBoxes = filterPlotsById(context.plotBoxes, context.selectedPlotIds)
  const unitFilter = createUnitFilterFromInclude(include)
  const projectTitle = context.projectTitle?.trim() ?? ''
  const episodeTitle = context.episodeTitle?.trim() ?? ''
  let output = ''

  if (include.projectTitle && projectTitle) {
    if (format === 'markdown') output += `# ${projectTitle}\n\n`
    else output += `${projectTitle}\n\n`
  }
  if (include.episodeTitle && episodeTitle) {
    if (format === 'markdown') output += `## ${episodeTitle}\n\n`
    else output += `${episodeTitle}\n\n`
  }

  for (const [plotIndex, box] of plotBoxes.entries()) {
    if (include.plotBoxTitle && box.title?.trim()) {
      const plotLabel = `P${plotIndex + 1} ${box.title.trim()}`
      if (format === 'markdown') output += `### ${plotLabel}\n\n`
      else output += `${plotLabel}\n\n`
    }
    if (include.plotBoxContent && box.content?.trim()) {
      if (format === 'markdown') output += `${box.content.trim()}\n\n`
      else output += `${box.content.trim()}\n\n`
    }

    const units = getSortedUnits(box)

    for (const unit of units) {
      if (!unitFilter(unit)) continue

      let line = ''

      if (unit.type === 'dialogue' && include.characterName) {
        const char = context.characters.find(c => c.id === unit.characterId)
        if (char) line += `${char.name}\n`
      }

      line += unit.content

      if (format === 'clipstudio') {
        output += line + '\n\n'
      } else if (format === 'markdown') {
        if (unit.type === 'background') {
          output += `## ${line}\n\n`
        } else if (unit.type === 'direction') {
          output += `*${line}*\n\n`
        } else if (unit.type === 'dialogue') {
          const char = context.characters.find(c => c.id === unit.characterId)
          if (char && include.characterName) {
            output += `**${char.name}**: ${unit.content}\n\n`
          } else {
            output += `${line}\n\n`
          }
        } else {
          output += `${line}\n\n`
        }
      } else {
        output += line + '\n'
      }
    }

    if (format === 'clipstudio') {
      output += '\n'
    } else if (format === 'markdown') {
      output += '---\n\n'
    } else {
      output += '\n'
    }
  }

  return output
}

/** 텍스트를 파일로 다운로드 */
export function downloadAsFile(
  content: string,
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 클립보드에 복사 */
export async function copyToClipboard(content: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('copy-unsupported')
  }

  const textarea = document.createElement('textarea')
  textarea.value = content
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.select()

  const succeeded = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!succeeded) {
    throw new Error('copy-unsupported')
  }
}

/** 인쇄용 HTML에서 사용할 텍스트 이스케이프 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 스타일 객체를 인쇄용 인라인 style 문자열로 변환 */
function toInlineStyle(style: Record<string, string | number | undefined>): string {
  const parts: string[] = []
  if (style.color) parts.push(`color: ${style.color}`)
  if (style.fontWeight) parts.push(`font-weight: ${style.fontWeight}`)
  if (style.fontStyle) parts.push(`font-style: ${style.fontStyle}`)
  if (style.textAlign) parts.push(`text-align: ${style.textAlign}`)
  if (style.fontFamily) parts.push(`font-family: ${style.fontFamily}`)
  if (style.fontSize) parts.push(`font-size: ${typeof style.fontSize === 'number' ? `${style.fontSize}px` : style.fontSize}`)
  return parts.join('; ')
}

/** PDF 페이지 여백 (mm) */
const DEFAULT_PDF_MARGIN_MM: PdfMarginMm = { top: 24, right: 20, bottom: 28, left: 20 }

/** PDF 인쇄용 전체 HTML 문서 생성 (전체보기 미리보기와 동일한 서식·여백·크기 적용) */
export interface PdfPrintParams {
  title: string
  subtitle: string
  episodeNum: number
  plotBoxes: PlotBox[]
  characters: Character[]
  include: ExportIncludeOptions
  propertyStyles: Record<ScriptPropertyType, PropertyStyle>
  dialogueColorMode: 'character' | 'black' | 'custom'
  dialogueCustomColor: string
  defaultFontFamily?: string
  /** 대사 단락 간격(px). 미리보기와 동일. 미지정 시 2 */
  dialogueParagraphGap?: number
  /** 페이지 크기. 미지정 시 A4 */
  pageSize?: PdfPageSize
  /** 여백(mm). 미리보기와 동일. 미지정 시 24,20,28,20 */
  marginMm?: PdfMarginMm
}

const PAGE_DIMENSIONS: Record<PdfPageSize, { widthPt: number; heightPt: number; widthPx: number; heightPx: number }> = {
  a4: { widthPt: 595.28, heightPt: 841.89, widthPx: 794, heightPx: 1123 },
  a5: { widthPt: 420.94, heightPt: 595.28, widthPx: 561, heightPx: 794 },
  b5: { widthPt: 516.14, heightPt: 729.45, widthPx: 688, heightPx: 972 },
  letter: { widthPt: 612, heightPt: 792, widthPx: 816, heightPx: 1056 },
  legal: { widthPt: 612, heightPt: 1008, widthPx: 816, heightPx: 1344 },
}

export function getPageDimensions(pageSize: PdfPageSize) {
  return PAGE_DIMENSIONS[pageSize] ?? PAGE_DIMENSIONS.a4
}

export function generatePdfPrintDocument(params: PdfPrintParams): string {
  const {
    title,
    subtitle,
    episodeNum,
    plotBoxes,
    characters,
    include,
    propertyStyles,
    dialogueColorMode,
    dialogueCustomColor,
    defaultFontFamily,
    dialogueParagraphGap = 2,
    pageSize = 'a4',
    marginMm = DEFAULT_PDF_MARGIN_MM,
  } = params
  const m = marginMm
  const marginCss = `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`
  const gapPx = Math.max(0, Number(dialogueParagraphGap)) || 2
  const bodyFontFamily = defaultFontFamily?.trim()
    ? `${escapeHtml(defaultFontFamily.trim())}, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`
    : "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"
  const unitFilter = createUnitFilterFromInclude(include)
  const getCharName = (charId?: string, dialogueLabel?: string): string => {
    const extra = characters.find(c => c.name === '엑스트라')
    if (charId && extra && charId === extra.id) {
      return dialogueLabel?.trim() ? dialogueLabel : extra.name
    }
    const name = characters.find(c => c.id === charId)?.name
    if (name) return name
    if (dialogueLabel?.trim()) return dialogueLabel.trim()
    return extra?.name ?? UNKNOWN_CHARACTER_NAME
  }
  const getCharColor = (charId?: string): string =>
    characters.find(c => c.id === charId)?.color || '#111111'
  const getStyle = (type: ScriptPropertyType) =>
    getResolvedPropertyStyle(propertyStyles, type, defaultFontFamily)
  const getDialogueColor = (charId?: string) =>
    resolveDialogueTextColor({
      dialogueColorMode,
      dialogueCustomColor,
      characterColor: getCharColor(charId),
    })

  const blocks: string[] = []
  for (const [plotIndex, box] of plotBoxes.entries()) {
    if (plotIndex > 0 && (include.plotBoxSeparator ?? true)) {
      blocks.push('<div class="print-plot-separator" data-pdf-unit></div>')
    }
    if (include.plotBoxTitle && box.title?.trim()) {
      blocks.push(`<div class="print-plot-title" data-pdf-unit><span>P${plotIndex + 1}</span> <span class="plot-title-text">${escapeHtml(box.title.trim())}</span></div>`)
    } else if (include.plotBoxTitle) {
      blocks.push(`<div class="print-plot-title" data-pdf-unit><span>P${plotIndex + 1}</span></div>`)
    }
    if (include.plotBoxContent && box.content?.trim()) {
      const contentEscaped = escapeHtml(box.content.trim()).replace(/\n/g, '<br>')
      blocks.push(`<div class="print-plot-content" data-pdf-unit>${contentEscaped}</div>`)
    }
    const units = getSortedUnits(box).filter(unitFilter)
    const groups = groupScriptUnitsByCharacter(units, getCharName, getCharColor)
    for (const group of groups) {
      if (group.type === 'dialogue-group') {
        const charName = group.characterName
        const charColor = group.characterColor || '#111111'
        const charStyle = getStyle('character')
        const dialogueStyle = getStyle('dialogue')
        const nameStyle = toInlineStyle({ ...charStyle, color: charColor })
        const textStyle = toInlineStyle({ ...dialogueStyle, color: getDialogueColor(group.characterId) })
        const lines = group.units
          .map((unit) => `<div class="print-dialogue-line" style="${escapeHtml(textStyle)}">${escapeHtml(unit.content).replace(/\n/g, '<br>') || ' '}</div>`)
          .join('')
        blocks.push(
          `<div class="print-unit print-dialogue-block" data-pdf-unit>` +
            `${include.characterName ? `<div class="print-dialogue-name" style="${escapeHtml(nameStyle)}">${escapeHtml(charName)}</div>` : ''}` +
            `<div class="print-dialogue-wrap">${(include.dialogueLine ?? true) ? `<div class="print-dialogue-bar" style="background:${escapeHtml(charColor)}"></div>` : ''}<div class="print-dialogue-content">${lines}</div></div>` +
          `</div>`
        )
        continue
      }
      const unit = group.unit
      const contentEscaped = escapeHtml(unit.content).replace(/\n/g, '<br>')
      const style = toInlineStyle(getStyle(unit.type))
      blocks.push(`<div class="print-unit print-${unit.type}" data-pdf-unit style="${escapeHtml(style)}">${contentEscaped || ' '}</div>`)
    }
  }

  const bodyHtml = blocks.length > 0 ? blocks.join('\n') : '<p class="print-p"> </p>'
  const showHeader = include.projectTitle || include.episodeTitle
  const { widthPx: bodyWidthPx } = getPageDimensions(pageSize)
  const pageSizeCss =
    pageSize === 'letter' ? 'letter' :
    pageSize === 'legal' ? 'legal' :
    pageSize === 'a5' ? 'A5' :
    pageSize === 'b5' ? '176mm 250mm' :
    'A4'
  const headerHtml = showHeader
    ? `<div class="print-header" data-pdf-unit>
    ${include.projectTitle ? `<h1 class="print-title">${escapeHtml(title)}</h1>` : ''}
    ${include.episodeTitle ? `<p class="print-subtitle">${episodeNum}화${subtitle ? ` – ${escapeHtml(subtitle)}` : ''}</p>` : ''}
  </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} - ${episodeNum}화</title>
  <style>
    @page { size: ${pageSizeCss}; margin: ${marginCss}; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-unit { page-break-inside: avoid; }
      .print-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 10px; color: #666; padding: 4px 0; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: ${bodyFontFamily};
      width: ${bodyWidthPx}px;
      max-width: ${bodyWidthPx}px;
      margin: 0 auto;
      padding: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;
      line-height: 1.375;
      font-size: 11px;
      color: #1a1a1a;
      overflow-x: hidden;
    }
    .print-header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
    .print-title { font-size: 22px; font-weight: 700; margin: 0 0 6px 0; }
    .print-subtitle { font-size: 13px; color: #6b7280; margin: 0; }
    .print-body { }
    .print-plot-separator { margin: 12px 0 0; padding-top: 12px; border-top: 1px solid rgba(229,231,235,0.7); }
    .print-plot-title { margin: 8px 0 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(229,231,235,0.7); font-size: 11px; font-weight: 600; color: rgba(0,0,0,0.9); }
    .print-plot-title .plot-title-text { font-size: 10px; color: rgba(0,0,0,0.6); }
    .print-plot-content { margin: 4px 0 8px; padding: 6px 0; font-size: 10px; color: rgba(0,0,0,0.7); white-space: pre-wrap; word-break: keep-all; line-height: 1.5; }
    .print-unit { margin-bottom: 0; padding: 2px 0; white-space: pre-wrap; word-break: keep-all; }
    .print-dialogue-block { margin-bottom: 0; }
    .print-dialogue-name { margin: 0; padding: 2px 0 2px 6px; font-weight: bold; line-height: 1; }
    .print-dialogue-wrap { display: flex; gap: 0; align-items: stretch; }
    .print-dialogue-bar { width: 2px; border-radius: 999px; flex-shrink: 0; }
    .print-dialogue-content { padding-left: 6px; min-width: 0; }
    .print-dialogue-line { margin-top: ${gapPx}px; padding: 2px 0; white-space: pre-wrap; word-break: keep-all; line-height: 1.375; }
    .print-narration { text-align: center; }
    .print-direction { text-align: center; }
    .print-footer { display: none; }
    @media print { .print-footer { display: block; } }
  </style>
</head>
<body>
  ${headerHtml}
  <div class="print-body">${bodyHtml}</div>
  <div class="print-footer">– <span class="page-number"></span> –</div>
  <script>
    (function() {
      var style = document.createElement('style');
      style.textContent = '@media print { .page-number::after { content: counter(page) " / " counter(pages); } }';
      document.head.appendChild(style);
    })();
  </script>
</body>
</html>`
}

/** PDF 인쇄 창 열기 (전체보기와 동일한 유형별 스타일로 HTML 생성 후 인쇄). */
export function exportToPdfFromContext(params: PdfPrintParams): boolean {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return false
  const html = generatePdfPrintDocument(params)
  printWindow.document.write(html)
  printWindow.document.close()
  setTimeout(() => printWindow.print(), 250)
  return true
}

const PX_TO_PT = 72 / 96 // 96dpi, 72pt per inch

/** HTML을 iframe에 넣고 렌더링한 뒤 PDF 파일로 직접 다운로드. 실패 시 false 반환. */
export async function exportToPdfDownload(params: PdfPrintParams & { filename?: string }): Promise<boolean> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false

  const pageSize = params.pageSize ?? 'a4'
  const { widthPx, heightPx } = getPageDimensions(pageSize)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('style', `position:fixed;left:-9999px;width:${widthPx}px;height:${heightPx}px;border:0;`)
  document.body.appendChild(iframe)

  try {
    const doc = iframe.contentDocument
    if (!doc) return false

    const html = generatePdfPrintDocument(params)
    doc.open()
    doc.write(html)
    doc.close()

    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve()
      iframe.onerror = () => reject(new Error('iframe load failed'))
      if (doc.readyState === 'complete') setTimeout(() => resolve(), 0)
    })
    await new Promise(r => setTimeout(r, 100))

    const body = doc.body
    if (!body) return false

    const scale = 2
    const bodyScrollHeight = Math.max(body.scrollHeight, body.offsetHeight, heightPx)
    const canvas = await html2canvas(body, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      width: widthPx,
      height: bodyScrollHeight,
      windowWidth: widthPx,
      windowHeight: Math.max(heightPx, bodyScrollHeight),
    })

    const MM_TO_PX = 96 / 25.4
    const m = params.marginMm ?? DEFAULT_PDF_MARGIN_MM
    const marginTopPx = m.top * MM_TO_PX
    const marginBottomPx = m.bottom * MM_TO_PX
    const contentHeightPerPage = Math.max(1, heightPx - marginTopPx - marginBottomPx)

    const units = Array.from(body.querySelectorAll<HTMLElement>('[data-pdf-unit]'))
    const bodyRect = body.getBoundingClientRect()
    const bodyScrollTop = body.scrollTop
    const withPos = units
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { top: r.top - bodyRect.top + bodyScrollTop, height: r.height }
      })
      .sort((a, b) => a.top - b.top)
    const totalH = Math.max(body.offsetHeight, body.scrollHeight, ...withPos.map((x) => x.top + x.height))
    let breakStarts: number[]
    if (withPos.length === 0) {
      breakStarts = [0]
      for (let y = 0; y < totalH; y += heightPx) breakStarts.push(Math.min(y + heightPx, totalH))
    } else {
      breakStarts = [0]
      for (const u of withPos) {
        const pageStart = breakStarts[breakStarts.length - 1]
        if (u.top + u.height - pageStart > contentHeightPerPage && u.top > pageStart)
          breakStarts.push(u.top)
      }
      breakStarts.push(Math.max(totalH, ...withPos.map((x) => x.top + x.height)))
    }

    const dims = getPageDimensions(pageSize)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: pageSize === 'b5' ? [dims.widthPt, dims.heightPt] : pageSize,
    })
    const canvasWidthPx = canvas.width / scale
    const canvasWidthPt = canvasWidthPx * PX_TO_PT
    const totalPages = breakStarts.length - 1

    for (let i = 0; i < totalPages; i++) {
      const sliceSrcY = breakStarts[i] * scale
      const sliceHeightPx = Math.min((breakStarts[i + 1] - breakStarts[i]) * scale, canvas.height - sliceSrcY)
      const sliceHeightPt = (sliceHeightPx / scale) * PX_TO_PT

      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = sliceHeightPx
      const pageCtx = pageCanvas.getContext('2d')
      if (!pageCtx) continue
      pageCtx.drawImage(
        canvas,
        0, sliceSrcY, canvas.width, sliceHeightPx,
        0, 0, canvas.width, sliceHeightPx
      )
      const imgData = pageCanvas.toDataURL('image/jpeg', 0.92)

      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, 0, canvasWidthPt, sliceHeightPt)
    }

    const filename = params.filename ?? `${sanitizeTitleForFilename(params.title)}_${params.episodeNum}화.pdf`
    pdf.save(filename)
    return true
  } catch {
    return false
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
    }
  }
}

/** 인쇄 창으로 PDF 저장 (제목·부제 사용). A4 기준. 평문 단락만 사용하는 레거시 방식. */
export function exportToPdfWindow(
  content: string,
  title: string,
  subtitle: string,
  episodeNum: number
): boolean {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return false

  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const bodyHtml =
    paragraphs.length > 0
      ? paragraphs.map((p) => `<p class="print-p">${escapeHtml(p)}</p>`).join('\n')
      : `<p class="print-p">${escapeHtml(content) || ' '}</p>`

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)} - ${episodeNum}화</title>
        <style>
          @page {
            size: A4;
            margin: 24mm 20mm 28mm 20mm;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-p { page-break-inside: avoid; }
            .print-footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 10px; color: #666; padding: 4px 0; }
          }
          * { box-sizing: border-box; }
          body {
            font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
            max-width: 100%;
            margin: 0 auto;
            padding: 0 20px 40px;
            line-height: 1.85;
            font-size: 11pt;
            color: #1a1a1a;
          }
          .print-header {
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e0e0e0;
          }
          .print-title { font-size: 22pt; font-weight: 700; margin: 0 0 6px 0; }
          .print-subtitle { font-size: 13pt; color: #555; margin: 0; }
          .print-p {
            margin: 0 0 14px 0;
            white-space: pre-wrap;
            word-break: keep-all;
          }
          .print-footer { display: none; }
          @media print {
            .print-footer { display: block; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1 class="print-title">${escapeHtml(title)}</h1>
          <p class="print-subtitle">${episodeNum}화${subtitle ? ` – ${escapeHtml(subtitle)}` : ''}</p>
        </div>
        <div class="print-body">${bodyHtml}</div>
        <div class="print-footer">– <span class="page-number"></span> –</div>
        <script>
          (function() {
            if (typeof document.querySelector === 'undefined') return;
            var style = document.createElement('style');
            style.textContent = '@media print { .page-number::after { content: counter(page) " / " counter(pages); } }';
            document.head.appendChild(style);
          })();
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
  setTimeout(() => printWindow.print(), 250)
  return true
}
