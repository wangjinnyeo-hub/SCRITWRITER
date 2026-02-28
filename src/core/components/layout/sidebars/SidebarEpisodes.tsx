import { cn } from '@/lib/utils'
import { DragHandleIcon } from '@/components/ui/DragHandleIcon'
import { Tooltip } from '@/components/ui/Tooltip'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface SortableEpisodeProps {
  episode: any
  isActive: boolean
  onActivate: () => void
  onDoubleClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  editingEpisodeId: string | null
  editValue: string
  setEditValue: (value: string) => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  handleSaveEdit: () => void
  handleStartEdit: (id: string, subtitle: string) => void
  inputRef: React.RefObject<HTMLInputElement>
}

export function SortableEpisode({
  episode,
  isActive,
  onActivate,
  onDoubleClick,
  onContextMenu,
  editingEpisodeId,
  editValue,
  setEditValue,
  handleKeyDown,
  handleSaveEdit,
  handleStartEdit,
  inputRef,
}: SortableEpisodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: episode.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onActivate}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        'w-full text-left px-3 py-1 flex items-center gap-1 transition-colors cursor-pointer group',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <DragHandleIcon width={8} height={8} />
      </button>
      <span className={cn('flex-shrink-0 w-4 text-[10px] tabular-nums', isActive && 'font-medium')}>
        {String(episode.number).padStart(2, '0')}
      </span>
      {editingEpisodeId === episode.id ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSaveEdit}
          onClick={(e) => e.stopPropagation()}
          placeholder="부제목"
          className="flex-1 min-w-0 bg-transparent border-0 rounded-none px-0.5 py-0.5 text-[10px] outline-none"
        />
      ) : (
        episode.subtitle && (
          <span className="text-[10px] truncate flex-1">{episode.subtitle}</span>
        )
      )}
      {!editingEpisodeId && (
        <Tooltip content="부제목 편집" side="bottom">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleStartEdit(episode.id, episode.subtitle || '')
            }}
            className="ml-auto p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted rounded"
            aria-label="부제목 편집"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </Tooltip>
      )}
    </div>
  )
}
