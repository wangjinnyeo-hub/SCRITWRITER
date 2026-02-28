import { useState } from 'react'
import type { EpisodeFormatProps } from '../types'
import { getSortedUnits } from '@/lib/scriptEngine/filters'
import { resolveDialogueTextColor } from '@/lib/scriptStyles'

export function EpisodeFormat({
  plots,
  allPlots,
  getPropertyStyle,
  getCharacterName,
  getCharacterColor,
  filterUnit,
  hideCharacterName = false,
  dialogueParagraphGap,
  dialogueTypingMaxWidth,
  unitDivider,
  dialogueColorMode,
  dialogueCustomColor,
  defaultFontFamily,
  episode,
  includeDialogueLine = true,
}: EpisodeFormatProps) {
  const [expandedPlots, setExpandedPlots] = useState<Set<string>>(new Set())
  const characterStyle = getPropertyStyle('character')
  const dialogueStyle = getPropertyStyle('dialogue')
  const showName = !hideCharacterName

  const renderDivider = (index: number) => {
    if (unitDivider === 'none' || index === 0) return null
    if (unitDivider === 'line') return <div className="script-unit-divider-line" />
    return (
      <div className="my-0.5 flex justify-center">
        <span className="text-[6px] text-muted-foreground/30">&#x2022;</span>
      </div>
    )
  }

  const toggleExpand = (plotId: string) => {
    setExpandedPlots(prev => {
      const next = new Set(prev)
      if (next.has(plotId)) next.delete(plotId); else next.add(plotId)
      return next
    })
  }

  const defaultFontStyle = defaultFontFamily ? { fontFamily: defaultFontFamily } : undefined
  return (
    <div className="space-y-6">
      <div className="text-center pb-4 border-b border-border" style={defaultFontStyle}>
        <h1 className="text-lg font-bold mb-1">
          {String(episode?.number || 0).padStart(2, '0')}
          {episode?.subtitle && ` - ${episode.subtitle}`}
        </h1>
        <div className="text-[10px] text-muted-foreground">
          {plots.length}개 플롯
        </div>
      </div>

      {plots.map(box => {
        const scriptUnits = getSortedUnits(box).filter(filterUnit)
        const actualIndex = allPlots.findIndex(b => b.id === box.id)
        const plotNumber = actualIndex >= 0 ? actualIndex + 1 : 1
        const isExpanded = expandedPlots.has(box.id)

        return (
          <div key={box.id} className="space-y-2">
            <div className="flex items-center gap-2 pb-1.5 border-b border-border" style={defaultFontStyle}>
              <span className="text-[11px] font-semibold text-primary">P{plotNumber}</span>
              {box.title && <span className="text-[11px] text-muted-foreground">{box.title}</span>}
            </div>

            {/* 플롯 내용 (항상 표시) */}
            {box.content ? (
              <div className="text-[12px] whitespace-pre-wrap leading-relaxed" style={defaultFontStyle}>
                {box.content}
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground/40 italic" style={defaultFontStyle}>내용 없음</div>
            )}

            {/* 시나리오 유닛 (접기/펼치기) */}
            {scriptUnits.length > 0 && (
              <div className="pt-1">
                <button
                  onClick={() => toggleExpand(box.id)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <svg
                    width="8" height="8" viewBox="0 0 24 24" fill="currentColor"
                    className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  시나리오 {scriptUnits.length}개
                </button>

                {isExpanded && (
                  <div className="mt-2 pl-3 border-l-2 border-border/40 space-y-0">
                    {scriptUnits.map((unit, index) => {
                      const charName = getCharacterName(unit.characterId, unit.dialogueLabel)
                      const charColor = getCharacterColor(unit.characterId)
                      const textColor = resolveDialogueTextColor({
                        dialogueColorMode,
                        dialogueCustomColor,
                        characterColor: charColor,
                      })

                      return (
                        <div key={unit.id}>
                          {renderDivider(index)}
                          {unit.type === 'dialogue' ? (
                            <>
                              {showName && (
                                <div className="flex gap-0">
                                  <div className="w-0.5 shrink-0" aria-hidden />
                                  <div
                                    className="flex-1 min-w-0 leading-none py-0.5 pl-1"
                                    style={{
                                      color: charColor,
                                      fontWeight: characterStyle.fontWeight || 'bold',
                                      fontFamily: characterStyle.fontFamily || 'inherit',
                                      fontSize: characterStyle.fontSize || '12px',
                                    }}
                                  >
                                    {charName}
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-0" style={{ marginTop: `${dialogueParagraphGap}px` }}>
                                {includeDialogueLine && <div className="w-0.5 shrink-0 rounded-full self-stretch" style={{ backgroundColor: charColor }} aria-hidden />}
                                <div
                                  className={dialogueTypingMaxWidth ? 'min-w-0 shrink leading-snug whitespace-pre-wrap text-[11px] py-0.5 pl-1.5' : 'flex-1 min-w-0 leading-snug whitespace-pre-wrap text-[11px] py-0.5 pl-1.5'}
                                  style={{
                                    ...(dialogueTypingMaxWidth ? { width: dialogueTypingMaxWidth, maxWidth: '100%' } : {}),
                                    color: textColor,
                                    fontWeight: dialogueStyle.fontWeight || 'normal',
                                    fontFamily: dialogueStyle.fontFamily || 'inherit',
                                    fontSize: dialogueStyle.fontSize || '11px',
                                    marginTop: dialogueParagraphGap,
                                  }}
                                >
                                  {unit.content}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="leading-snug whitespace-pre-wrap text-[11px] py-0.5 min-h-[16px]" style={getPropertyStyle(unit.type)}>
                              {unit.content}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
