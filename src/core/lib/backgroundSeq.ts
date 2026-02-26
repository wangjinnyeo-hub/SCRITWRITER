import type { Episode, ScriptUnit } from '@/types'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Build regex from prefix/suffix. Matches prefix + digits + suffix. */
function buildSeqPattern(prefix: string, suffix: string): RegExp {
  const p = escapeRegex(prefix)
  const s = escapeRegex(suffix)
  return new RegExp(p + '(\\d+)' + s)
}

/** Extract sequence number from background unit content. Returns undefined if no match. */
export function parseBackgroundSeqNum(content: string, prefix = 'S#', suffix = ''): number | undefined {
  const pattern = buildSeqPattern(prefix, suffix)
  const m = content.match(pattern)
  return m ? parseInt(m[1], 10) : undefined
}

/** Replace seq in content with prefix+newNum+suffix. If no seq exists, prepend. */
export function setBackgroundSeqNum(content: string, newNum: number, prefix = 'S#', suffix = ''): string {
  const pattern = buildSeqPattern(prefix, suffix)
  const seqStr = prefix + newNum + suffix
  if (pattern.test(content)) {
    return content.replace(pattern, seqStr)
  }
  return content.trim() ? seqStr + ' ' + content : seqStr
}

/** Collect background units in scope (episode = all plotBoxes, plot = single plotBox). */
function getBackgroundUnitsInScope(
  episode: Episode,
  plotBoxId: string | null,
  scope: 'episode' | 'plot'
): ScriptUnit[] {
  const boxes = scope === 'episode'
    ? episode.plotBoxes
    : episode.plotBoxes.filter(p => p.id === plotBoxId)
  const sortedBoxes = [...boxes].sort((a, b) => a.order - b.order)
  const units: ScriptUnit[] = []
  for (const box of sortedBoxes) {
    const bg = box.scriptUnits.filter(u => u.type === 'background')
    units.push(...bg.sort((a, b) => a.order - b.order))
  }
  return units
}

/** Context for insert: current plot units and index to insert at (for "above" calculation). */
export interface InsertContext {
  plotUnits: ScriptUnit[]
  insertIndex: number
  plotBoxId: string
}

/** Get next background sequence number for scope. Uses prefix/suffix for parsing. When insertCtx provided, only considers background units "above" the insert point. */
export function getNextBackgroundNumber(
  episode: Episode,
  plotBoxId: string | null,
  scope: 'episode' | 'plot',
  insertCtx?: InsertContext,
  prefix = 'S#',
  suffix = ''
): number {
  let bgUnits: ScriptUnit[]
  if (insertCtx && scope === 'plot') {
    bgUnits = insertCtx.plotUnits
      .filter((u, i) => i < insertCtx.insertIndex && u.type === 'background')
  } else if (insertCtx && scope === 'episode') {
    const boxes = [...episode.plotBoxes].sort((a, b) => a.order - b.order)
    bgUnits = []
    for (const box of boxes) {
      const units = box.scriptUnits.filter(u => u.type === 'background').sort((a, b) => a.order - b.order)
      if (box.id === insertCtx.plotBoxId) {
        const before = insertCtx.plotUnits
          .filter((u, i) => i < insertCtx.insertIndex && u.type === 'background')
        bgUnits.push(...before)
        break
      }
      bgUnits.push(...units)
    }
  } else {
    bgUnits = getBackgroundUnitsInScope(episode, plotBoxId, scope)
  }
  let maxNum = 0
  for (const u of bgUnits) {
    const n = parseBackgroundSeqNum(u.content, prefix, suffix)
    if (n != null && n > maxNum) maxNum = n
  }
  return maxNum + 1
}

/** Recompute seq for background units across entire episode (when scope is episode). Returns new episode with updated plotBoxes. */
export function recomputeBackgroundNumbersForEpisode(
  episode: Episode,
  prefix = 'S#',
  suffix = '',
  enabled = true
): Episode {
  if (!enabled) return episode
  const sortedBoxes = [...episode.plotBoxes].sort((a, b) => a.order - b.order)
  let seq = 1
  const newPlotBoxes = sortedBoxes.map(box => {
    const reordered = box.scriptUnits.map((u, i) => ({ ...u, order: i }))
    const result = reordered.map(u => {
      if (u.type === 'background') {
        const updated = { ...u, content: setBackgroundSeqNum(u.content, seq, prefix, suffix) }
        seq++
        return updated
      }
      return u
    })
    return { ...box, scriptUnits: result }
  })
  return { ...episode, plotBoxes: newPlotBoxes }
}

/** Recompute seq for background units in a plot box after reorder. Assigns 1, 2, ... in order using prefix/suffix. When enabled=false, returns units unchanged. */
export function recomputeBackgroundNumbersInPlot(scriptUnits: ScriptUnit[], prefix = 'S#', suffix = '', enabled = true): ScriptUnit[] {
  if (!enabled) return scriptUnits
  const bgIndices = scriptUnits
    .map((u, i) => ({ unit: u, index: i }))
    .filter(({ unit }) => unit.type === 'background')
  if (bgIndices.length === 0) return scriptUnits
  const result = [...scriptUnits]
  bgIndices.forEach(({ unit, index }, i) => {
    const newNum = i + 1
    result[index] = { ...unit, content: setBackgroundSeqNum(unit.content, newNum, prefix, suffix) }
  })
  return result
}
