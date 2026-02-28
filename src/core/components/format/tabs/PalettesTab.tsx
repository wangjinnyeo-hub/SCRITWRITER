import { useState } from 'react'
import { useProjectStore } from '@/store/project/projectStore'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { cn } from '@/lib/utils'
import { generateId } from '@/domain/model'
import type { CharacterPalette, Character } from '@/types'
import { DEFAULT_CHARACTER_COLORS } from '@/lib/colorPresets'

export function PalettesTab() {
  const file = useProjectStore(state => state.file)
  const updateProject = useProjectStore(state => state.updateProject)
  
  const [newPaletteName, setNewPaletteName] = useState('')
  const [editingPaletteId, setEditingPaletteId] = useState<string | null>(null)
  const [editingCharId, setEditingCharId] = useState<string | null>(null)
  const [newCharName, setNewCharName] = useState('')
  const [newCharColor, setNewCharColor] = useState(DEFAULT_CHARACTER_COLORS[0])

  const palettes = file?.project.characterPalettes || []

  const addPalette = () => {
    if (!newPaletteName.trim() || !file) return
    const newPalette: CharacterPalette = {
      id: generateId(),
      name: newPaletteName.trim(),
      characters: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    updateProject({
      characterPalettes: [...palettes, newPalette]
    })
    setNewPaletteName('')
  }

  const removePalette = (paletteId: string) => {
    if (!file) return
    updateProject({
      characterPalettes: palettes.filter(p => p.id !== paletteId)
    })
  }

  const addCharacterToPalette = (paletteId: string) => {
    if (!newCharName.trim() || !file) return
    const newChar: Character = {
      id: generateId(),
      name: newCharName.trim(),
      color: newCharColor,
      shortcut: 0,
      visible: true,
    }
    updateProject({
      characterPalettes: palettes.map(p => 
        p.id === paletteId
          ? { ...p, characters: [...p.characters, newChar], updatedAt: Date.now() }
          : p
      )
    })
    setNewCharName('')
    setNewCharColor(DEFAULT_CHARACTER_COLORS[0])
  }

  const removeCharacterFromPalette = (paletteId: string, charId: string) => {
    if (!file) return
    updateProject({
      characterPalettes: palettes.map(p =>
        p.id === paletteId
          ? { ...p, characters: p.characters.filter(c => c.id !== charId), updatedAt: Date.now() }
          : p
      )
    })
  }

  const updateCharacterInPalette = (paletteId: string, charId: string, updates: Partial<Character>) => {
    if (!file) return
    updateProject({
      characterPalettes: palettes.map(p =>
        p.id === paletteId
          ? { ...p, characters: p.characters.map(c => c.id === charId ? { ...c, ...updates } : c), updatedAt: Date.now() }
          : p
      )
    })
  }

  const applyPaletteToProject = (paletteId: string) => {
    if (!file) return
    const palette = palettes.find(p => p.id === paletteId)
    if (!palette) return
    updateProject({
      characters: palette.characters.map((c, i) => ({ ...c, id: generateId(), shortcut: i + 1 }))
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground mb-3">
        캐릭터 팔레트를 생성하고 관리하여 에피소드 또는 프로젝트 전체에 적용할 수 있습니다.
      </p>

      <div className="pb-2 border-b border-border/50">
        <div className="text-[11px] text-muted-foreground mb-1.5">새 팔레트 추가</div>
        <div className="flex gap-2">
          <Input
            value={newPaletteName}
            onChange={(e) => setNewPaletteName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addPalette() }}
            placeholder="팔레트 이름 (예: 메인 캐스트)"
            className="flex-1 h-7 text-xs border-0 border-b border-border rounded-none bg-transparent px-1"
          />
          <Button onClick={addPalette} size="sm" variant="ghost" className="h-7 text-xs px-2">추가</Button>
        </div>
      </div>

      <div className="space-y-2">
        {palettes.map(palette => (
          <div key={palette.id} className="py-2 border-b border-border/40 last:border-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium">{palette.name}</span>
              <div className="flex gap-1">
                <Button
                  onClick={() => applyPaletteToProject(palette.id)}
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2"
                >
                  프로젝트에 적용
                </Button>
                <button
                  onClick={() => removePalette(palette.id)}
                  className="text-xs text-destructive hover:text-destructive/80"
                  title="삭제"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {editingPaletteId === palette.id && (
              <div className="flex items-center gap-1 mb-1.5">
                <ColorPicker value={newCharColor} onChange={setNewCharColor} size="sm" />
                <Input
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addCharacterToPalette(palette.id) }
                    else if (e.key === 'Escape') { e.preventDefault(); setEditingPaletteId(null); setNewCharName('') }
                  }}
                  placeholder="캐릭터 이름..."
                  className="flex-1 h-6 text-xs border-0 border-b border-border rounded-none bg-transparent px-1"
                  autoFocus
                />
                <Button onClick={() => addCharacterToPalette(palette.id)} size="sm" className="h-6 text-[10px] px-2">
                  추가
                </Button>
              </div>
            )}

            <div className="space-y-1">
              {palette.characters.map(char => (
                <div key={char.id} className="flex items-center gap-1.5 text-xs text-muted-foreground py-0.5">
                  {editingCharId === char.id ? (
                    <>
                      <ColorPicker
                        value={char.color}
                        onChange={(color) => updateCharacterInPalette(palette.id, char.id, { color })}
                        size="sm"
                      />
                      <Input
                        value={char.name}
                        onChange={(e) => updateCharacterInPalette(palette.id, char.id, { name: e.target.value })}
                        onBlur={() => setEditingCharId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setEditingCharId(null) }
                        }}
                        className="flex-1 h-6 text-xs border-0 border-b border-border rounded-none bg-transparent px-1"
                        autoFocus
                      />
                    </>
                  ) : (
                    <>
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0 cursor-pointer"
                        style={{ backgroundColor: char.color }}
                        onClick={() => setEditingCharId(char.id)}
                      />
                      <span className="flex-1 cursor-pointer" onClick={() => setEditingCharId(char.id)}>{char.name}</span>
                    </>
                  )}
                  <button
                    onClick={() => removeCharacterFromPalette(palette.id, char.id)}
                    className="text-[10px] text-destructive hover:text-destructive/80"
                    title="삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
              {palette.characters.length === 0 && (
                <p className="text-[10px] text-muted-foreground/60">캐릭터가 없습니다</p>
              )}
              <button
                onClick={() => setEditingPaletteId(palette.id)}
                className="text-[10px] text-primary hover:text-primary/80 mt-1"
              >
                + 캐릭터 추가
              </button>
            </div>
          </div>
        ))}
      </div>

      {palettes.length === 0 && (
        <div className="py-4 text-center text-muted-foreground border-b border-border/40">
          <p className="text-xs">팔레트가 없습니다. 위에서 새 팔레트를 추가하세요.</p>
        </div>
      )}
    </div>
  )
}
