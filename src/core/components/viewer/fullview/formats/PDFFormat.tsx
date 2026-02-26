import type { FormatProps } from '../types'
import { getSortedUnits } from '@/lib/scriptEngine/filters'
import { resolveDialogueTextColor } from '@/lib/scriptStyles'
import { UNKNOWN_CHARACTER_NAME } from '@/lib/scriptGrouping'

export function PDFFormat({
  plots,
  characters,
  filterUnit,
  getPropertyStyle,
  getCharacterColor,
  hideCharacterName = false,
  dialogueColorMode,
  dialogueCustomColor,
}: FormatProps) {
  const characterStyle = getPropertyStyle('character')
  const dialogueStyle = getPropertyStyle('dialogue')
  const actionStyle = getPropertyStyle('action')
  const narrationStyle = getPropertyStyle('narration')
  const directionStyle = getPropertyStyle('direction')
  const backgroundStyle = getPropertyStyle('background')
  const getCharacterName = (id?: string, dialogueLabel?: string) => {
    const extra = characters.find(c => c.name === '엑스트라')
    if (id && extra && id === extra.id) {
      const label = (dialogueLabel && dialogueLabel.trim()) ? dialogueLabel : extra.name
      return label.toUpperCase()
    }
    const name = characters.find(c => c.id === id)?.name
    if (name) return name.toUpperCase()
    if (dialogueLabel && dialogueLabel.trim()) return dialogueLabel.trim().toUpperCase()
    return (extra?.name ?? UNKNOWN_CHARACTER_NAME).toUpperCase()
  }

  return (
    <div className="space-y-6 font-mono text-[13px] leading-loose">
      {plots.map(box => {
        const scriptUnits = getSortedUnits(box).filter(filterUnit)

        return (
          <div key={box.id} className="space-y-4">
            {scriptUnits.map(unit => {
              const charName = getCharacterName(unit.characterId, unit.dialogueLabel)
              const charColor = getCharacterColor(unit.characterId)
              const dialogueColor = resolveDialogueTextColor({
                dialogueColorMode,
                dialogueCustomColor,
                characterColor: charColor,
              })

              if (unit.type === 'background') {
                return (
                  <div key={unit.id} className="uppercase tracking-wide" style={backgroundStyle}>
                    {unit.content}
                  </div>
                )
              }
              if (unit.type === 'dialogue') {
                return (
                  <div key={unit.id} className="ml-24 max-w-md">
                    {!hideCharacterName && (
                      <div
                        className="text-center mb-1"
                        style={{
                          color: charColor,
                          fontWeight: characterStyle.fontWeight || 'bold',
                          fontFamily: characterStyle.fontFamily || 'inherit',
                          fontSize: characterStyle.fontSize || '12px',
                        }}
                      >
                        {charName}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap" style={{ ...dialogueStyle, color: dialogueColor }}>
                      {unit.content}
                    </div>
                  </div>
                )
              }
              if (unit.type === 'action') {
                return <div key={unit.id} className="whitespace-pre-wrap" style={actionStyle}>{unit.content}</div>
              }
              if (unit.type === 'narration') {
                return <div key={unit.id} className="text-center whitespace-pre-wrap" style={narrationStyle}>{unit.content}</div>
              }
              if (unit.type === 'direction') {
                return <div key={unit.id} className="text-center whitespace-pre-wrap" style={directionStyle}>{unit.content}</div>
              }
              return null
            })}
          </div>
        )
      })}
    </div>
  )
}
