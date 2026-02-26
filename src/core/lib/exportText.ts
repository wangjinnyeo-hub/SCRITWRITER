import type { PlotBox, Character, ScriptPropertyType, PropertyStyle } from '@/types'
import type { ExportIncludeOptions, ScriptEngineContext } from '@/lib/scriptEngine/types'
import { DEFAULT_EXPORT_INCLUDE, createUnitFilterFromInclude, filterPlotsById, getSortedUnits } from '@/lib/scriptEngine/filters'
import { getPropertyStyle as getResolvedPropertyStyle, resolveDialogueTextColor } from '@/lib/scriptStyles'
import { UNKNOWN_CHARACTER_NAME } from '@/lib/scriptGrouping'
import { sanitizeTitleForFilename } from '@/lib/fileIO'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export type { ExportIncludeOptions } from '@/lib/scriptEngine/types'
export { DEFAULT_EXPORT_INCLUDE } from '@/lib/scriptEngine/filters'

/** 내보내기 텍스트 포맷 (다운로드/클립보드용) */
export type ExportTextFormat = 'clipstudio' | 'txt' | 'markdown'

/**
 * 플롯 박스 목록과 옵션으로 내보내기용 텍스트 생성.
 * ExportDialog·전체보기 등에서 공통 사용.
 */
export function generateExportText(params: {
  plotBoxes: PlotBox[]
  characters: Character[]
  format: ExportTextFormat
  include: ExportIncludeOptions
}): string {
  const { plotBoxes, characters, format, include } = params
  const context: ScriptEngineContext = {
    plotBoxes,
    characters,
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
  let output = ''

  for (const box of plotBoxes) {
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

/** PDF 인쇄용 전체 HTML 문서 생성 (전체보기 PDF 형식과 동일한 유형별 스타일 적용) */
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
  } = params

  const unitFilter = createUnitFilterFromInclude(include)
  const getCharName = (charId?: string, dialogueLabel?: string): string => {
    const extra = characters.find(c => c.name === '엑스트라')
    if (charId && extra && charId === extra.id) {
      const label = dialogueLabel?.trim() ? dialogueLabel : extra.name
      return label.toUpperCase()
    }
    const name = characters.find(c => c.id === charId)?.name
    if (name) return name.toUpperCase()
    if (dialogueLabel?.trim()) return dialogueLabel.trim().toUpperCase()
    return (extra?.name ?? UNKNOWN_CHARACTER_NAME).toUpperCase()
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
  for (const box of plotBoxes) {
    const units = getSortedUnits(box).filter(unitFilter)
    for (const unit of units) {
      const contentEscaped = escapeHtml(unit.content).replace(/\n/g, '<br>')
      if (unit.type === 'background') {
        const style = toInlineStyle(getStyle('background'))
        blocks.push(`<div class="print-unit print-background" style="${escapeHtml(style)}">${contentEscaped || ' '}</div>`)
        continue
      }
      if (unit.type === 'dialogue') {
        const charName = getCharName(unit.characterId, unit.dialogueLabel)
        const charColor = getCharColor(unit.characterId)
        const dialogueColor = getDialogueColor(unit.characterId)
        const charStyle = getStyle('character')
        const dialogueStyle = getStyle('dialogue')
        const nameStyle = toInlineStyle({
          ...charStyle,
          color: charColor,
        })
        const textStyle = toInlineStyle({ ...dialogueStyle, color: dialogueColor })
        if (include.characterName) {
          blocks.push(
            `<div class="print-unit print-dialogue">` +
              `<div class="print-dialogue-name" style="${escapeHtml(nameStyle)}">${escapeHtml(charName)}</div>` +
              `<div class="print-dialogue-content" style="${escapeHtml(textStyle)}">${contentEscaped || ' '}</div>` +
              `</div>`
          )
        } else {
          blocks.push(
            `<div class="print-unit print-dialogue"><div class="print-dialogue-content" style="${escapeHtml(textStyle)}">${contentEscaped || ' '}</div></div>`
          )
        }
        continue
      }
      if (unit.type === 'action') {
        const style = toInlineStyle(getStyle('action'))
        blocks.push(`<div class="print-unit print-action" style="${escapeHtml(style)}">${contentEscaped || ' '}</div>`)
        continue
      }
      if (unit.type === 'narration') {
        const style = toInlineStyle(getStyle('narration'))
        blocks.push(`<div class="print-unit print-narration" style="${escapeHtml(style)}">${contentEscaped || ' '}</div>`)
        continue
      }
      if (unit.type === 'direction') {
        const style = toInlineStyle(getStyle('direction'))
        blocks.push(`<div class="print-unit print-direction" style="${escapeHtml(style)}">${contentEscaped || ' '}</div>`)
        continue
      }
      if (unit.type === 'character') {
        const style = toInlineStyle(getStyle('character'))
        blocks.push(`<div class="print-unit print-character" style="${escapeHtml(style)}">${contentEscaped || ' '}</div>`)
      }
    }
  }

  const bodyHtml = blocks.length > 0 ? blocks.join('\n') : '<p class="print-p"> </p>'

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} - ${episodeNum}화</title>
  <style>
    @page { size: A4; margin: 24mm 20mm 28mm 20mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-unit { page-break-inside: avoid; }
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
    .print-header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e0e0e0; }
    .print-title { font-size: 22pt; font-weight: 700; margin: 0 0 6px 0; }
    .print-subtitle { font-size: 13pt; color: #555; margin: 0; }
    .print-body { }
    .print-unit { margin-bottom: 14px; white-space: pre-wrap; word-break: keep-all; }
    .print-background { text-transform: uppercase; letter-spacing: 0.05em; }
    .print-dialogue { margin-left: 0; max-width: 28em; }
    .print-dialogue-name { text-align: center; margin-bottom: 4px; font-weight: bold; }
    .print-dialogue-content { }
    .print-narration { text-align: center; }
    .print-direction { text-align: center; }
    .print-footer { display: none; }
    @media print { .print-footer { display: block; } }
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

const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89
const PX_TO_PT = 72 / 96 // 96dpi, 72pt per inch

/** HTML을 iframe에 넣고 렌더링한 뒤 PDF 파일로 직접 다운로드. */
export async function exportToPdfDownload(params: PdfPrintParams & { filename?: string }): Promise<boolean> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false

  const iframe = document.createElement('iframe')
  iframe.setAttribute('style', 'position:fixed;left:-9999px;width:794px;height:1123px;border:0;')
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    document.body.removeChild(iframe)
    return false
  }

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
  if (!body) {
    document.body.removeChild(iframe)
    return false
  }

  try {
    const scale = 2
    const canvas = await html2canvas(body, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const canvasWidthPt = (canvas.width / scale) * PX_TO_PT
    const canvasHeightPt = (canvas.height / scale) * PX_TO_PT
    const totalPages = Math.ceil(canvasHeightPt / A4_HEIGHT_PT) || 1
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, -(i * A4_HEIGHT_PT), canvasWidthPt, canvasHeightPt)
    }

    const filename = params.filename ?? `${sanitizeTitleForFilename(params.title)}_${params.episodeNum}화.pdf`
    pdf.save(filename)
    return true
  } finally {
    document.body.removeChild(iframe)
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
