import { useState, useRef, useEffect, memo } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { DragHandleIcon } from '@/components/ui/DragHandleIcon'
import type { ScriptPropertyType } from '@/types'

export interface SortableScriptUnitProps {
  unit: any
  index: number
  /** 드래그 중인 유닛 id들 – 이 유닛이면 원본 숨김(오버레이만 표시) */
  activeDragIds?: string[]
  episodeId: string
  activePlotBoxId: string
  isActive: boolean
  isSelected?: boolean
  onSelect?: (e: React.MouseEvent) => void
  onFocus: () => void
  /** 포커스가 다른 스크립트 textarea로 갈 때는 removeAllRanges 하지 않음(인라인 커서 유지) */
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void
  onUpdateContent: (content: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, unitId: string, unitType: ScriptPropertyType, index: number, charId?: string) => void
  onRemove: () => void
  onChangeCharacter: (unitId: string, charId: string) => void
  autoResize: (textarea: HTMLTextAreaElement) => void
  textareaRef: (el: HTMLTextAreaElement | null) => void
  getCharacterName: (id?: string, dialogueLabel?: string) => string | undefined
  getPropertyStyle: (type: ScriptPropertyType) => any
  propertyLabels: Record<ScriptPropertyType, string>
  characters: any[]
  hideCharacterLabel?: boolean
  /** 대사 스크립트: true면 이 스크립트 위에 캐릭터 이름 표시(같은 캐릭터 이어짐의 첫 스크립트), false면 대사 선만 */
  showCharacterNameInDialogue?: boolean
  /** 연속 동일 캐릭터 대사 그룹 이동용: 이 그룹의 unit id 배열. 첫 번째 스크립트에만 전달하고 캐릭터 이름 라인 옆 그룹 핸들을 표시 */
  groupUnitIds?: string[]
  /** 그룹 전체 선택 시 개별 유닛 드래그 핸들 숨김 */
  hideIndividualHandle?: boolean
  /** 캐릭터 이름 클릭 시 해당 그룹 전체 선택 콜백 */
  onGroupSelect?: (unitIds: string[]) => void
  /** 그룹 핸들 pointerdown: 드래그 전 그룹 미선택 시 선선택 (선택 그룹과 동일 경로) */
  onGroupPointerDown?: (unitIds: string[]) => void
  /** 엑스트라 그룹 이름 변경 (더블클릭 시 인라인 편집 후 호출, 새 이름 전달) */
  onRenameExtraInGroup?: (unitIds: string[], newLabel: string) => void
  dialogueColorMode?: 'character' | 'black' | 'custom'
  dialogueCustomColor?: string
  dialogueParagraphGap?: number
  /** 대사 타이핑 영역 maxWidth (좌측 여백 유지, 우측으로만 제한) */
  dialogueTypingMaxWidth?: string
  onContextMenuRequest?: (e: React.MouseEvent, role: 'script-body' | 'script-handle' | 'script-group-handle', groupUnitIds?: string[]) => void
  /** 유닛 본문에서 포인터다운 시 드래그 선택 시작 (노션 스타일) */
  onDragSelectStart?: (unitId: string) => void
  /** 드래그 선택 중 배경 하이라이트 강화 */
  isDragSelectingHighlight?: boolean
  /** 유닛 본문 pointerdown 캡처: 포커스 유지 필요 시 preventDefault (선택 시 커서 유지) */
  onUnitBodyPointerDownCapture?: (e: React.PointerEvent, unitId: string) => void
  /** 그룹 전체 선택 시 배경 이어짐: 첫 유닛이면 상단만 둥글게 */
  isFirstInSelectedGroup?: boolean
  /** 그룹 전체 선택 시 배경 이어짐: 마지막 유닛이면 하단만 둥글게 */
  isLastInSelectedGroup?: boolean
  /** 그룹 선택(2개 이상)일 때만 캐릭터 이름 행에 선택 배경 적용. 개별 선택 시에는 스크립트 본문만 */
  showSelectionBgOnCharRow?: boolean
  /** 드래그 중 드롭 대상이 이 그룹일 때 캐릭터 이름 행 숨김 (드롭 영역 시각적 혼선 방지) */
  hideCharacterNameDuringDrag?: boolean
  /** 인라인 선택된 텍스트 드래그 시작 (선택 텍스트, 범위) */
  onInlineTextDragStart?: (unitId: string, plotBoxId: string, selectedText: string, rangeStart: number, rangeEnd: number) => void
  /** 인라인 텍스트 드롭: 선택된 텍스트를 대상 유닛으로 이동. clientX/clientY 있으면 해당 좌표 기준 삽입 위치 계산. targetTextarea 있으면 포커스/커서 적용에 사용 */
  onInlineTextDrop?: (targetUnitId: string, targetPlotBoxId: string, insertIndex: number, clientX?: number, clientY?: number, targetTextarea?: HTMLTextAreaElement) => void
  /** 디바운스 중 표시용 로컬 내용 (있으면 unit.content 대신 사용) */
  contentOverride?: string
}

