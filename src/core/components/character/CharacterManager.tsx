import { useState } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { useUndoableProjectActions } from '@/hooks/useUndoableActions'
import { WorkspaceStyleDialog } from '@/components/ui/WorkspaceStyleDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { DragHandleIcon } from '@/components/ui/DragHandleIcon'
import { cn } from '@/lib/utils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Character } from '@/types'
import { DEFAULT_CHARACTER_COLORS } from '@/lib/colorPresets'

interface CharacterManagerProps {
  open: boolean
  onClose: () => void
}

function SortableCharacterRow({
  char,
  index,
  editingCharId,
  setEditingCharId,
  updateCharacter,
  removeCharacterUndoable,
}: {
  char: Character
  index: number
  editingCharId: string | null
  setEditingCharId: (id: string | null) => void
  updateCharacter: (id: string, updates: Partial<Character>) => void
  removeCharacterUndoable: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: char.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 border border-border rounded hover:bg-muted/30"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 rounded text-muted-foreground hover:bg-muted shrink-0"
        onClick={(e) => e.stopPropagation()}
        aria-label="순서 변경"
      >
        <DragHandleIcon />
      </button>
      {editingCharId === char.id ? (
        <>
          <Input
            value={char.name}
            onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
            onBlur={() => setEditingCharId(null)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingCharId(null)}
            className="h-7 text-xs flex-1"
            autoFocus
          />
          <ColorPicker
            value={char.color}
            onChange={(color) => updateCharacter(char.id, { color })}
            size="sm"
          />
        </>
      ) : (
        <>
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: char.color }}
          />
          <span
            className="flex-1 text-xs cursor-pointer"
            onClick={() => setEditingCharId(char.id)}
          >
            {char.name}
          </span>
          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            {char.shortcut >= 0 && char.shortcut <= 9 ? `Ctrl+${char.shortcut}` : '—'}
          </span>
          <button
            onClick={() => updateCharacter(char.id, { visible: !char.visible })}
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded transition-colors',
              char.visible ? 'bg-muted text-foreground' : 'bg-muted/50 text-muted-foreground'
            )}
          >
            {char.visible ? '표시' : '숨김'}
          </button>
          {index > 0 && (
            <button
              onClick={() => removeCharacterUndoable(char.id)}
              className="text-xs text-destructive hover:text-destructive/80"
              title="삭제"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  )
}

export function CharacterManager({ open, onClose }: CharacterManagerProps) {
  const file = useProjectStore(state => state.file)
  const updateCharacter = useProjectStore(state => state.updateCharacter)
  const reorderCharacters = useProjectStore(state => state.reorderCharacters)
  
  const {
    addCharacterUndoable,
    removeCharacterUndoable,
  } = useUndoableProjectActions()
  
  const [editingCharId, setEditingCharId] = useState<string | null>(null)
  const [newCharName, setNewCharName] = useState('')
  const [newCharColor, setNewCharColor] = useState(DEFAULT_CHARACTER_COLORS[0])
  
  const characters = file?.project.characters || []
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = characters.findIndex(c => c.id === active.id)
    const newIndex = characters.findIndex(c => c.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) reorderCharacters(oldIndex, newIndex)
  }
  
  const handleAddCharacter = () => {
    if (!newCharName.trim()) return
    addCharacterUndoable({
      name: newCharName.trim(),
      color: newCharColor,
      visible: true,
      shortcut: -1,
    })
    setNewCharName('')
    setNewCharColor(DEFAULT_CHARACTER_COLORS[0])
  }
  
  return (
    <WorkspaceStyleDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="캐릭터 관리"
      size="medium"
      description="캐릭터 목록을 편집하고 순서를 변경합니다."
    >
      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
        {/* 새 캐릭터 추가 */}
        <div className="border border-border rounded p-3 space-y-2">
          <div className="text-xs font-medium">새 캐릭터 추가</div>
          <div className="flex gap-2">
            <Input
              value={newCharName}
              onChange={(e) => setNewCharName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setNewCharName('')
                  return
                }
                if (e.key === 'Enter' && newCharName.trim()) {
                  handleAddCharacter()
                }
              }}
              placeholder="이름"
              className="flex-1 h-8 text-xs"
            />
            <ColorPicker
              value={newCharColor}
              onChange={setNewCharColor}
            />
            <Button
              onClick={handleAddCharacter}
              disabled={!newCharName.trim()}
              size="sm"
              className="h-8 text-xs"
            >
              추가
            </Button>
          </div>
        </div>

        {/* 캐릭터 목록 (드래그로 순서 변경) */}
        <div className="space-y-1 max-h-60 overflow-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={characters.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {characters.map((char, index) => (
                <SortableCharacterRow
                  key={char.id}
                  char={char}
                  index={index}
                  editingCharId={editingCharId}
                  setEditingCharId={setEditingCharId}
                  updateCharacter={updateCharacter}
                  removeCharacterUndoable={removeCharacterUndoable}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      <div className="flex justify-end border-t border-border p-4 shrink-0">
        <Button onClick={onClose} size="sm" className="text-xs">
          닫기
        </Button>
      </div>
    </WorkspaceStyleDialog>
  )
}
