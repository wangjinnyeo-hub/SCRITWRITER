import type { FormatProps } from '../types'
import type { ScriptUnit } from '@/types/sw'
import { getSortedUnits } from '@/lib/scriptEngine/filters'
import { resolveDialogueTextColor } from '@/lib/scriptStyles'
import { groupScriptUnitsByCharacter } from '@/lib/scriptGrouping'

export function ScriptFormat({
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
}: FormatProps) {
  const characterStyle = getPropertyStyle('character')
  const dialogueStyle = getPropertyStyle('dialogue')
  const showName = !hideCharacterName

  const renderDivider = (show: boolean) => {
    if (!show) return null
    if (unitDivider === 'line') return <div className="script-unit-divider-line" />
    if (unitDivider === 'dot') return <div className="my-0.5 flex justify-center"><span className="text-[6px] text-muted-foreground/30">&#x2022;</span></div>
    return null
  }

  return (
    <div className="space-y-6">
      {plots.map(box => {
        const scriptUnits = getSortedUnits(box).filter(filterUnit)
        const groups = groupScriptUnitsByCharacter(scriptUnits, getCharacterName, getCharacterColor)
        const actualIndex = allPlots.findIndex(b => b.id === box.id)
        const plotNumber = actualIndex >= 0 ? actualIndex + 1 : 1

        const defaultFontStyle = defaultFontFamily ? { fontFamily: defaultFontFamily } : undefined
        return (
          <div key={box.id} className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-border/30" style={defaultFontStyle}>
              <span className="text-[11px] font-semibold text-primary">P{plotNumber}</span>
              {box.title && <span className="text-[10px] text-muted-foreground">{box.title}</span>}
            </div>

            <div className="space-y-0">
              {groups.map((group, gIdx) => {
                const needDivider = gIdx > 0
                if (group.type === 'dialogue-group') {
                  const { characterName: charName, characterColor: charColor, units } = group
                  const textColor = resolveDialogueTextColor({
                    dialogueColorMode,
                    dialogueCustomColor,
                    characterColor: charColor,
                  })
                  return (
                    <div key={`dg-${box.id}-${gIdx}`}>
                      {renderDivider(needDivider)}
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
                        <div className="w-0.5 shrink-0 rounded-full self-stretch" style={{ backgroundColor: charColor }} aria-hidden />
                        <div
                          className={dialogueTypingMaxWidth ? 'min-w-0 shrink' : 'flex-1 min-w-0'}
                          style={dialogueTypingMaxWidth ? { width: dialogueTypingMaxWidth, maxWidth: '100%' } : undefined}
                        >
                          {units.map((unit, uIdx) => (
                            <div
                              key={unit.id}
                              className="leading-snug whitespace-pre-wrap text-[11px] py-0.5 pl-1.5"
                              style={{
                                color: textColor,
                                fontWeight: dialogueStyle.fontWeight || 'normal',
                                fontFamily: dialogueStyle.fontFamily || 'inherit',
                                fontSize: dialogueStyle.fontSize || '11px',
                                marginTop: dialogueParagraphGap,
                              }}
                            >
                              {unit.content}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                }
                const { unit } = group
                return (
                  <div key={`single-${unit.id}`}>
                    {renderDivider(needDivider)}
                    <div className="leading-snug whitespace-pre-wrap text-[11px] py-0.5 min-h-[16px]" style={getPropertyStyle(unit.type)}>
                      {unit.content}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
