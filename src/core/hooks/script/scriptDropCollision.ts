import type { CollisionDetection } from '@dnd-kit/core'
import { pointerWithin } from '@dnd-kit/core'
import { INSERT_BEFORE_PREFIX, INSERT_AFTER_PREFIX, PLOT_TARGET_PREFIX, PLOT_TARGET_SCENARIO_PREFIX } from '@/components/editor/constants'

/**
 * 스크립트 드래그 시: InsertZone/PlotDropZone만 대상으로 하여,
 * 유닛 위에 있을 때도 포인터 Y 기준 가장 가까운 InsertZone을 반환.
 * → 드롭 표시가 스크립트 중간이 아닌 스크립트 사이에만 뜨도록 함.
 */
export function createScriptDropCollision(
  isPlotBoxId: (id: string) => boolean
): CollisionDetection {
  return (args) => {
    const { active, pointerCoordinates, droppableContainers, droppableRects } = args
    const activeId = String(active.id)

    // 플롯 드래그: 기본 pointerWithin 사용
    if (isPlotBoxId(activeId)) {
      return pointerWithin(args)
    }

    // 스크립트 드래그: insert-before-*, insert-after-*, plot-target-*(에피소드), plot-target-s-*(시나리오 구분선)
    const isZoneId = (id: string) =>
      id.startsWith(INSERT_BEFORE_PREFIX) || id.startsWith(INSERT_AFTER_PREFIX) ||
      id.startsWith(PLOT_TARGET_SCENARIO_PREFIX) || id.startsWith(PLOT_TARGET_PREFIX)
    const isEpisodeOnlyPlotTarget = (id: string) =>
      id.startsWith(PLOT_TARGET_PREFIX) && !id.startsWith(PLOT_TARGET_SCENARIO_PREFIX)

    let zoneContainers = droppableContainers.filter((c) => isZoneId(String(c.id)))
    if (zoneContainers.length === 0) return []

    const px = pointerCoordinates?.x ?? 0
    const py = pointerCoordinates?.y ?? 0

    // 에피소드 패널 우측 경계: plot-target-*(에피소드 전용) rect들의 최대 right. 포인터가 그 오른쪽이면 시나리오 영역으로 간주. 음수면 에피소드 인식 영역을 줄여 시나리오 쪽으로 덜 침범.
    const EPISODE_MARGIN = -24
    let episodeRightEdge = -Infinity
    for (const c of zoneContainers) {
      const id = String(c.id)
      if (!isEpisodeOnlyPlotTarget(id)) continue
      const rect = droppableRects.get(id)
      if (rect && rect.right > episodeRightEdge) episodeRightEdge = rect.right
    }
    const pointerRightOfEpisode = episodeRightEdge !== -Infinity && px >= episodeRightEdge + EPISODE_MARGIN

    // 시나리오 영역에 커서가 있을 때만 에피소드 전용 plot-target-* 제외.
    // hit가 없을 때(스크롤바 위 등)는 제외하지 않음 → fallback이 에피소드 plot-target을 골라 깜빡임 방지.
    let zoneContainersForHit = zoneContainers
    if (pointerRightOfEpisode) {
      zoneContainersForHit = zoneContainers.filter((c) => !isEpisodeOnlyPlotTarget(String(c.id)))
      if (zoneContainersForHit.length === 0) return []
    }

    const restrictedArgs = { ...args, droppableContainers: zoneContainersForHit }
    const hits = pointerWithin(restrictedArgs)

    // hit가 있을 때만 "시나리오 영역" 필터 적용. hit 없음(스크롤바 등)이면 전체 zones로 fallback해 에피소드 선택 가능.
    const pointerInScenarioArea = pointerRightOfEpisode && hits.length > 0
    if (pointerInScenarioArea) {
      zoneContainers = zoneContainersForHit
    }

    /** 포인터에서 rect까지의 거리 (가까울수록 시나리오/에피소드 구분선 근처에서 실제 커서 위치 쪽 영역 우선) */
    const distanceTo = (id: string) => {
      const rect = droppableRects.get(id)
      if (!rect) return Infinity
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      return Math.hypot(px - cx, py - cy)
    }

    // 여러 히트 시 포인터에 가장 가까운 드롭 영역 우선
    if (hits.length > 0) {
      const sorted = [...hits].sort((a, b) => {
        const da = distanceTo(String(a.id))
        const db = distanceTo(String(b.id))
        return da - db
      })
      return sorted
    }

    // 포인터가 어떤 영역 위에도 없을 때: 포인터에서 가장 가까운 영역 선택
    let best: { id: string; distance: number } | null = null
    for (const container of zoneContainers) {
      const id = String(container.id)
      const d = distanceTo(id)
      if (best == null || d < best.distance) best = { id, distance: d }
    }
    if (best) return [{ id: best.id }]
    return []
  }
}
