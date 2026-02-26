import { useState, useRef, useEffect } from 'react'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { useEditorStore } from '@/store/editor/editorStore'
import { DragHandleIcon } from '@/components/ui/DragHandleIcon'
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

interface SidebarCharactersProps {
  characters: Character[]
  addCharacter: (char: Omit<Character, 'id'>) => void
  updateCharacter: (id: string, updates: Partial<Character>) => void
  removeCharacter: (id: string) => void
  reorderCharacters: (fromIndex: number, toIndex: number) => void
  onAddButtonClick?: () => void
}

function SortableCharacterRow({
  char,
  index,
  editingCharId,
  setEditingCharId,
  updateCharacter,
}: {
  char: Character
  index: number
  editingCharId: string | null
  setEditingCharId: (id: string | null) => void
  updateCharacter: (id: string, updates: Partial<Character>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: char.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingCharId === char.id && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCharId, char.id])

  return (
    <div ref={setNodeRef} style={style} className="px-3 py-1 flex items-center gap-1.5 min-h-[20px] text-muted-foreground hover:text-foreground transition-colors">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 rounded text-muted-foreground/60 hover:bg-muted shrink-0" onClick={(e) => e.stopPropagation()} aria-label="순서 변경">
        <DragHandleIcon />
      </button>
      <div className="w-2.5 h-2.5 rounded-full shrink-0 border border-border/40" style={{ backgroundColor: char.color }} aria-hidden />
      {editingCharId === char.id ? (
        <input ref={inputRef} type="text" value={char.name} onChange={(e) => updateCharacter(char.id, { name: e.target.value })} onBlur={() => setEditingCharId(null)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingCharId(null); if (e.key === 'Escape') setEditingCharId(null) }} className="flex-1 min-w-0 bg-transparent border-0 rounded-none text-[10px] outline-none py-0.5" />
      ) : (
        <span className="text-[10px] flex-1 truncate leading-[20px] cursor-pointer font-medium" style={{ color: char.color }} onDoubleClick={() => setEditingCharId(char.id)}>{char.name}</span>
      )}
      <span className="w-4 shrink-0 flex items-center justify-end text-[9px] opacity-60 tabular-nums self-center">{char.shortcut >= 0 && char.shortcut <= 9 ? char.shortcut : '\u00A0'}</span>
    </div>
  )
}

export function SidebarCharacters({ characters, addCharacter, updateCharacter, removeCharacter, reorderCharacters, onAddButtonClick }: SidebarCharactersProps) {
  const [newCharName, setNewCharName] = useState<string | null>(null)
  const [newCharColor, setNewCharColor] = useState(DEFAULT_CHARACTER_COLORS[0])
  const [editingCharId, setEditingCharId] = useState<string | null>(null)
  const charInputRef = useRef<HTMLInputElement>(null)
  const listContainerRef = useRef<HTMLDivElement>(null)
  const justSubmittedRef = useRef(false)
  const setCurrentCharacter = useEditorStore(state => state.setCurrentCharacter)

  const handleAddCharacter = () => {
    if (!newCharName?.trim()) return
    if (justSubmittedRef.current) return
    justSubmittedRef.current = true
    setTimeout(() => { justSubmittedRef.current = false }, 0)
    addCharacter({ name: newCharName.trim(), color: newCharColor, shortcut: -1, visible: true })
    setNewCharName(null)
    setNewCharColor(DEFAULT_CHARACTER_COLORS[0])
    setCurrentCharacter(null)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    requestAnimationFrame(() => listContainerRef.current?.focus({ preventScroll: true }))
  }

  useEffect(() => { if (newCharName !== null && charInputRef.current) charInputRef.current.focus() }, [newCharName])
  useEffect(() => { const handler = () => setNewCharName(''); document.addEventListener('sidebar-char-add', handler as any); return () => document.removeEventListener('sidebar-char-add', handler as any) }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = characters.findIndex(c => c.id === active.id)
    const newIndex = characters.findIndex(c => c.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) reorderCharacters(oldIndex, newIndex)
  }

  return (
    <div ref={listContainerRef} className="mt-0.5 outline-none focus:outline-none" tabIndex={-1}>
      {newCharName !== null && (
        <div className="px-3 py-1 flex items-center gap-2 min-w-0">
          <ColorPicker value={newCharColor} onChange={setNewCharColor} size="sm" />
          <input ref={charInputRef} type="text" value={newCharName} onChange={(e) => setNewCharName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCharacter() } else if (e.key === 'Escape') { e.preventDefault(); setNewCharName(null) } }} onBlur={(e) => { const rt = e.relatedTarget as HTMLElement | null; if (rt?.closest?.('[data-color-picker], [data-color-picker-popover]')) return; if (newCharName?.trim()) handleAddCharacter(); else setNewCharName(null) }} placeholder="캐릭터 이름" className="flex-1 min-w-0 bg-transparent border-0 rounded-none text-[10px] outline-none focus:ring-0 py-0.5" autoFocus />
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={characters.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {characters.map((char, index) => (
            <SortableCharacterRow key={char.id} char={char} index={index} editingCharId={editingCharId} setEditingCharId={setEditingCharId} updateCharacter={updateCharacter} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}

export { type SidebarCharactersProps }
