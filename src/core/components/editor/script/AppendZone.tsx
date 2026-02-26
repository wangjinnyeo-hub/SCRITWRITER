import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { INSERT_AFTER_PREFIX } from '../constants'

export interface AppendZoneProps {
  plotBoxId: string
  afterUnitId: string
  onInsert: (plotBoxId: string, afterUnitId: string) => string
  isDropTarget?: boolean
}

/** 세그먼트 맨 아래 드롭 영역 (단일 플롯일 때) — 클릭/드롭 시 해당 unitId 뒤에 유닛 삽입 */
export function AppendZone({
  plotBoxId,
  afterUnitId,
  onInsert,
  isDropTarget,
}: AppendZoneProps) {
  const { setNodeRef } = useDroppable({ id: INSERT_AFTER_PREFIX + afterUnitId })
  return (
    <div
      ref={setNodeRef}
      data-insert-after-unit={afterUnitId}
      role="button"
      tabIndex={-1}
      aria-label={`${afterUnitId} 뒤에 삽입`}
      className={cn(
        "flex items-center justify-center group cursor-pointer rounded transition-colors pl-5",
        "h-2 -my-1 min-h-[8px] hover:bg-muted/60"
      )}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onInsert(plotBoxId, afterUnitId)
      }}
    >
      {isDropTarget ? (
        <div className="script-drop-indicator-line" aria-hidden />
      ) : (
        <span className="opacity-0 group-hover:opacity-40 text-[9px] text-muted-foreground">+</span>
      )}
    </div>
  )
}
