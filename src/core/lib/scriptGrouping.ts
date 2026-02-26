import type { ScriptUnit } from '@/types/sw'

/** 캐릭터 목록에 없거나 참조가 깨진 대사에 표시할 이름 (정체불명 표시 방지) */
export const UNKNOWN_CHARACTER_NAME = '알 수 없는 캐릭터'

export type ScriptUnitGroup =
  | { type: 'dialogue-group'; characterId: string; characterName: string; characterColor: string; units: ScriptUnit[] }
  | { type: 'single'; unit: ScriptUnit }

/**
 * 연속된 동일 캐릭터 대사를 하나의 그룹으로 묶는다.
 * getCharName/getCharColor가 없으면 characterName은 UNKNOWN_CHARACTER_NAME, characterColor는 ''로 채운다.
 */
export function groupScriptUnitsByCharacter(
  units: ScriptUnit[],
  getCharName?: (id?: string, dialogueLabel?: string) => string | undefined,
  getCharColor?: (id?: string) => string
): ScriptUnitGroup[] {
  const groups: ScriptUnitGroup[] = []
  let i = 0
  while (i < units.length) {
    const unit = units[i]
    if (unit.type === 'dialogue' && unit.characterId) {
      const charId = unit.characterId
      const list: ScriptUnit[] = [unit]
      const firstLabel = unit.dialogueLabel
      i++
      while (i < units.length && units[i].type === 'dialogue' && units[i].characterId === charId && units[i].dialogueLabel === firstLabel) {
        list.push(units[i])
        i++
      }
      groups.push({
        type: 'dialogue-group',
        characterId: charId,
        characterName: getCharName?.(charId, firstLabel) ?? firstLabel ?? UNKNOWN_CHARACTER_NAME,
        characterColor: getCharColor?.(charId) ?? '',
        units: list,
      })
    } else {
      groups.push({ type: 'single', unit })
      i++
    }
  }
  return groups
}
