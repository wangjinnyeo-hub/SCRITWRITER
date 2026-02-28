import { useScriptUnitActions } from './undoable/useScriptUnitActions'
import { usePlotBoxActions } from './undoable/usePlotBoxActions'
import { useEpisodeAndCharacterActions } from './undoable/useEpisodeAndCharacterActions'

/** 기존 API 유지: 스크립트 유닛·플롯박스·에피소드·캐릭터 undoable 액션을 한 객체로 반환 */
export const useUndoableProjectActions = () => {
  const scriptUnit = useScriptUnitActions()
  const plotBox = usePlotBoxActions()
  const episodeAndChar = useEpisodeAndCharacterActions()
  return {
    ...scriptUnit,
    ...plotBox,
    ...episodeAndChar,
  }
}
