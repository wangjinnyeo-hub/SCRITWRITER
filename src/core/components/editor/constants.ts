/** 세그먼트 빈 placeholder 더블탭 인식 시간 (ms) */
export const SEGMENT_DOUBLE_TAP_MS = 400

/** 드래그 오버레이 기본 너비 (px) */
export const DRAG_OVERLAY_DEFAULT_WIDTH = 400

/** 드래그 오버레이 최대 너비 (px) */
export const DRAG_OVERLAY_MAX_WIDTH = 360

/** 드래그 오버레이 폴백 너비 (px) */
export const DRAG_OVERLAY_FALLBACK_WIDTH = 320

/** 드래그 오버레이 미리보기 최대 유닛 수 */
export const MAX_DRAG_OVERLAY_UNITS = 4

/** 드래그 오버레이 미리보기 텍스트 최대 길이 */
export const PREVIEW_CONTENT_LENGTH = 50

/** 선택 해제 시 제외할 요소 (클릭 시 선택 유지) */
export const SELECTION_EXEMPT_SELECTORS =
  '[data-unit-id], [data-role="handle"], [data-role="group-handle"]'

/** DnD: 시나리오 → 플롯박스 드롭 타겟 prefix (plot-target-${plotBoxId}) — 에피소드 패널 SortablePlotBox용 */
export const PLOT_TARGET_PREFIX = 'plot-target-'
/** DnD: 시나리오 패널 내 구분선 드롭 영역용 (id 중복 방지, 동일 플롯으로 드롭) */
export const PLOT_TARGET_SCENARIO_PREFIX = 'plot-target-s-'

/** DnD: InsertZone 드롭 타겟 prefix (insert-before-${unitId}) — 유닛 사이 정확한 드롭 위치 감지용 */
export const INSERT_BEFORE_PREFIX = 'insert-before-'

/** DnD: 세그먼트 맨 아래 추가용 prefix (insert-after-${unitId}) — 단일 플롯일 때 마지막 유닛 아래 드롭 지원 */
export const INSERT_AFTER_PREFIX = 'insert-after-'
