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

    // 에피소드 패널: plot-target-* rect 기준. 트리거는 창 내부로만 (우측 여백으로 침범 방지).
    const EPISODE_RIGHT_INSET = 14 // 에피소드 영역 끝에서 14px 왼쪽까지만 에피소드로 인식
    let episodeRightEdge = -Infinity
    for (const c of zoneContainers) {
      const id = String(c.id)
      if (!isEpisodeOnlyPlotTarget(id)) continue
      const rect = droppableRects.get(id)
      if (rect && rect.right > episodeRightEdge) episodeRightEdge = rect.right
    }
    const episodeTriggerRight = episodeRightEdge !== -Infinity ? episodeRightEdge - EPISODE_RIGHT_INSET : Infinity
    const pointerInEpisodeArea = episodeRightEdge !== -Infinity && px <= episodeTriggerRight

    // 시나리오(스크립트) 패널: plot-target-s-* rect 기준. 트리거는 창 내부로만 (좌측 여백으로 침범 방지).
    const SCRIPT_LEFT_INSET = 14 // 스크립트 영역 시작에서 14px 오른쪽부터만 스크립트로 인식
    let scriptLeftEdge = Infinity
    for (const c of zoneContainers) {
      const id = String(c.id)
      if (!id.startsWith(PLOT_TARGET_SCENARIO_PREFIX)) continue
      const rect = droppableRects.get(id)
      if (rect && rect.left < scriptLeftEdge) scriptLeftEdge = rect.left
    }
    const scriptTriggerLeft = scriptLeftEdge !== Infinity ? scriptLeftEdge + SCRIPT_LEFT_INSET : -Infinity
    const hasScriptRects = scriptLeftEdge !== Infinity
    const pointerInScriptArea = hasScriptRects && px >= scriptTriggerLeft

    // 중간 데드존: 두 창 경계 사이 미세 구간에서는 아무것도 트리거하지 않음
    const DEAD_ZONE_GAP = 2
    const inDeadZone = hasScriptRects
      ? px >= episodeTriggerRight - DEAD_ZONE_GAP && px <= scriptTriggerLeft + DEAD_ZONE_GAP
      : px > episodeTriggerRight - DEAD_ZONE_GAP && px < episodeTriggerRight + DEAD_ZONE_GAP
    if (inDeadZone) return []

    // 에피소드 영역에 있을 때만 에피소드 plot-target 허용; 스크립트 영역에 있을 때만 스크립트/insert 존 허용
    let zoneContainersForHit = zoneContainers
    if (pointerInScriptArea) {
      zoneContainersForHit = zoneContainers.filter((c) => !isEpisodeOnlyPlotTarget(String(c.id)))
      if (zoneContainersForHit.length === 0) return []
    } else if (pointerInEpisodeArea) {
      zoneContainersForHit = zoneContainers.filter((c) => isEpisodeOnlyPlotTarget(String(c.id)))
      if (zoneContainersForHit.length === 0) zoneContainersForHit = zoneContainers
    }

    const restrictedArgs = { ...args, droppableContainers: zoneContainersForHit }
    const hits = pointerWithin(restrictedArgs)

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

    // 포인터가 어떤 영역 위에도 없을 때: 포인터에서 가장 가까운 영역 선택 (이미 패널별로 제한된 목록 사용)
    let best: { id: string; distance: number } | null = null
    for (const container of zoneContainersForHit) {
      const id = String(container.id)
      const d = distanceTo(id)
      if (best == null || d < best.distance) best = { id, distance: d }
    }
    if (best) return [{ id: best.id }]
    return []
  }
}
