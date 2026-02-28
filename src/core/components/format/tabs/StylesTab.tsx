import { useState, useRef, useEffect } from 'react'
import { useSettingsStore } from '@/store/settings/settingsStore'
import type { ScriptPropertyType, PropertyStyle } from '@/types'
import { getPropertyStyle as getSharedPropertyStyle, resolveDialogueTextColor, getDialogueTypingMaxWidth } from '@/lib/scriptStyles'
import { cn } from '@/lib/utils'
import { useLocalFontOptions } from '@/hooks/useLocalFontOptions'
import type { FontOption } from '@/lib/localFonts'
import { ColorPicker } from '@/components/ui/ColorPicker'

const ALL_TYPES: ScriptPropertyType[] = ['character', 'dialogue', 'action', 'narration', 'background', 'direction']

const TYPE_SUPPORTED_STYLES: Record<ScriptPropertyType, Set<keyof PropertyStyle>> = {
  character: new Set(['fontFamily', 'fontSize', 'fontWeight']),
  dialogue: new Set(['color', 'fontFamily', 'fontSize', 'fontWeight']),
  action: new Set(['color', 'fontFamily', 'fontSize']),
  narration: new Set(['color', 'fontFamily', 'fontSize', 'textAlign', 'fontStyle']),
  background: new Set(['color', 'fontFamily', 'fontSize', 'fontWeight']),
  direction: new Set(['color', 'fontFamily', 'fontSize', 'textAlign', 'fontStyle']),
}

const SEGMENT_BASE = 'h-6 rounded text-[10px] transition-all border'
const SEGMENT_ACTIVE = 'bg-accent text-foreground border-border shadow-sm'
const SEGMENT_IDLE = 'text-muted-foreground border-transparent hover:bg-accent/50 hover:text-foreground'

