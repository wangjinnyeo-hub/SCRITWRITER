import { useEffect, useRef, memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { DragHandleIcon } from '@/components/ui/DragHandleIcon'
import { Tooltip } from '@/components/ui/Tooltip'
import { PlotPButton } from '@/components/editor/PlotPButton'
import { PLOT_TARGET_PREFIX } from './constants'

export type PlotContextRole = 'body' | 'handle' | 'p-button'

export interface SortablePlotBoxProps {
  box: any
  index: number
  /** 드래그 중인 플롯 id – 이 박스면 원본 숨김(오버레이만 표시) */
  activeDragId?: string | null
  isActive: boolean
  isSelected: boolean
  /** 확정 선택(시나리오에 고정된 상태) */
  isConfirmed?: boolean
  /** 바로 위 박스도 확정인지(연속 확정 시 선 틈 없음) */
  isPreviousConfirmed?: boolean
  /** 예비 선택(선택됐으나 확정 아님) */
  isPreSelected?: boolean
  plotContentVisible: boolean
  onActivate: (e: React.MouseEvent) => void
  onUpdateContent: (content: string) => void
  onUpdateTitle: (title: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => void
  autoResize: (textarea: HTMLTextAreaElement) => void
  textareaRef: (el: HTMLTextAreaElement | null, index: number) => void
  editingTitleId: string | null
  setEditingTitleId: (id: string | null) => void
  titleInputRef: React.RefObject<HTMLInputElement | null>
  onContextMenuRequest?: (e: React.MouseEvent, role: PlotContextRole, boxId: string) => void
  onBodyClick?: (e: React.MouseEvent, boxId: string) => void
  onPButtonClick?: (boxId: string) => void
  onPButtonDoubleClick?: (boxId: string) => void
  onBoxDoubleClick?: (boxId: string) => void
  onAddPlotBox?: () => void
  /** 제목 입력에서 Enter 시 편집 종료 후 플롯 내용(textarea)으로 포커스 이동 */
  onTitleCommitAndFocusContent?: (index: number) => void
  /** 디바운스 중 표시용 제목 (있으면 box.title 대신 사용) */
  titleOverride?: string
  /** 디바운스 중 표시용 내용 (있으면 box.content 대신 사용) */
  contentOverride?: string
  /** 제목 blur 시 디바운스 즉시 반영 */
  onTitleBlur?: () => void
  /** 내용 textarea blur 시 디바운스 즉시 반영 */
  onContentBlur?: () => void
}

export const SortablePlotBox = memo(function SortablePlotBox({
  box,
  index,
  activeDragId = null,
  isActive,
  isSelected,
  isConfirmed = false,
  isPreviousConfirmed = false,
  isPreSelected = false,
  plotContentVisible,
  onActivate,
  onUpdateContent,
  onUpdateTitle,
  onKeyDown,
  autoResize,
  textareaRef,
  editingTitleId,
  setEditingTitleId,
  titleInputRef,
  onContextMenuRequest,
  onBodyClick,
  onPButtonClick,
  onPButtonDoubleClick,
  onBoxDoubleClick,
  onAddPlotBox,
  onTitleCommitAndFocusContent,
  titleOverride,
  contentOverride,
  onTitleBlur,
  onContentBlur,
}: SortablePlotBoxProps) {
  const displayTitle = titleOverride !== undefined ? titleOverride : (box.title || '')
  const displayContent = contentOverride !== undefined ? contentOverride : (box.content || '')
  const defaultFontFamily = useSettingsStore(state => state.defaultFontFamily)
  const handleTapRef = useRef<{ downTime: number; downX: number; downY: number; moved: boolean } | null>(null)
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: box.id })
  const { setNodeRef: setDroppableRef, isOver: isDropOver } = useDroppable({ id: PLOT_TARGET_PREFIX + box.id })
  const setNodeRef = (el: HTMLDivElement | null) => {
    setSortableRef(el)
    setDroppableRef(el)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && box.id === activeDragId ? 0 : 1,
    ...(defaultFontFamily ? { fontFamily: defaultFontFamily } : {}),
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setEditingTitleId(null)
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowDown') {
      e.preventDefault()
      setEditingTitleId(null)
      if (onTitleCommitAndFocusContent) {
        requestAnimationFrame(() => onTitleCommitAndFocusContent(index))
      }
      return
    }
    if (e.key === 'ArrowRight') {
      const input = e.currentTarget
      if (input.selectionStart === input.value.length) {
        e.preventDefault()
        setEditingTitleId(null)
        if (onTitleCommitAndFocusContent) {
          requestAnimationFrame(() => onTitleCommitAndFocusContent(index))
        }
      }
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-plot-box-id={box.id}
      onClick={(e) => { if (onBodyClick) onBodyClick(e, box.id); else onActivate(e); }}
      onDoubleClick={(e) => { e.stopPropagation(); onBoxDoubleClick?.(box.id); }}
      onContextMenu={(e) => {
        e.stopPropagation()
        onContextMenuRequest?.(e, 'body', box.id)
      }}
      className={cn(
        'group relative p-3 cursor-pointer transition-colors border-b border-border select-none min-w-0',
        isDropOver && 'plot-box-drop-over',
        isDropOver && isConfirmed && 'plot-box-drop-over-confirmed',
        // 확정: 왼쪽 선은 box-shadow로 표시 (드롭 오버 시에는 .plot-box-drop-over-confirmed에서 병합)
        isConfirmed && !isDropOver && 'shadow-[inset_4px_0_0_0_var(--foreground)]',
        isConfirmed && isPreviousConfirmed && 'border-t-0 -mt-px pt-[13px]',
        // 선택(예비): Ctrl/Shift 클릭 시에만 — 링 + 회색 배경
        isPreSelected && 'bg-muted',
        !isConfirmed && !isPreSelected && 'bg-background hover:bg-muted/20',
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          data-plot-handle-area
          className="shrink-0 flex items-center gap-1 rounded pr-0.5 py-0.5"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDownCapture={(e) => {
            handleTapRef.current = { downTime: Date.now(), downX: e.clientX, downY: e.clientY, moved: false }
          }}
          onPointerMoveCapture={() => {
            if (handleTapRef.current) handleTapRef.current.moved = true
          }}
          onPointerUpCapture={(e) => {
            const r = handleTapRef.current
            handleTapRef.current = null
            if (!r || r.moved) return
            onActivate(e as unknown as React.MouseEvent)
          }}
          onContextMenu={(e) => { e.stopPropagation(); onContextMenuRequest?.(e, 'handle', box.id) }}
        >
          <button
            {...attributes}
            {...listeners}
            data-role="handle"
            className="cursor-grab active:cursor-grabbing min-h-[24px] min-w-[24px] p-1.5 hover:bg-muted rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="이동"
          >
            <DragHandleIcon />
          </button>
          <PlotPButton
            boxId={box.id}
            pNumber={index + 1}
            confirmed={isConfirmed}
            isActive={isActive}
            className="text-[9px] font-bold px-1 py-0.5 rounded min-h-[24px] min-w-[24px]"
            onActivate={(e) => onActivate(e as unknown as React.MouseEvent)}
            onPButtonClick={(id) => onPButtonClick?.(id)}
            onPButtonDoubleClick={(id) => onPButtonDoubleClick?.(id)}
            onContextMenu={(e) => {
              e.stopPropagation()
              onContextMenuRequest?.(e as unknown as React.MouseEvent, 'p-button', box.id)
            }}
            aria-label={`P${index + 1}`}
            role="button"
          >
            P{index + 1}
          </PlotPButton>
        </div>
        <div
          className="flex-1 min-w-0 min-h-[24px] flex items-center overflow-hidden"
          data-plot-title-area
          onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) return; e.stopPropagation(); }}
          onMouseDown={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) return; e.stopPropagation(); }}
        >
          {editingTitleId === box.id ? (
            <input
              ref={titleInputRef}
              type="text"
              value={displayTitle}
              onChange={(e) => onUpdateTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={() => { onTitleBlur?.(); setEditingTitleId(null) }}
              placeholder="제목 없음"
              className="w-full bg-transparent px-0 py-0.5 text-[10px] outline-none border-0 rounded-none select-text"
            />
          ) : (
            <>
              {box.title ? (
              <span
                className="text-[10px] font-medium cursor-text break-words block min-w-0"
                data-role="plot-title"
                onPointerDown={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) e.preventDefault(); }}
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingTitleId(box.id)
                }}
              >
                {box.title}
              </span>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) e.preventDefault(); }}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey) return
                  e.stopPropagation()
                  setEditingTitleId(box.id)
                }}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                제목 없음
              </button>
            )}
          </>
          )}
        </div>
        <span className="text-[9px] text-muted-foreground shrink-0 ml-1">
          {box.scriptUnits.length}
        </span>
      </div>
      {plotContentVisible && (
        <textarea
          ref={(el) => textareaRef(el, index)}
          value={displayContent}
          onChange={(e) => {
            onUpdateContent(e.target.value)
            if (e.target) autoResize(e.target)
          }}
          onBlur={onContentBlur}
          onKeyDown={(e) => onKeyDown(e, index)}
          placeholder="장면 설명..."
          className="w-full bg-transparent text-xs resize-none outline-none border-0 rounded-none leading-relaxed max-h-[200px] overflow-y-auto placeholder:text-muted-foreground/25 focus:placeholder:text-transparent select-text min-h-0 py-0"
          onPointerDown={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) e.preventDefault(); }}
          onClick={(e) => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey) e.stopPropagation(); }}
          rows={1}
        />
      )}
      {onAddPlotBox && (
        <Tooltip content="플롯 추가" side="bottom">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddPlotBox(); }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute bottom-1 right-1 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="플롯 추가"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </Tooltip>
      )}
    </div>
  )
})