const TEXTAREA_BASE = 'script-unit-textarea w-full bg-transparent resize-none outline-none border-0 rounded-none text-[11px] overflow-hidden min-h-[16px] py-0.5 placeholder:text-muted-foreground/25 focus:placeholder:text-transparent focus:ring-0'
const INLINE_TEXT_DRAG_TYPE = 'application/x-script-writer-inline'

export const SortableScriptUnit = memo(function SortableScriptUnit({
  unit,
  index,
  activeDragIds = [],
  episodeId,
  activePlotBoxId,
  isActive,
  isSelected = false,
  onSelect,
  onFocus,
  onBlur,
  onUpdateContent,
  onKeyDown,
  onRemove,
  onChangeCharacter,
  autoResize,
  textareaRef,
  getCharacterName,
  getPropertyStyle,
  propertyLabels,
  characters,
  hideCharacterLabel = false,
  showCharacterNameInDialogue = true,
  groupUnitIds,
  hideIndividualHandle = false,
  onGroupSelect,
  onGroupPointerDown,
  onRenameExtraInGroup,
  dialogueColorMode = 'black',
  dialogueCustomColor = '#000000',
  dialogueParagraphGap = 2,
  dialogueTypingMaxWidth,
  onContextMenuRequest,
  onDragSelectStart,
  isDragSelectingHighlight = false,
  onUnitBodyPointerDownCapture,
  isFirstInSelectedGroup = false,
  isLastInSelectedGroup = false,
  showSelectionBgOnCharRow = false,
  hideCharacterNameDuringDrag = false,
  onInlineTextDragStart,
  onInlineTextDrop,
  contentOverride,
}: SortableScriptUnitProps) {
  const displayContent = contentOverride !== undefined ? contentOverride : unit.content
  const [showCharDropdown, setShowCharDropdown] = useState(false)
  const [charDropdownRect, setCharDropdownRect] = useState<DOMRect | null>(null)
  const [charClickCount, setCharClickCount] = useState(0)
  const [editingExtraLabel, setEditingExtraLabel] = useState(false)
  const charClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const charNameSpanRef = useRef<HTMLSpanElement | null>(null)
  const extraLabelInputRef = useRef<HTMLInputElement | null>(null)
  const localTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const handleTapRef = useRef<{ downTime: number; downX: number; downY: number; moved: boolean } | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: unit.id })

  useEffect(() => {
    if (localTextareaRef.current) {
      autoResize(localTextareaRef.current)
    }
  }, [unit.content, autoResize])

  useEffect(() => {
    if (editingExtraLabel) {
      extraLabelInputRef.current?.focus()
      extraLabelInputRef.current?.select()
    }
  }, [editingExtraLabel])

  const setTextareaRef = (el: HTMLTextAreaElement | null) => {
    localTextareaRef.current = el
    textareaRef(el)
    if (el) {
      autoResize(el)
    }
  }

  const isPartOfDrag = activeDragIds.includes(unit.id)
  const hideForDrag = isDragging || isPartOfDrag
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    transformOrigin: '0 0',
    willChange: isDragging ? 'transform' : undefined,
  } as React.CSSProperties

  const charName = getCharacterName(unit.characterId, unit.dialogueLabel)
  const characterNameStyle = getPropertyStyle('character')
  const extraChar = characters.find(c => c.name === '엑스트라')
  const isExtra = extraChar && unit.characterId === extraChar.id

  return (
    <div
      data-unit-id={unit.id}
      className="group relative isolate transition-opacity duration-150 ease-out"
      style={
        hideForDrag
          ? { opacity: 0, pointerEvents: 'none' }
          : undefined
      }
    >
      {/* 캐릭터 이름 행: sortable와 함께 드래그 시 전체(캐릭터명+본문) 페이드 아웃. 드래그 중에는 invisible로 공간 유지(드롭 표시 밀림 방지) */}
      {unit.type === 'dialogue' && !hideCharacterLabel && showCharacterNameInDialogue && (charName || (groupUnitIds && groupUnitIds.length >= 1)) && (
        <div
          className={cn(
            'flex items-center gap-0 relative',
            isSelected ? 'rounded-t-sm rounded-b-none' : 'rounded-t-sm',
            hideCharacterNameDuringDrag && 'invisible pointer-events-none'
          )}
          style={undefined}
        >
          {groupUnitIds && groupUnitIds.length >= 1 ? (
            <button
              type="button"
              data-role="group-handle"
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing min-h-[20px] min-w-[20px] p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-60 hover:bg-muted shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onPointerDown={(e) => {
                onGroupPointerDown?.(groupUnitIds ?? [])
                listeners?.onPointerDown?.(e as unknown as React.PointerEvent<HTMLButtonElement>)
              }}
              onClick={(e) => {
                e.stopPropagation(); onGroupSelect?.(groupUnitIds ?? [])
              }}
              onContextMenu={(e) => { e.stopPropagation(); onContextMenuRequest?.(e, 'script-group-handle', groupUnitIds) }}
              aria-label="그룹 이동"
            >
              <DragHandleIcon />
            </button>
          ) : (
            <div className="min-h-[20px] min-w-[20px] shrink-0" aria-hidden />
          )}
          <div className="w-0.5 shrink-0" aria-hidden />
          {isExtra && editingExtraLabel && onRenameExtraInGroup ? (
            <input
              ref={extraLabelInputRef}
              type="text"
              defaultValue={unit.dialogueLabel ?? ''}
              className="min-w-[60px] max-w-[200px] py-0.5 pl-1 text-[12px] font-bold bg-transparent outline-none border-0 rounded-none focus:ring-0"
              style={{ fontFamily: characterNameStyle.fontFamily || 'inherit', fontWeight: characterNameStyle.fontWeight || 'bold' }}
              onBlur={(e) => {
                const v = e.target.value.trim()
                const ids = groupUnitIds ?? [unit.id]
                if (v !== (unit.dialogueLabel ?? '')) onRenameExtraInGroup(ids, v || '엑스트라')
                setEditingExtraLabel(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const v = e.currentTarget.value.trim()
                  const ids = groupUnitIds ?? [unit.id]
                  if (v !== (unit.dialogueLabel ?? '')) onRenameExtraInGroup(ids, v || '엑스트라')
                  setEditingExtraLabel(false)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setEditingExtraLabel(false)
                }
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label="엑스트라 이름 편집"
            />
          ) : (
            <span
              className="cursor-pointer select-none leading-none py-0.5 pl-1"
              style={{
                fontWeight: characterNameStyle.fontWeight || 'bold',
                fontFamily: characterNameStyle.fontFamily || 'inherit',
                fontSize: characterNameStyle.fontSize || '12px',
                color: characters.find(c => c.id === unit.characterId)?.color ?? extraChar?.color ?? '#6b7280',
              }}
              ref={charNameSpanRef}
              onClick={(e) => {
                e.stopPropagation()
                if (isExtra && onRenameExtraInGroup) {
                  onGroupSelect?.(groupUnitIds ?? [unit.id])
                  return
                }
                if (charClickTimer.current) {
                  clearTimeout(charClickTimer.current)
                  const rect = charNameSpanRef.current?.getBoundingClientRect()
                  setCharDropdownRect(rect ?? null)
                  setShowCharDropdown(true)
                  setCharClickCount(0)
                  charClickTimer.current = null
                } else {
                  setCharClickCount(1)
                  charClickTimer.current = setTimeout(() => {
                    setCharClickCount(0)
                    charClickTimer.current = null
                  }, 300)
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (isExtra && onRenameExtraInGroup) {
                  setEditingExtraLabel(true)
                }
              }}
              onContextMenu={(e) => {
                e.stopPropagation()
                if (groupUnitIds?.length) {
                  onContextMenuRequest?.(e, 'script-group-handle', groupUnitIds)
                } else {
                  onContextMenuRequest?.(e, 'script-handle')
                }
              }}
              onKeyDown={(e) => {
                if (charClickCount === 1 && !showCharDropdown && !isExtra) {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault()
                    const currentIndex = characters.findIndex(c => c.id === unit.characterId)
                    let nextIndex = currentIndex
                    if (e.key === 'ArrowUp') nextIndex = currentIndex > 0 ? currentIndex - 1 : characters.length - 1
                    else nextIndex = currentIndex < characters.length - 1 ? currentIndex + 1 : 0
                    onChangeCharacter(unit.id, characters[nextIndex].id)
                  }
                }
              }}
              tabIndex={0}
            >
              {charName}
            </span>
          )}
          {showCharDropdown && charDropdownRect && typeof document !== 'undefined' && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => { setShowCharDropdown(false); setCharDropdownRect(null) }} />
              <div
                className="fixed bg-card border border-border rounded shadow-lg z-[9999] min-w-[100px] py-0.5 max-h-[200px] overflow-auto"
                style={{ left: charDropdownRect.left, top: charDropdownRect.bottom + 4 }}
              >
                {characters.map(char => (
                  <button
                    key={char.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onChangeCharacter(unit.id, char.id)
                      setShowCharDropdown(false)
                      setCharDropdownRect(null)
                    }}
                    className={cn(
                      'w-full text-left px-3 py-0.5 text-[10px] font-semibold hover:bg-muted transition-colors',
                      char.id === unit.characterId && 'bg-muted/50'
                    )}
                    style={{ color: char.color }}
                  >
                    {char.name}
                  </button>
                ))}
              </div>
            </>,
            document.body
          )}
        </div>
      )}

      <div
        ref={setNodeRef}
        data-role="script-unit"
        data-unit-id={unit.id}
        className={cn(
          'group relative flex items-start gap-1 w-full min-w-0 min-h-[32px] py-1 transition-colors duration-150',
          isSelected && 'bg-muted',
          isActive && !isSelected && 'bg-muted/20',
          !isSelected && 'rounded-sm',
          isSelected && isFirstInSelectedGroup && isLastInSelectedGroup && 'rounded-sm',
          isSelected && isFirstInSelectedGroup && !isLastInSelectedGroup && 'rounded-t-none rounded-b-none',
          isSelected && !isFirstInSelectedGroup && isLastInSelectedGroup && 'rounded-t-none rounded-b-sm',
          isSelected && !isFirstInSelectedGroup && !isLastInSelectedGroup && 'rounded-none'
        )}
        style={style}
        onClick={onSelect ? (e) => {
          e.stopPropagation()
          if (e.ctrlKey || e.metaKey || e.shiftKey) return
          onSelect(e)
        } : undefined}
        onPointerDownCapture={onUnitBodyPointerDownCapture ? (e) => {
          if ((e.target as HTMLElement).closest?.('textarea') != null) return
          if ((e.target as HTMLElement).closest?.('button') != null) return
          onUnitBodyPointerDownCapture(e, unit.id)
        } : undefined}
        onPointerDown={onSelect || onDragSelectStart ? (e) => {
          if ((e.target as HTMLElement).closest?.('button') != null) return
          if (e.ctrlKey || e.metaKey || e.shiftKey) { onSelect?.(e as unknown as React.MouseEvent); return }
          const textarea = (e.target as HTMLElement).closest?.('textarea')
          if (textarea instanceof HTMLTextAreaElement) {
            if (textarea.selectionStart !== textarea.selectionEnd) return
            onSelect?.(e as unknown as React.MouseEvent)
            return
          }
          onDragSelectStart?.(unit.id)
        } : undefined}
        onContextMenu={(e) => {
          e.stopPropagation()
          onContextMenuRequest?.(e, 'script-body')
        }}
      >
        {/* 드래그 핸들 - 그룹 전체 선택 시 숨김(자리만 유지). click이 dnd-kit에서 발생하지 않으므로 pointer 탭(짧게 누르기)으로 선택 */}
        {hideIndividualHandle ? (
          <div className="min-h-[20px] min-w-[20px] shrink-0" aria-hidden />
        ) : (
        <div
          className="shrink-0 flex items-start pt-0.5"
          onPointerDownCapture={(e) => {
            handleTapRef.current = { downTime: Date.now(), downX: e.clientX, downY: e.clientY, moved: false }
          }}
          onPointerMoveCapture={() => {
            if (handleTapRef.current) handleTapRef.current.moved = true
          }}
          onPointerUpCapture={(e) => {
            const r = handleTapRef.current
            handleTapRef.current = null
            if (!r || r.moved || (Date.now() - r.downTime) > 400) return
            const dx = e.clientX - r.downX, dy = e.clientY - r.downY
            if (dx * dx + dy * dy > 100) return
            onSelect?.(e as unknown as React.MouseEvent)
          }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenuRequest?.(e, 'script-handle') }}
        >
          <button
            {...attributes}
            {...listeners}
            data-role="handle"
            className="cursor-grab active:cursor-grabbing min-h-[20px] min-w-[20px] p-1 hover:bg-muted rounded text-muted-foreground opacity-0 group-hover:opacity-60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="이동"
          >
            <DragHandleIcon />
          </button>
        </div>
        )}

        <div className="flex-1 min-w-0 min-h-0 self-stretch flex items-start">
        {unit.type === 'background' && (
          <textarea
            ref={setTextareaRef}
            data-unit-id={unit.id}
            value={displayContent}
            onChange={(e) => { onUpdateContent(e.target.value); autoResize(e.target) }}
            onKeyDown={(e) => onKeyDown(e, unit.id, 'background', index)}
            onFocus={onFocus}
            onBlur={onBlur ?? (() => document.getSelection()?.removeAllRanges())}
            onPointerDown={
              onSelect || onDragSelectStart
                ? (e) => {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      e.preventDefault()
                      onSelect?.(e)
                      return
                    }
                    const ta = e.currentTarget as HTMLTextAreaElement
                    if (ta.selectionStart === ta.selectionEnd) onDragSelectStart?.(unit.id)
                  }
                : undefined
            }
            draggable={!!(onInlineTextDragStart && onInlineTextDrop)}
            onDragStart={
              onInlineTextDragStart && onInlineTextDrop
                ? (e) => {
                    const ta = e.currentTarget
                    if (ta.selectionStart === ta.selectionEnd) {
                      e.preventDefault()
                      return
                    }
                    const text = ta.value.slice(ta.selectionStart, ta.selectionEnd)
                    e.dataTransfer.setData('text/plain', text)
                    e.dataTransfer.setData(INLINE_TEXT_DRAG_TYPE, '1')
                    e.dataTransfer.effectAllowed = 'move'
                    onInlineTextDragStart(unit.id, activePlotBoxId, text, ta.selectionStart, ta.selectionEnd)
                  }
                : undefined
            }
            onDragOver={
              onInlineTextDrop
                ? (e) => {
                    if (e.dataTransfer.types.includes(INLINE_TEXT_DRAG_TYPE)) {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }
                  }
                : undefined
            }
            onDrop={
              onInlineTextDrop
                ? (e) => {
                    if (!e.dataTransfer.types.includes(INLINE_TEXT_DRAG_TYPE)) return
                    e.preventDefault()
                    onInlineTextDrop(unit.id, activePlotBoxId, displayContent?.length ?? 0, e.clientX, e.clientY, e.currentTarget)
                  }
                : undefined
            }
            placeholder={propertyLabels.background}
            className={TEXTAREA_BASE}
            style={getPropertyStyle('background')}
            rows={1}
          />
        )}
        
        {unit.type === 'action' && (
          <textarea
            ref={setTextareaRef}
            data-unit-id={unit.id}
            value={displayContent}
            onChange={(e) => { onUpdateContent(e.target.value); autoResize(e.target) }}
            onKeyDown={(e) => onKeyDown(e, unit.id, 'action', index)}
            onFocus={onFocus}
            onBlur={onBlur ?? (() => document.getSelection()?.removeAllRanges())}
            onPointerDown={
              onSelect || onDragSelectStart
                ? (e) => {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      e.preventDefault()
                      onSelect?.(e)
                      return
                    }
                    const ta = e.currentTarget as HTMLTextAreaElement
                    if (ta.selectionStart === ta.selectionEnd) onDragSelectStart?.(unit.id)
                  }
                : undefined
            }
            draggable={!!(onInlineTextDragStart && onInlineTextDrop)}
            onDragStart={
              onInlineTextDragStart && onInlineTextDrop
                ? (e) => {
                    const ta = e.currentTarget
                    if (ta.selectionStart === ta.selectionEnd) {
                      e.preventDefault()
                      return
                    }
                    const text = ta.value.slice(ta.selectionStart, ta.selectionEnd)
                    e.dataTransfer.setData('text/plain', text)
                    e.dataTransfer.setData(INLINE_TEXT_DRAG_TYPE, '1')
                    e.dataTransfer.effectAllowed = 'move'
                    onInlineTextDragStart(unit.id, activePlotBoxId, text, ta.selectionStart, ta.selectionEnd)
                  }
                : undefined
            }
            onDragOver={
              onInlineTextDrop
                ? (e) => {
                    if (e.dataTransfer.types.includes(INLINE_TEXT_DRAG_TYPE)) {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }
                  }
                : undefined
            }
            onDrop={
              onInlineTextDrop
                ? (e) => {
                    if (!e.dataTransfer.types.includes(INLINE_TEXT_DRAG_TYPE)) return
                    e.preventDefault()
                    onInlineTextDrop(unit.id, activePlotBoxId, displayContent?.length ?? 0, e.clientX, e.clientY, e.currentTarget)
                  }
                : undefined
            }
            placeholder={propertyLabels.action}
            className={TEXTAREA_BASE}
            style={getPropertyStyle('action')}
            rows={1}
          />
        )}
        
          {unit.type === 'dialogue' && (
            <div className="flex gap-0 min-w-0 rounded-r overflow-hidden" style={{ marginTop: `${dialogueParagraphGap}px` }}>
              <div
                className="w-0.5 shrink-0 rounded-full self-stretch"
                style={{ backgroundColor: (characters.find(c => c.id === unit.characterId)?.color) ?? '#999' }}
                aria-hidden
              />
              <div
                className={dialogueTypingMaxWidth ? 'min-w-0 shrink' : 'flex-1 min-w-0'}
                style={dialogueTypingMaxWidth ? { width: dialogueTypingMaxWidth, maxWidth: '100%' } : undefined}
              >
              <textarea
                ref={setTextareaRef}
                data-unit-id={unit.id}
                value={displayContent}
                onChange={(e) => { onUpdateContent(e.target.value); autoResize(e.target) }}
                onKeyDown={(e) => onKeyDown(e, unit.id, 'dialogue', index, unit.characterId)}
                onFocus={onFocus}
                onBlur={onBlur ?? (() => document.getSelection()?.removeAllRanges())}
                onPointerDown={
                  onSelect || onDragSelectStart
                    ? (e) => {
                        if (e.shiftKey || e.ctrlKey || e.metaKey) {
                          e.preventDefault()
                          onSelect?.(e)
                          return
                        }
                        const ta = e.currentTarget as HTMLTextAreaElement
                        if (ta.selectionStart === ta.selectionEnd) onDragSelectStart?.(unit.id)
                      }
                    : undefined
                }
                draggable={!!(onInlineTextDragStart && onInlineTextDrop)}
                onDragStart={
                  onInlineTextDragStart && onInlineTextDrop
                    ? (e) => {
                        const ta = e.currentTarget
                        if (ta.selectionStart === ta.selectionEnd) {
                          e.preventDefault()
                          return
                        }
                        const text = ta.value.slice(ta.selectionStart, ta.selectionEnd)
                        e.dataTransfer.setData('text/plain', text)
                        e.dataTransfer.setData(INLINE_TEXT_DRAG_TYPE, '1')
                        e.dataTransfer.effectAllowed = 'move'
                        onInlineTextDragStart(unit.id, activePlotBoxId, text, ta.selectionStart, ta.selectionEnd)
                      }
                    : undefined
                }
                onDragOver={
                  onInlineTextDrop
                    ? (e) => {
                        if (e.dataTransfer.types.includes(INLINE_TEXT_DRAG_TYPE)) {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                        }
                      }
                    : undefined
                }
                onDrop={
                  onInlineTextDrop
                    ? (e) => {
                        if (!e.dataTransfer.types.includes(INLINE_TEXT_DRAG_TYPE)) return
                        e.preventDefault()
                        onInlineTextDrop(unit.id, activePlotBoxId, displayContent?.length ?? 0, e.clientX, e.clientY, e.currentTarget)
                      }
                    : undefined
                }
                placeholder={propertyLabels.dialogue}
                className={cn(
                  TEXTAREA_BASE,
                  'flex-1 min-w-0 pl-1.5 min-h-0',
                  dialogueColorMode === 'black' && 'text-foreground'
                )}
                style={{
                  color: dialogueColorMode === 'custom' ? dialogueCustomColor : undefined,
                }}
                rows={1}
              />
              </div>
            </div>
          )}
        
        {unit.type === 'narration' && (
          <textarea
            ref={setTextareaRef}
            data-unit-id={unit.id}
            value={displayContent}
            onChange={(e) => { onUpdateContent(e.target.value); autoResize(e.target) }}
            onKeyDown={(e) => onKeyDown(e, unit.id, 'narration', index)}
            onFocus={onFocus}
            onBlur={onBlur ?? (() => document.getSelection()?.removeAllRanges())}
            onPointerDown={
              onSelect || onDragSelectStart
                ? (e) => {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      e.preventDefault()
                      onSelect?.(e)
                      return
                    }
                    const ta = e.currentTarget as HTMLTextAreaElement
                    if (ta.selectionStart === ta.selectionEnd) onDragSelectStart?.(unit.id)
                  }
                : undefined
            }
            draggable={!!(onInlineTextDragStart && onInlineTextDrop)}
            onDragStart={
              onInlineTextDragStart && onInlineTextDrop
                ? (e) => {
                    const ta = e.currentTarget
                    if (ta.selectionStart === ta.selectionEnd) {
                      e.preventDefault()
                      return
                    }
                    const text = ta.value.slice(ta.selectionStart, ta.selectionEnd)
                    e.dataTransfer.setData('text/plain', text)
                    e.dataTransfer.setData(INLINE_TEXT_DRAG_TYPE, '1')
                    e.dataTransfer.effectAllowed = 'move'
                    onInlineTextDragStart(unit.id, activePlotBoxId, text, ta.selectionStart, ta.selectionEnd)
                  }
                : undefined
            }
            onDragOver={
              onInlineTextDrop
                ? (e) => {
                    if (e.dataTransfer.types.includes(INLINE_TEXT_DRAG_TYPE)) {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }
                  }
                : undefined
            }
            onDrop={
              onInlineTextDrop
                ? (e) => {
                    if (!e.dataTransfer.types.includes(INLINE_TEXT_DRAG_TYPE)) return
                    e.preventDefault()
                    onInlineTextDrop(unit.id, activePlotBoxId, displayContent?.length ?? 0, e.clientX, e.clientY, e.currentTarget)
                  }
                : undefined
            }
            placeholder={propertyLabels.narration}
            className={TEXTAREA_BASE}
            style={getPropertyStyle('narration')}
            rows={1}
          />
        )}
        
        {unit.type === 'direction' && (
          <textarea
            ref={setTextareaRef}
            data-unit-id={unit.id}
            value={displayContent}
            onChange={(e) => { onUpdateContent(e.target.value); autoResize(e.target) }}
            onKeyDown={(e) => onKeyDown(e, unit.id, 'direction', index)}
            onFocus={onFocus}
            onBlur={onBlur ?? (() => document.getSelection()?.removeAllRanges())}
            onPointerDown={
              onSelect || onDragSelectStart
                ? (e) => {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      e.preventDefault()
                      onSelect?.(e)
                      return
                    }
                    const ta = e.currentTarget as HTMLTextAreaElement
                    if (ta.selectionStart === ta.selectionEnd) onDragSelectStart?.(unit.id)
                  }
                : undefined
            }
            draggable={!!(onInlineTextDragStart && onInlineTextDrop)}
            onDragStart={
              onInlineTextDragStart && onInlineTextDrop
                ? (e) => {
                    const ta = e.currentTarget
                    if (ta.selectionStart === ta.selectionEnd) {
                      e.preventDefault()
                      return
                    }
                    const text = ta.value.slice(ta.selectionStart, ta.selectionEnd)
                    e.dataTransfer.setData('text/plain', text)
                    e.dataTransfer.setData(INLINE_TEXT_DRAG_TYPE, '1')
                    e.dataTransfer.effectAllowed = 'move'
                    onInlineTextDragStart(unit.id, activePlotBoxId, text, ta.selectionStart, ta.selectionEnd)
                  }
                : undefined
            }
            onDragOver={
              onInlineTextDrop
                ? (e) => {
                    if (e.dataTransfer.types.includes(INLINE_TEXT_DRAG_TYPE)) {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }
                  }
                : undefined
            }
            onDrop={
              onInlineTextDrop
                ? (e) => {
                    if (!e.dataTransfer.types.includes(INLINE_TEXT_DRAG_TYPE)) return
                    e.preventDefault()
                    onInlineTextDrop(unit.id, activePlotBoxId, displayContent?.length ?? 0, e.clientX, e.clientY, e.currentTarget)
                  }
                : undefined
            }
            placeholder={propertyLabels.direction}
            className={TEXTAREA_BASE}
            style={getPropertyStyle('direction')}
            rows={1}
          />
        )}
        
        {unit.type === 'character' && (
          <textarea
            ref={setTextareaRef}
            data-unit-id={unit.id}
            value={displayContent}
            onChange={(e) => { onUpdateContent(e.target.value); autoResize(e.target) }}
            onKeyDown={(e) => onKeyDown(e, unit.id, 'character', index)}
            onFocus={onFocus}
            onBlur={onBlur ?? (() => document.getSelection()?.removeAllRanges())}
            placeholder="캐릭터"
            className={cn(TEXTAREA_BASE, 'font-semibold')}
          />
        )}
        </div>
        
        {/* 삭제 버튼 - 최소 터치 영역 PlotEditor와 통일 */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="min-h-[24px] min-w-[24px] p-1.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="삭제"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
})
