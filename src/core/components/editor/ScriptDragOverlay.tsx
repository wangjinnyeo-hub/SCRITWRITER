import type { ScriptUnit } from '@/types/sw'
import { MAX_DRAG_OVERLAY_UNITS, PREVIEW_CONTENT_LENGTH } from './constants'
import { DRAG_OVERLAY_FALLBACK_WIDTH, DRAG_OVERLAY_MAX_WIDTH } from './constants'

interface ScriptDragOverlayProps {
  units: ScriptUnit[]
  overlayWidth: number
  getCharacterName: (id?: string, dialogueLabel?: string) => string | undefined
  propertyLabels: Record<string, string>
}

/** 대사 그룹인지 (동일 캐릭터 연속 대사) */
function isDialogueGroup(units: ScriptUnit[]): boolean {
  return units.length >= 1 && units.every(u => u.type === 'dialogue') && units.every(u => u.characterId === units[0]?.characterId)
}

export function ScriptDragOverlay({
  units,
  overlayWidth,
  getCharacterName,
  propertyLabels,
}: ScriptDragOverlayProps) {
  const visibleUnits = units.slice(0, MAX_DRAG_OVERLAY_UNITS)
  const extraCount = units.length - MAX_DRAG_OVERLAY_UNITS
  const w = Math.min(overlayWidth || DRAG_OVERLAY_FALLBACK_WIDTH, DRAG_OVERLAY_MAX_WIDTH)
  const asDialogueGroup = isDialogueGroup(units)
  const charName = asDialogueGroup && units[0] ? getCharacterName(units[0].characterId, units[0].dialogueLabel) : null

  return (
    <div
      className="script-drag-overlay-glass rounded-xl py-2 px-3 cursor-grabbing"
      style={{ width: w, boxSizing: 'border-box' }}
    >
      {asDialogueGroup && charName ? (
        <>
          <div className="text-[11px] font-bold leading-tight truncate mb-1.5">
            {charName}
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3">
            {visibleUnits
              .map(u => (u.content?.trim() ? `${u.content.slice(0, PREVIEW_CONTENT_LENGTH)}${(u.content?.length ?? 0) > PREVIEW_CONTENT_LENGTH ? '…' : ''}` : '(빈 줄)'))
              .join(' … ')}
            {extraCount > 0 ? ` … 외 ${extraCount}개` : ''}
          </p>
        </>
      ) : (
        <div className="space-y-0.5">
          {visibleUnits.map((unit) => {
            const isDialogue = unit.type === 'dialogue'
            const name = isDialogue ? getCharacterName(unit.characterId, unit.dialogueLabel) : null
            const label = propertyLabels[unit.type] ?? unit.type
            const preview = unit.content?.slice(0, PREVIEW_CONTENT_LENGTH) || '(빈 줄)'
            return (
              <div key={unit.id} className="flex items-center gap-1.5 min-w-0 py-0.5">
                {isDialogue && name ? (
                  <span className="text-[9px] font-semibold shrink-0">
                    {name}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[9px] shrink-0">[{label}]</span>
                )}
                <span className="text-[10px] truncate flex-1 min-w-0 text-muted-foreground">
                  {preview}
                  {unit.content && unit.content.length > PREVIEW_CONTENT_LENGTH ? '…' : ''}
                </span>
              </div>
            )
          })}
          {extraCount > 0 && (
            <div className="text-[9px] text-muted-foreground pt-0.5">외 {extraCount}개</div>
          )}
        </div>
      )}
    </div>
  )
}