/** 폰트 드롭다운 전용 (직접입력 제거). options는 useLocalFontOptions() 등으로 전달 */
function FontSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string
  onChange: (fontFamily: string) => void
  options: FontOption[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const displayOption = options.find((o) => o.value === value) ?? options.find((o) => o.value === '') ?? options[0]
  const displayLabel = value && !options.some((o) => o.value === value) ? value : displayOption.label
  const displayFont = value && options.some((o) => o.value === value) ? value : displayOption.value || 'inherit'

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full h-7 text-left text-[11px] px-2 rounded border border-border bg-background text-foreground flex items-center"
        style={{ fontFamily: displayFont === 'inherit' ? 'inherit' : displayFont }}
      >
        {displayLabel}
      </button>
      {open && (
        <div className="absolute z-50 mt-0.5 w-full max-h-[220px] overflow-auto rounded border border-border bg-background shadow-lg py-0.5">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-accent/50 transition-colors"
              style={{ fontFamily: opt.value ? opt.value : 'inherit' }}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** 크기(px) 드롭다운 */
const FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48]

/** 스크립트 간격(px) 드롭다운 */
const PARAGRAPH_GAP_OPTIONS = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24]

/** 대사 타이핑 너비(ch) 드롭다운 */
const TYPING_WIDTH_CH_OPTIONS = [20, 30, 42, 50, 60, 70, 80, 90, 100, 120]

function StyleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

interface PreviewContentProps {
  styles: Record<ScriptPropertyType, PropertyStyle>
  defaultFontFamily?: string
  dialogueColorMode: 'character' | 'black' | 'custom'
  dialogueCustomColor: string
  dialogueParagraphGap: number
  dialogueTypingWidth: 'narrow' | 'medium' | 'wide' | 'custom'
  dialogueTypingWidthCh: number
  unitDivider: 'none' | 'line' | 'dot'
}

/** 스타일 미리보기용 — 편집기/전체보기와 동일한 서식 적용. 예시는 무난한 문장으로 구성 */
/** 시나리오 창과 동일: 대사는 캐릭터명 한 줄 + 본문만 표시(캐릭터 유닛 별도 없음 → 이름 한 번만 노출) */
const SAMPLE_PLOTS: { title?: string; content?: string; lines: { type: ScriptPropertyType; text: string; charName?: string; charColor?: string }[] }[] = [
  {
    title: '첫 장면',
    content: '실내. 두 사람이 대화한다.',
    lines: [
      { type: 'background', text: '실내 — 낮' },
      { type: 'narration', text: '날씨가 좋은 오후였다.' },
      { type: 'dialogue', text: '안녕, 오늘 시간 돼?', charName: '철수', charColor: '#404040' },
      { type: 'action', text: '영희가 고개를 끄덕인다.' },
    ],
  },
  {
    title: '이어지는 장면',
    content: '대화가 이어진다.',
    lines: [
      { type: 'dialogue', text: '응, 조금 있으면 될 것 같아.', charName: '영희', charColor: '#525252' },
      { type: 'direction', text: '문 쪽을 바라보며' },
      { type: 'narration', text: '그렇게 둘은 이야기를 나누기 시작했다.' },
    ],
  },
]

/** 시나리오 창과 동일한 대사 블록 구조(세로선·캐릭터명·본문 스타일) */
function PreviewContent({ styles, defaultFontFamily, dialogueColorMode, dialogueCustomColor, dialogueParagraphGap, dialogueTypingWidth, dialogueTypingWidthCh, unitDivider }: PreviewContentProps) {
  const dialogueMaxWidth = getDialogueTypingMaxWidth(dialogueTypingWidth, dialogueTypingWidthCh)
  const characterStyle = getSharedPropertyStyle(styles, 'character', defaultFontFamily)

  const renderLines = (lines: { type: ScriptPropertyType; text: string; charName?: string; charColor?: string }[]) => (
    <div className="space-y-0">
      {lines.map((line, i) => {
        const s = getSharedPropertyStyle(styles, line.type, defaultFontFamily)
        const dialogueColor = line.type === 'dialogue'
          ? resolveDialogueTextColor({
              dialogueColorMode,
              dialogueCustomColor,
              characterColor: line.charColor || '#000',
            })
          : undefined

        const dividerEl = unitDivider !== 'none' && i > 0 ? (
          <div className={unitDivider === 'line' ? 'script-unit-divider-line' : 'my-0.5 flex justify-center'}>
            {unitDivider === 'dot' && <span className="text-[6px] text-muted-foreground/30">&#x2022;</span>}
          </div>
        ) : null

        if (line.type === 'dialogue') {
          return (
            <div key={i}>
              {dividerEl}
              {/* 캐릭터 이름 행: 시나리오창처럼 선 없음(스페이서만), 대사 본문에만 세로선 */}
              <div className="flex gap-0">
                <div className="w-0.5 shrink-0" aria-hidden />
                <div
                  className="flex-1 min-w-0 leading-none py-0.5 pl-1"
                  style={{
                    color: line.charColor || '#000',
                    fontWeight: characterStyle.fontWeight || 'bold',
                    fontFamily: characterStyle.fontFamily || 'inherit',
                    fontSize: characterStyle.fontSize || '12px',
                  }}
                >
                  {line.charName}
                </div>
              </div>
              <div className="flex gap-0" style={{ marginTop: `${dialogueParagraphGap}px` }}>
                <div className="w-0.5 shrink-0 rounded-full self-stretch" style={{ backgroundColor: line.charColor || '#999' }} aria-hidden />
                <div
                  className={dialogueMaxWidth ? 'min-w-0 shrink leading-snug whitespace-pre-wrap text-[11px] py-0.5 pl-1.5' : 'flex-1 min-w-0 leading-snug whitespace-pre-wrap text-[11px] py-0.5 pl-1.5'}
                  style={{ color: dialogueColor, ...(dialogueMaxWidth ? { width: dialogueMaxWidth, maxWidth: '100%' } : {}) }}
                >
                  {line.text}
                </div>
              </div>
            </div>
          )
        }
        return (
          <div key={i}>
            {dividerEl}
            <div className="w-full leading-snug whitespace-pre-wrap text-[11px] py-0.5 pl-1.5 min-h-[16px]" style={s}>
              {line.text}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-6">
      {SAMPLE_PLOTS.map((plot, pIdx) => (
        <div key={pIdx} className="space-y-2">
          <div className="flex gap-2 pb-1 border-b border-border/30">
            <span className="text-[11px] font-semibold text-primary">P{pIdx + 1}</span>
            {plot.title && <span className="text-xs text-muted-foreground">{plot.title}</span>}
          </div>
          {renderLines(plot.lines)}
        </div>
      ))}
    </div>
  )
}

export function StylesTab() {
  const [selectedType, setSelectedType] = useState<ScriptPropertyType>('dialogue')
  const fontOptions = useLocalFontOptions()

  const propertyLabels = useSettingsStore(state => state.propertyLabels)
  const propertyStyles = useSettingsStore(state => state.propertyStyles)
  const setPropertyStyle = useSettingsStore(state => state.setPropertyStyle)
  const dialogueColorMode = useSettingsStore(state => state.dialogueColorMode)
  const setDialogueColorMode = useSettingsStore(state => state.setDialogueColorMode)
  const dialogueCustomColor = useSettingsStore(state => state.dialogueCustomColor)
  const setDialogueCustomColor = useSettingsStore(state => state.setDialogueCustomColor)
  const dialogueParagraphGap = useSettingsStore(state => state.dialogueParagraphGap)
  const setDialogueParagraphGap = useSettingsStore(state => state.setDialogueParagraphGap)
  const dialogueTypingWidth = useSettingsStore(state => state.dialogueTypingWidth)
  const setDialogueTypingWidth = useSettingsStore(state => state.setDialogueTypingWidth)
  const dialogueTypingWidthCh = useSettingsStore(state => state.dialogueTypingWidthCh)
  const setDialogueTypingWidthCh = useSettingsStore(state => state.setDialogueTypingWidthCh)
  const unitDivider = useSettingsStore(state => state.unitDivider)
  const setUnitDivider = useSettingsStore(state => state.setUnitDivider)
  const defaultFontFamily = useSettingsStore(state => state.defaultFontFamily)
  const setDefaultFontFamily = useSettingsStore(state => state.setDefaultFontFamily)

  const style = propertyStyles[selectedType]
  const currentStyleColor = style.color || '#0a0a0a'

  return (
    <>
      <div className="w-[280px] border-r border-border overflow-auto p-3">
        <div className="mb-3">
          <div className="text-xs text-muted-foreground mb-1.5">기본 서체 (플롯·제목 등)</div>
          <p className="text-[10px] text-muted-foreground/80 mb-1">스크립트 창 외 플롯, 에피소드 제목 등에 적용</p>
          <FontSelect
            value={defaultFontFamily}
            onChange={setDefaultFontFamily}
            options={fontOptions}
          />
        </div>

        <div className="mb-3">
          <div className="text-xs text-muted-foreground mb-1.5">유형 선택</div>
          <div className="space-y-0.5">
            {ALL_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                  selectedType === t ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: propertyStyles[t].color || '#999' }} />
                {propertyLabels[t]}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="space-y-2.5">
          <div className="border-t border-border pt-3 space-y-2.5">
            <div className="text-xs text-muted-foreground mb-1">속성</div>

            {TYPE_SUPPORTED_STYLES[selectedType].has('color') && selectedType !== 'dialogue' && (
              <StyleRow label="글자색">
                <ColorPicker
                  value={currentStyleColor}
                  onChange={(color) => setPropertyStyle(selectedType, { color })}
                  size="md"
                />
              </StyleRow>
            )}
            {selectedType === 'dialogue' && (
              <StyleRow label="대사색">
                <div className="space-y-1">
                  <div className="grid grid-cols-3 gap-0.5">
                    <button onClick={() => setDialogueColorMode('black')} className={`${SEGMENT_BASE} ${dialogueColorMode === 'black' ? SEGMENT_ACTIVE : SEGMENT_IDLE}`}>검정</button>
                    <button onClick={() => setDialogueColorMode('character')} className={`${SEGMENT_BASE} ${dialogueColorMode === 'character' ? SEGMENT_ACTIVE : SEGMENT_IDLE}`}>캐릭터</button>
                    <button onClick={() => setDialogueColorMode('custom')} className={`${SEGMENT_BASE} ${dialogueColorMode === 'custom' ? SEGMENT_ACTIVE : SEGMENT_IDLE}`}>지정</button>
                  </div>
                  {dialogueColorMode === 'custom' && (
                    <ColorPicker
                      value={dialogueCustomColor}
                      onChange={setDialogueCustomColor}
                      size="md"
                    />
                  )}
                </div>
              </StyleRow>
            )}
            {TYPE_SUPPORTED_STYLES[selectedType].has('fontSize') && (
              <StyleRow label="크기">
                <select
                  value={style.fontSize || 14}
                  onChange={(e) => setPropertyStyle(selectedType, { fontSize: parseInt(e.target.value) || 14 })}
                  className="w-full h-7 text-[11px] px-2 rounded border border-border bg-background text-foreground"
                >
                  {[...new Set([style.fontSize || 14, ...FONT_SIZE_OPTIONS])].sort((a, b) => a - b).map((n) => (
                    <option key={n} value={n}>{n}px</option>
                  ))}
                </select>
              </StyleRow>
            )}
            {TYPE_SUPPORTED_STYLES[selectedType].has('fontFamily') && (
              <StyleRow label="서체">
                <FontSelect
                  value={style.fontFamily || ''}
                  onChange={(v) => setPropertyStyle(selectedType, { fontFamily: v })}
                  options={fontOptions}
                />
              </StyleRow>
            )}
            {TYPE_SUPPORTED_STYLES[selectedType].has('fontWeight') && (
              <StyleRow label="굵기">
                <div className="grid grid-cols-2 gap-0.5">
                  <button
                    onClick={() => setPropertyStyle(selectedType, { fontWeight: 'normal' })}
                    className={`${SEGMENT_BASE} ${(style.fontWeight || 'normal') === 'normal' ? SEGMENT_ACTIVE : SEGMENT_IDLE}`}
                  >
                    보통
                  </button>
                  <button
                    onClick={() => setPropertyStyle(selectedType, { fontWeight: 'bold' })}
                    className={`${SEGMENT_BASE} ${(style.fontWeight || 'normal') === 'bold' ? SEGMENT_ACTIVE : SEGMENT_IDLE}`}
                  >
                    굵게
                  </button>
                </div>
              </StyleRow>
            )}
            {TYPE_SUPPORTED_STYLES[selectedType].has('fontStyle') && (
              <StyleRow label="기울임">
                <div className="grid grid-cols-2 gap-0.5">
                  <button
                    onClick={() => setPropertyStyle(selectedType, { fontStyle: 'normal' })}
                    className={`${SEGMENT_BASE} ${(style.fontStyle || 'normal') === 'normal' ? SEGMENT_ACTIVE : SEGMENT_IDLE}`}
                  >
                    보통
                  </button>
                  <button
                    onClick={() => setPropertyStyle(selectedType, { fontStyle: 'italic' })}
                    className={`${SEGMENT_BASE} ${(style.fontStyle || 'normal') === 'italic' ? SEGMENT_ACTIVE : SEGMENT_IDLE}`}
                  >
                    기울임
                  </button>
                </div>
              </StyleRow>
            )}
            {TYPE_SUPPORTED_STYLES[selectedType].has('textAlign') && (
              <StyleRow label="정렬">
                <div className="flex gap-0.5">
                  {(['left', 'center', 'right'] as const).map(align => (
                    <button key={align} onClick={() => setPropertyStyle(selectedType, { textAlign: align })} className={`flex-1 h-6 flex items-center justify-center rounded text-[10px] transition-all border ${(style.textAlign || 'left') === align ? SEGMENT_ACTIVE : SEGMENT_IDLE}`}>
                      {align === 'left' ? '←' : align === 'center' ? '↔' : '→'}
                    </button>
                  ))}
                </div>
              </StyleRow>
            )}
          </div>

          <div className="border-t border-border pt-3 space-y-2.5 mt-3">
            <div className="text-xs text-muted-foreground mb-1">레이아웃</div>
            <StyleRow label="캐릭터">
              <span className="text-xs text-muted-foreground">대사 상단(캐릭터명+세로선)</span>
            </StyleRow>
            <StyleRow label="스크립트 간격">
              <select
                value={dialogueParagraphGap}
                onChange={(e) => setDialogueParagraphGap(parseInt(e.target.value) || 0)}
                className="w-full h-7 text-[11px] px-2 rounded border border-border bg-background text-foreground"
              >
                {[...new Set([dialogueParagraphGap, ...PARAGRAPH_GAP_OPTIONS])].sort((a, b) => a - b).map((n) => (
                  <option key={n} value={n}>{n}px</option>
                ))}
              </select>
            </StyleRow>
            <StyleRow label="대사 타이핑 너비">
              <div className="space-y-1">
                <div className="grid grid-cols-4 gap-0.5">
                  {(['narrow', 'medium', 'wide', 'custom'] as const).map(w => (
                    <button
                      key={w}
                      onClick={() => setDialogueTypingWidth(w)}
                      className={`${SEGMENT_BASE} ${dialogueTypingWidth === w ? SEGMENT_ACTIVE : SEGMENT_IDLE}`}
                    >
                      {w === 'narrow' ? '좁게' : w === 'medium' ? '중간' : w === 'wide' ? '넓게' : '커스텀'}
                    </button>
                  ))}
                </div>
                {dialogueTypingWidth === 'custom' && (
                  <select
                    value={dialogueTypingWidthCh}
                    onChange={(e) => setDialogueTypingWidthCh(parseInt(e.target.value) || 42)}
                    className="w-full h-7 text-[11px] px-2 rounded border border-border bg-background text-foreground"
                  >
                    {[...new Set([dialogueTypingWidthCh, ...TYPING_WIDTH_CH_OPTIONS])].sort((a, b) => a - b).map((n) => (
                      <option key={n} value={n}>{n}ch</option>
                    ))}
                  </select>
                )}
              </div>
            </StyleRow>
            <StyleRow label="구분">
              <div className="flex gap-0.5">
                {(['none', 'line', 'dot'] as const).map(d => (
                  <button key={d} onClick={() => setUnitDivider(d)} className={`flex-1 h-6 flex items-center justify-center rounded text-[10px] transition-all border ${unitDivider === d ? SEGMENT_ACTIVE : SEGMENT_IDLE}`}>
                    {d === 'none' ? '없음' : d === 'line' ? '선' : '점'}
                  </button>
                ))}
              </div>
            </StyleRow>
          </div>
        </fieldset>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-background">
        <div className="mb-2">
          <span className="text-xs text-muted-foreground">미리보기</span>
        </div>
        <div className="bg-card rounded p-4 min-h-[200px]">
          <PreviewContent
            styles={propertyStyles}
            defaultFontFamily={defaultFontFamily || undefined}
            dialogueColorMode={dialogueColorMode}
            dialogueCustomColor={dialogueCustomColor}
            dialogueParagraphGap={dialogueParagraphGap}
            dialogueTypingWidth={dialogueTypingWidth}
            dialogueTypingWidthCh={dialogueTypingWidthCh}
            unitDivider={unitDivider}
          />
        </div>
      </div>
    </>
  )
}
