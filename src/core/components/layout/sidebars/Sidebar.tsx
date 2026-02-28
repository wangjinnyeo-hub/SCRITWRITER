import { useProjectStore } from '@/store/project/projectStore'
import { useUIStore } from '@/store/ui/uiStore'
import { useUndoableProjectActions } from '@/hooks/useUndoableActions'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'
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
} from '@dnd-kit/sortable'
import { SortableEpisode } from './SidebarEpisodes'
import { SidebarCharacters } from './SidebarCharacters'
import { ContextMenu, useContextMenu } from '@/components/ui/ContextMenu'
import { Tooltip } from '@/components/ui/Tooltip'
import type { ContextMenuItem } from '@/components/ui/ContextMenu'

export function Sidebar() {
  const file = useProjectStore(state => state.file)
  const updateProjectTitle = useProjectStore(state => state.updateProjectTitle)
  const addCharacter = useProjectStore(state => state.addCharacter)
  const updateCharacter = useProjectStore(state => state.updateCharacter)
  const removeCharacter = useProjectStore(state => state.removeCharacter)
  const reorderCharacters = useProjectStore(state => state.reorderCharacters)
  const activeEpisodeId = useUIStore(state => state.activeEpisodeId)
  const setActiveEpisode = useUIStore(state => state.setActiveEpisode)

  const { addEpisodeUndoable, renameExtraInEpisodeUndoable, updateEpisodeUndoable, reorderEpisodesUndoable } = useUndoableProjectActions()
  const { ctx, show: showContextMenu, close: closeContextMenu } = useContextMenu()
  const removeEpisode = useProjectStore(state => state.removeEpisode)

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    episodes: true,
    characters: true,
  })
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editingProjectTitle, setEditingProjectTitle] = useState(false)
  const [projectTitleValue, setProjectTitleValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null!)
  const projectTitleInputRef = useRef<HTMLInputElement>(null)

  const episodes = file?.episodes || []
  const characters = file?.project.characters || []

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleStartEdit = (episodeId: string, currentSubtitle: string) => {
    setEditingEpisodeId(episodeId)
    setEditValue(currentSubtitle || '')
  }

  const handleSaveEdit = () => {
    if (editingEpisodeId) {
      updateEpisodeUndoable(editingEpisodeId, { subtitle: editValue.trim() })
      setEditingEpisodeId(null)
      setEditValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit() }
    else if (e.key === 'Escape') { e.preventDefault(); setEditingEpisodeId(null); setEditValue('') }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = episodes.findIndex(ep => ep.id === active.id)
    const newIndex = episodes.findIndex(ep => ep.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) reorderEpisodesUndoable(oldIndex, newIndex)
  }

  useEffect(() => {
    if (editingEpisodeId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingEpisodeId])
  useEffect(() => {
    if (editingProjectTitle && projectTitleInputRef.current) {
      projectTitleInputRef.current.focus()
      projectTitleInputRef.current.select()
    }
  }, [editingProjectTitle])

  const startEditProjectTitle = () => {
    setProjectTitleValue(file?.project.title || '')
    setEditingProjectTitle(true)
  }
  const saveProjectTitle = () => {
    const v = projectTitleValue.trim()
    if (v && file) updateProjectTitle(v)
    setEditingProjectTitle(false)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--sidebar-bg)]">
      <div className="h-7 px-3 border-b border-border flex items-center min-w-0">
        {editingProjectTitle ? (
          <input
            ref={projectTitleInputRef}
            type="text"
            value={projectTitleValue}
            onChange={(e) => setProjectTitleValue(e.target.value)}
            onBlur={saveProjectTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') saveProjectTitle(); if (e.key === 'Escape') setEditingProjectTitle(false) }}
            className="flex-1 min-w-0 bg-transparent border-0 rounded-none text-[10px] outline-none text-foreground"
            autoFocus
          />
        ) : (
          <button type="button" onClick={startEditProjectTitle} className="text-left flex-1 min-w-0 truncate text-[10px] text-muted-foreground hover:text-foreground">
            {file?.project.title || '프로젝트'}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto scrollbar-hide py-1 text-[10px]">
        <SectionHeader
          label="에피소드"
          count={episodes.length}
          expanded={expandedSections.episodes}
          onToggle={() => toggleSection('episodes')}
          onAdd={() => addEpisodeUndoable()}
        />
        {expandedSections.episodes && (
          <div className="mt-0.5">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={episodes.map(ep => ep.id)} strategy={verticalListSortingStrategy}>
                {episodes.map(episode => (
                  <SortableEpisode
                    key={episode.id}
                    episode={episode}
                    isActive={activeEpisodeId === episode.id}
                    onActivate={() => setActiveEpisode(episode.id)}
                    onDoubleClick={() => handleStartEdit(episode.id, episode.subtitle || '')}
                    onContextMenu={(e) => {
                      const extra = file?.project.characters.find(c => c.name === '엑스트라')
                      const extraLabels = extra ? [...new Set(episode.plotBoxes.flatMap(p => p.scriptUnits.filter(u => u.characterId === extra.id && u.dialogueLabel).map(u => u.dialogueLabel!)))].sort() : []
                      const renameExtraItems = extraLabels.length === 0 ? [{ label: '(엑스트라 없음)' as string, disabled: true }] : extraLabels.map((label) => ({ label, action: () => { const v = window.prompt('새 이름:', label); if (v?.trim() && v.trim() !== label) renameExtraInEpisodeUndoable(episode.id, label, v.trim()) } }))
                      showContextMenu(e, [
                        { label: '이름 변경', shortcut: 'F2', action: () => handleStartEdit(episode.id, episode.subtitle || '') },
                        { label: '엑스트라 이름 변경', children: renameExtraItems },
                        { label: '복제', action: () => {} },
                        { separator: true, label: '' },
                        { label: '삭제', action: () => { if (episodes.length > 1) removeEpisode(episode.id) }, disabled: episodes.length <= 1 },
                      ])
                    }}
                    editingEpisodeId={editingEpisodeId}
                    editValue={editValue}
                    setEditValue={setEditValue}
                    handleKeyDown={handleKeyDown}
                    handleSaveEdit={handleSaveEdit}
                    handleStartEdit={handleStartEdit}
                    inputRef={inputRef}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        <SectionHeader
          label="등장인물"
          count={characters.length}
          expanded={expandedSections.characters}
          onToggle={() => toggleSection('characters')}
          onAdd={() => {
            setExpandedSections(p => ({ ...p, characters: true }))
            setTimeout(() => document.dispatchEvent(new CustomEvent('sidebar-char-add')), 100)
          }}
          onExtra={() => useUIStore.getState().setCharacterManagerOpen(true)}
          extraTitle="캐릭터 관리"
        />
        {expandedSections.characters && (
          <SidebarCharacters
            characters={characters}
            addCharacter={addCharacter}
            updateCharacter={updateCharacter}
            removeCharacter={removeCharacter}
            reorderCharacters={reorderCharacters}
            onAddButtonClick={() => {}}
          />
        )}
      </div>
      {ctx && <ContextMenu items={ctx.items} position={ctx.position} portalTarget={ctx.portalTarget} onClose={closeContextMenu} />}
    </div>
  )
}

function SectionHeader({ label, count, expanded, onToggle, onAdd, onExtra, extraTitle }: {
  label: string; count: number; expanded: boolean; onToggle: () => void; onAdd: () => void; onExtra?: () => void; extraTitle?: string
}) {
  return (
    <Tooltip content={expanded ? `${label} 접기` : `${label} 펼치기`} side="bottom">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        aria-label={expanded ? `${label} 접기` : `${label} 펼치기`}
        aria-expanded={expanded}
        className="w-full px-2 py-1 flex items-center gap-1 min-w-0 text-muted-foreground hover:text-foreground transition-colors group"
      >
        <svg
          width="6" height="6" viewBox="0 0 24 24" fill="currentColor"
          className={cn('transition-transform flex-shrink-0', expanded ? 'rotate-90' : '')}
          aria-hidden
        >
          <path d="M8 5v14l11-7z" />
        </svg>
        <span className="text-[10px] font-medium uppercase tracking-wide shrink-0">{label}</span>
        <span className="flex items-center shrink-0 gap-0.5">
          {onExtra && (
            <Tooltip content={extraTitle || '관리'} side="bottom">
              <button
                onClick={(e) => { e.stopPropagation(); onExtra() }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded transition-opacity shrink-0"
                aria-label={extraTitle || '관리'}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </Tooltip>
          )}
          <Tooltip content={`${label} 추가`} side="bottom">
            <button
              onClick={(e) => { e.stopPropagation(); onAdd() }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded transition-opacity shrink-0"
              aria-label={`${label} 추가`}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </Tooltip>
        </span>
        <span className="ml-auto w-5 h-4 flex items-center justify-end text-[9px] opacity-50 tabular-nums shrink-0" aria-label={`${count}개`}>{count}</span>
      </div>
    </Tooltip>
  )
}
