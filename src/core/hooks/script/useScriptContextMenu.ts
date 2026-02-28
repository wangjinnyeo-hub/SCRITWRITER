import { useUIStore } from '@/store/ui/uiStore'
import type { ContextMenuItem } from '@/components/ui/ContextMenu'
import type { ScriptPropertyType, Character } from '@/types'

export interface UseScriptContextMenuParams {
  episodeId: string
  scriptUnits: { id: string; characterId?: string; dialogueLabel?: string }[]
  selectedScriptUnitIds: string[]
  activeUnitId: string | null
  setSelectedScriptUnitIds: (ids: string[] | ((prev: string[]) => string[])) => void
  setActiveUnitId: (id: string | null) => void
  getPlotBoxIdForUnit: (unitId: string) => string | undefined
  updateScriptUnit: (episodeId: string, plotBoxId: string, unitId: string, patch: { type?: ScriptPropertyType; characterId?: string; dialogueLabel?: string }) => void
  setCurrentCharacter: (id: string | null) => void
  removeScriptUnitUndoable: (episodeId: string, plotBoxId: string, unitId: string) => void
  characters: Character[]
  propertyLabels: Record<ScriptPropertyType, string>
  currentCharacterId: string | null
  setPalettePosition: (pos?: { x: number; y: number; above?: boolean }) => void
  openCommandPalette: () => void
  /** 스크립트 포커스 없을 때 빈칸 우클릭 메뉴로 하단에 스크립트 추가 */
  onAddScriptAtBottom?: () => void
}

