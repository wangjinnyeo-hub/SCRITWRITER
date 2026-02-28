import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScriptSelection } from './useScriptSelection'
import type { ScriptUnit } from '@/types/sw'

const mockUnits: ScriptUnit[] = [
  { id: 'u1', order: 0, type: 'action', content: '' },
  { id: 'u2', order: 1, type: 'dialogue', content: '', characterId: 'c1' },
  { id: 'u3', order: 2, type: 'action', content: '' },
]

function createMockEvent(overrides: Partial<React.MouseEvent> = {}) {
  return {
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    ...overrides,
  } as unknown as React.MouseEvent
}

const mockSetSelectedPlotBoxIds = vi.fn()
vi.mock('@/store/ui/uiStore', () => ({
  useUIStore: (selector: (s: { setSelectedPlotBoxIds: () => void }) => void) =>
    selector({ setSelectedPlotBoxIds: mockSetSelectedPlotBoxIds }),
}))

type SetIds = (ids: string[] | ((prev: string[]) => string[])) => void
type SetActive = (id: string | null) => void

describe('useScriptSelection', () => {
  let setSelectedScriptUnitIds: SetIds
  let setActiveUnitId: SetActive

  beforeEach(() => {
    setSelectedScriptUnitIds = vi.fn() as unknown as SetIds
    setActiveUnitId = vi.fn() as unknown as SetActive
    mockSetSelectedPlotBoxIds.mockClear()
  })

  it('returns handleUnitSelect and handleDragSelectStart', () => {
    const { result } = renderHook(() =>
      useScriptSelection({
        scriptUnits: mockUnits,
        selectedScriptUnitIds: [],
        setSelectedScriptUnitIds: vi.fn() as unknown as SetIds,
        activeUnitId: null,
        setActiveUnitId: vi.fn() as unknown as SetActive,
        textareaRefs: { current: new Map() },
      })
    )
    expect(typeof result.current.handleUnitSelect).toBe('function')
    expect(typeof result.current.handleDragSelectStart).toBe('function')
  })

  it('single click without modifiers selects clicked unit and sets active', () => {
    const { result } = renderHook(() =>
      useScriptSelection({
        scriptUnits: mockUnits,
        selectedScriptUnitIds: ['u1', 'u2'],
        setSelectedScriptUnitIds: setSelectedScriptUnitIds,
        activeUnitId: 'u1',
        setActiveUnitId: setActiveUnitId,
        textareaRefs: { current: new Map() },
      })
    )

    act(() => {
      result.current.handleUnitSelect(createMockEvent(), 'u3')
    })

    expect(setSelectedScriptUnitIds).toHaveBeenCalledWith(['u3'])
    expect(setActiveUnitId).toHaveBeenCalledWith('u3')
  })

  it('shift+click selects range from last selected to clicked', () => {
    const { result } = renderHook(() =>
      useScriptSelection({
        scriptUnits: mockUnits,
        selectedScriptUnitIds: ['u1'],
        setSelectedScriptUnitIds: setSelectedScriptUnitIds,
        activeUnitId: 'u1',
        setActiveUnitId: setActiveUnitId,
        textareaRefs: { current: new Map() },
      })
    )

    act(() => {
      result.current.handleUnitSelect(createMockEvent({ shiftKey: true }), 'u3')
    })

    expect(setSelectedScriptUnitIds).toHaveBeenCalledWith(
      expect.any(Function)
    )
    const updater = (setSelectedScriptUnitIds as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updater(['u1'])).toEqual(['u1', 'u2', 'u3'])
    expect(setActiveUnitId).toHaveBeenCalledWith('u3')
  })

  it('single click with groupUnitIds selects whole group and sets active to first', () => {
    const { result } = renderHook(() =>
      useScriptSelection({
        scriptUnits: mockUnits,
        selectedScriptUnitIds: [],
        setSelectedScriptUnitIds: setSelectedScriptUnitIds,
        activeUnitId: null,
        setActiveUnitId: setActiveUnitId,
        textareaRefs: { current: new Map() },
      })
    )

    act(() => {
      result.current.handleUnitSelect(createMockEvent(), 'u3', ['u1', 'u2', 'u3'])
    })

    expect(setSelectedScriptUnitIds).toHaveBeenCalledWith(['u1', 'u2', 'u3'])
    expect(setActiveUnitId).toHaveBeenCalledWith('u1')
  })

  it('ctrl+click toggles unit in selection', () => {
    const { result } = renderHook(() =>
      useScriptSelection({
        scriptUnits: mockUnits,
        selectedScriptUnitIds: ['u1', 'u2'],
        setSelectedScriptUnitIds,
        activeUnitId: 'u2',
        setActiveUnitId,
        textareaRefs: { current: new Map() },
      })
    )

    act(() => {
      result.current.handleUnitSelect(createMockEvent({ ctrlKey: true }), 'u2')
    })

    expect(setSelectedScriptUnitIds).toHaveBeenCalledWith(
      expect.any(Function)
    )
    const updater = (setSelectedScriptUnitIds as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updater(['u1', 'u2'])).toEqual(['u1'])
  })
})
