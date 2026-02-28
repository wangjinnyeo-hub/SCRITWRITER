import { useDraggable } from '@dnd-kit/core'
import { DragHandleIcon } from '@/components/ui/DragHandleIcon'

interface GroupDragHandleProps {
  firstUnitId: string
  unitIds: string[]
  onSelect?: (e: React.MouseEvent) => void
  onContextMenuRequest?: (e: React.MouseEvent, unitIds: string[]) => void
}

export function GroupDragHandle({
  firstUnitId,
  unitIds,
  onSelect,
  onContextMenuRequest,
}: GroupDragHandleProps) {
  const { attributes, listeners } = useDraggable({
    id: `group-${firstUnitId}`,
    data: { type: 'dialogue-group', unitIds },
  })
  return (
    <button
      type="button"
      data-role="group-handle"
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing min-h-[24px] min-w-[24px] p-1 rounded text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      onPointerDown={(e) => {
        onSelect?.(e as unknown as React.MouseEvent)
        listeners?.onPointerDown?.(e as React.PointerEvent<HTMLButtonElement>)
      }}
      onClick={(e) => {
        e.stopPropagation(); onSelect?.(e)
      }}
      onContextMenu={(e) => {
        e.stopPropagation()
        onContextMenuRequest?.(e, unitIds)
      }}
      aria-label="그룹 이동"
    >
      <DragHandleIcon />
    </button>
  )
}