export function useScriptContextMenu({
  episodeId,
  scriptUnits,
  selectedScriptUnitIds,
  activeUnitId,
  setSelectedScriptUnitIds,
  setActiveUnitId,
  getPlotBoxIdForUnit,
  updateScriptUnit,
  setCurrentCharacter,
  removeScriptUnitUndoable,
  characters,
  propertyLabels,
  currentCharacterId,
  setPalettePosition,
  openCommandPalette,
  onAddScriptAtBottom,
}: UseScriptContextMenuParams) {
  const setFullViewOpen = useUIStore(state => state.setFullViewOpen)
  const setExportDialogOpen = useUIStore(state => state.setExportDialogOpen)
  const setFormatDialogOpen = useUIStore(state => state.setFormatDialogOpen)

  const scriptContextItems: ContextMenuItem[] = [
    { label: '명령어 팔레트', shortcut: '/', action: () => { setPalettePosition(undefined); openCommandPalette() } },
    ...(onAddScriptAtBottom ? [{ label: '스크립트 추가', action: onAddScriptAtBottom }] : []),
    { separator: true },
    { label: '전체 보기', action: () => setFullViewOpen(true) },
    { label: '내보내기', action: () => setExportDialogOpen(true) },
    { label: '서식', action: () => setFormatDialogOpen(true) },
  ]

  const multiSelectScriptItems: ContextMenuItem[] = selectedScriptUnitIds.length >= 2 ? [
    { separator: true },
    { label: '선택 해제', action: () => setSelectedScriptUnitIds(activeUnitId ? [activeUnitId] : []) },
  ] : []

  const buildScriptContextItems = (
    role: 'script-body' | 'script-handle' | 'script-group-handle',
    unitId?: string,
    plotBoxId?: string,
    groupUnitIds?: string[],
  ): ContextMenuItem[] => {
    const targetIds =
      role === 'script-group-handle' && groupUnitIds?.length
        ? groupUnitIds
        : unitId && (selectedScriptUnitIds.includes(unitId) && selectedScriptUnitIds.length >= 2)
          ? selectedScriptUnitIds
          : unitId
            ? [unitId]
            : []
    const extraChar = characters.find(c => c.name === '엑스트라')
    const applyType = (type: ScriptPropertyType) => {
      targetIds.forEach(id => {
        const pId = getPlotBoxIdForUnit(id)
        if (pId) {
          const charId = type === 'dialogue' ? currentCharacterId ?? undefined : undefined
          const patch: { type: ScriptPropertyType; characterId?: string; dialogueLabel?: undefined } = { type, characterId: charId }
          if (type !== 'dialogue' || !extraChar || charId !== extraChar.id) patch.dialogueLabel = undefined
          updateScriptUnit(episodeId, pId, id, patch)
        }
      })
      if (targetIds.length > 0) setCurrentCharacter(type === 'dialogue' ? (currentCharacterId ?? characters.find(c => c.shortcut === 0)?.id ?? null) : null)
    }
    const applyCharacter = (charId: string) => {
      const patch: { type: 'dialogue'; characterId: string; dialogueLabel?: undefined } = { type: 'dialogue', characterId: charId }
      if (!extraChar || charId !== extraChar.id) patch.dialogueLabel = undefined
      targetIds.forEach(id => {
        const pId = getPlotBoxIdForUnit(id)
        if (pId) updateScriptUnit(episodeId, pId, id, patch)
      })
      setCurrentCharacter(charId)
    }
    const typeChangeChildren: ContextMenuItem[] = (
      ['action', 'narration', 'dialogue', 'background', 'direction'] as ScriptPropertyType[]
    ).map(type => ({ label: propertyLabels[type], action: () => applyType(type) }))
    const char0 = characters.find(c => c.shortcut === 0)
    const char1to9 = characters.filter(c => c.shortcut >= 1 && c.shortcut <= 9).sort((a, b) => a.shortcut - b.shortcut)
    const charRest = characters.filter(c => c.shortcut < 0 || c.shortcut > 9)
    const characterChangeChildren: ContextMenuItem[] = [
      ...(char0 ? [{ label: `${char0.name} (0)`, shortcut: '0', action: () => applyCharacter(char0.id) }] : []),
      ...char1to9.map(c => ({ label: c.name, shortcut: String(c.shortcut), action: () => applyCharacter(c.id) })),
      ...(charRest.length ? [{ separator: true }] : []),
      ...charRest.map(c => ({ label: c.name, action: () => applyCharacter(c.id) })),
    ]
    if (role === 'script-body') {
      return scriptContextItems
    }
    if (role === 'script-handle') {
      const deleteItem: ContextMenuItem[] = unitId && plotBoxId
        ? [{
            label: '이 유닛 삭제',
            action: () => {
              removeScriptUnitUndoable(episodeId, plotBoxId, unitId)
              setSelectedScriptUnitIds(prev => prev.filter(id => id !== unitId))
              if (activeUnitId === unitId) {
                const order = scriptUnits.map(u => u.id)
                const i = order.indexOf(unitId)
                const nextId = i > 0 ? order[i - 1] : (order[i + 1] ?? null)
                setActiveUnitId(nextId)
              }
            },
          }]
        : []
      return [
        ...(targetIds.length > 0 ? [
          { separator: true },
          { label: '유형 변경', children: typeChangeChildren },
          { label: '캐릭터 변경', children: characterChangeChildren.length > 0 ? characterChangeChildren : [{ label: '캐릭터 없음', disabled: true }] },
        ] : []),
        ...deleteItem,
        ...multiSelectScriptItems,
      ]
    }
    // script-group-handle: 그룹 단위 유형/캐릭터 변경, 그룹 삭제
    const firstUnit = targetIds[0] ? scriptUnits.find((u: { id: string }) => u.id === targetIds[0]) : null
    const isExtraGroup = extraChar && firstUnit && (firstUnit as { characterId?: string }).characterId === extraChar.id
    const extraRenameItem: ContextMenuItem[] = isExtraGroup && targetIds.length > 0
      ? [{ label: '엑스트라 이름 변경', action: () => {
          const current = (firstUnit as { dialogueLabel?: string })?.dialogueLabel || ''
          const v = window.prompt('엑스트라 이름:', current)
          if (v != null && v.trim() !== current) {
            targetIds.forEach(id => {
              const pId = getPlotBoxIdForUnit(id)
              if (pId) updateScriptUnit(episodeId, pId, id, { dialogueLabel: v.trim() })
            })
          }
        } }]
      : []
    const groupDeleteItem: ContextMenuItem[] =
      targetIds.length > 0 && plotBoxId
        ? [{
            label: '이 그룹 삭제',
            action: () => {
              targetIds.forEach(id => {
                const pId = getPlotBoxIdForUnit(id)
                if (pId) removeScriptUnitUndoable(episodeId, pId, id)
              })
              setSelectedScriptUnitIds(prev => prev.filter(id => !targetIds.includes(id)))
              if (activeUnitId && targetIds.includes(activeUnitId)) {
                const order = scriptUnits.map(u => u.id)
                const firstIdx = order.findIndex(id => targetIds.includes(id))
                const lastIdx = order.length - 1 - [...order].reverse().findIndex(id => targetIds.includes(id))
                const nextId = firstIdx > 0 ? order[firstIdx - 1] : (lastIdx < order.length - 1 ? order[lastIdx + 1] : null)
                setActiveUnitId(nextId)
              }
            },
          }]
        : []
    return [
      ...(targetIds.length > 0 ? [
        { separator: true },
        ...extraRenameItem,
        { label: '유형 변경', children: typeChangeChildren },
        { label: '캐릭터 변경', children: characterChangeChildren.length > 0 ? characterChangeChildren : [{ label: '캐릭터 없음', disabled: true }] },
      ] : []),
      ...groupDeleteItem,
      ...multiSelectScriptItems,
    ]
  }

  return { scriptContextItems, multiSelectScriptItems, buildScriptContextItems }
}
