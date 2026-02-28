import { v4 as uuidv4 } from 'uuid'

export const generateId = (): string => uuidv4()

// 미사용: 에피소드 번호 자동 부여 기능 도입 시 사용 예정
// export const generateEpisodeNumber = (episodes: { number: number }[]): number => {
//   if (episodes.length === 0) return 1
//   return Math.max(...episodes.map(e => e.number)) + 1
// }

export const generatePlotBoxOrder = (plotBoxes: { order: number }[]): number => {
  if (plotBoxes.length === 0) return 0
  return Math.max(...plotBoxes.map(p => p.order)) + 1
}

export const generateScriptUnitOrder = (scriptUnits: { order: number }[]): number => {
  if (scriptUnits.length === 0) return 0
  return Math.max(...scriptUnits.map(s => s.order)) + 1
}
