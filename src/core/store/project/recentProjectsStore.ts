import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const RECENT_MAX = 20

export interface RecentProjectEntry {
  id: string
  /** 데스크톱: 파일 경로. 웹: 빈 문자열(재선택 필요) */
  path: string
  title: string
  lastOpenedAt: number
  episodeCount: number
  /** 수동 정렬 시 사용. 인덱스와 무관하게 고정 순서 */
  order: number
}

export type RecentSortMode = 'recent' | 'manual'

/** 정렬된 목록 계산 (selector에서 매번 새 배열 반환 시 무한 리렌더 방지용으로 컴포넌트에서 useMemo와 함께 사용) */
export function getOrderedEntriesFrom(
  entries: RecentProjectEntry[],
  sortMode: RecentSortMode
): RecentProjectEntry[] {
  if (!Array.isArray(entries)) return []
  if (sortMode === 'recent') {
    return [...entries].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
  }
  return [...entries].sort((a, b) => a.order - b.order)
}

/** 정렬 후 동일 프로젝트(경로 또는 제목) 중복 제거. 제일 위 = 최근 사용. */
export function getDedupedOrderedEntriesFrom(
  entries: RecentProjectEntry[],
  sortMode: RecentSortMode
): RecentProjectEntry[] {
  const ordered = getOrderedEntriesFrom(entries, sortMode)
  const seen = new Set<string>()
  return ordered.filter((e) => {
    const key = e.path ? e.path : `title:${e.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** 같은 이름 프로젝트 방지: 기존 제목 목록에 없으면 baseName, 있으면 "baseName 2", "baseName 3" … 반환 */
export function getUniqueProjectTitle(baseName: string, existingTitles: string[]): string {
  const normalized = (s: string) => s.trim().toLowerCase()
  const existing = new Set(existingTitles.map(normalized))
  if (!existing.has(normalized(baseName))) return baseName
  for (let n = 2; n <= 9999; n++) {
    const candidate = `${baseName} ${n}`
    if (!existing.has(normalized(candidate))) return candidate
  }
  return `${baseName} ${Date.now()}`
}

interface RecentProjectsState {
  entries: RecentProjectEntry[]
  sortMode: RecentSortMode
  addOrUpdate: (payload: { path?: string; title: string; episodeCount: number }) => void
  remove: (id: string) => void
  reorder: (fromIndex: number, toIndex: number) => void
  setSortMode: (mode: RecentSortMode) => void
  getOrderedEntries: () => RecentProjectEntry[]
}

function generateId(): string {
  return `recent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useRecentProjectsStore = create<RecentProjectsState>()(
  persist(
    (set, get) => ({
      entries: [],
      sortMode: 'recent',

      addOrUpdate: (payload) =>
        set((state) => {
          const path = payload.path ?? ''
          const existing = state.entries.find((e) => e.path && e.path === path)
          const now = Date.now()
          let nextEntries: RecentProjectEntry[]

          if (existing) {
            nextEntries = state.entries.map((e) =>
              e.id === existing.id
                ? {
                    ...e,
                    title: payload.title,
                    lastOpenedAt: now,
                    episodeCount: payload.episodeCount,
                  }
                : e
            )
          } else {
            const newEntry: RecentProjectEntry = {
              id: generateId(),
              path,
              title: payload.title,
              lastOpenedAt: now,
              episodeCount: payload.episodeCount,
              order: state.entries.length > 0 ? Math.max(...state.entries.map((e) => e.order)) + 1 : 0,
            }
            nextEntries = [newEntry, ...state.entries].slice(0, RECENT_MAX)
          }
          return { entries: nextEntries }
        }),

      remove: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),

      reorder: (fromIndex, toIndex) =>
        set((state) => {
          const ordered =
            state.sortMode === 'recent'
              ? [...state.entries].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
              : [...state.entries].sort((a, b) => a.order - b.order)
          const [moved] = ordered.splice(fromIndex, 1)
          if (!moved) return state
          ordered.splice(toIndex, 0, moved)
          const orderMap = new Map(ordered.map((e, i) => [e.id, i]))
          const entries = state.entries.map((e) => ({
            ...e,
            order: orderMap.get(e.id) ?? e.order,
          }))
          return { entries }
        }),

      setSortMode: (sortMode) => set({ sortMode }),

      getOrderedEntries: () => {
        const { entries, sortMode } = get()
        if (sortMode === 'recent') {
          return [...entries].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
        }
        return [...entries].sort((a, b) => a.order - b.order)
      },
    }),
    {
      name: 'script-writer-recent-projects',
      partialize: (s) => ({ entries: s.entries, sortMode: s.sortMode }),
    }
  )
)
