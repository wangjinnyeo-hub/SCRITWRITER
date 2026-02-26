import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { INSERT_BEFORE_PREFIX } from '../constants'

export interface InsertZoneProps {
  plotBoxId: string
  beforeUnitId: string
  onInsert: (plotBoxId: string, beforeUnitId: string) => string
  indentForGroup?: boolean
  isDropTarget?: boolean
}

/** 유닛/그룹 사이 빈 클릭 영역 — 클릭 시 해당 unitId 앞에 유닛 삽입. isDropTarget 시 가로선 표시. droppable로 등록해 정확한 드롭 위치 감지 */
export function InsertZone({
  plotBoxId,
  beforeUnitId,
  onInsert,
  indentForGroup,
  isDropTarget,
}: InsertZoneProps) {
  const { setNodeRef } = useDroppable({ id: INSERT_BEFORE_PREFIX + beforeUnitId })
  return (
    <div
      ref={setNodeRef}
      data-insert-before-unit={beforeUnitId}
      role="button"
      tabIndex={-1}
      aria-label={`${beforeUnitId} 앞에 삽입`}
      className={cn(
        "flex items-center group cursor-pointer rounded transition-colors",
        indentForGroup ? "pl-5 justify-start" : "justify-center",
        "h-2 -my-1 min-h-[8px] hover:bg-muted/60"
      )}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onInsert(plotBoxId, beforeUnitId)
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
