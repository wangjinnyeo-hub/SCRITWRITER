import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { PlotPButton } from '../PlotPButton'
import { DragHandleIcon } from '@/components/ui/DragHandleIcon'
import { Tooltip } from '@/components/ui/Tooltip'
import { PLOT_TARGET_PREFIX } from '../constants'

export interface HorizontalCompactPlotRowProps {
  plot: { id: string; title?: string | null }
  pNumber: number
  isActive: boolean
  confirmed: boolean
  onPClick: (boxId: string) => void
  onPDoubleClick: (boxId: string) => void
  onPActivate?: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
}

/** 좌우 2단계: 핸들 드래그로 순서 변경 가능한 한 행 (핸들 + P아이콘 + 제목), 스크립트 드롭 타깃 포함 */
export function HorizontalCompactPlotRow({
  plot,
  pNumber,
  isActive,
  confirmed,
  onPClick,
  onPDoubleClick,
  onPActivate,
  onContextMenu,
}: HorizontalCompactPlotRowProps) {
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging } = useSortable({ id: plot.id })
  const { setNodeRef: setDroppableRef, isOver: isDropOver } = useDroppable({ id: PLOT_TARGET_PREFIX + plot.id })
  const setNodeRef = (el: HTMLDivElement | null) => {
    setSortableRef(el)
    setDroppableRef(el)
  }
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-start gap-0.5 py-0.5 px-0.5 rounded-md shrink-0 min-h-[28px]',
        isActive && 'bg-muted',
        isDragging && 'opacity-50',
        isDropOver && 'plot-box-drop-over'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 p-0.5 rounded text-muted-foreground opacity-70 cursor-grab active:cursor-grabbing hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label="순서 변경"
      >
        <DragHandleIcon className="w-3 h-3" />
      </button>
      <PlotPButton
        boxId={plot.id}
        pNumber={pNumber}
        confirmed={confirmed}
        isActive={isActive}
        className="min-h-[28px] min-w-[28px] shrink-0 text-[10px]"
        onPButtonClick={onPClick}
        onPButtonDoubleClick={onPDoubleClick}
        onActivate={onPActivate}
        onContextMenu={onContextMenu}
      />
      <Tooltip content={plot.title || '제목 없음'} side="bottom">
        <span className="text-[10px] break-words min-w-0 flex-1 text-left text-muted-foreground pl-0.5 line-clamp-2">
          {plot.title || '제목 없음'}
        </span>
      </Tooltip>
    </div>
  )
}
