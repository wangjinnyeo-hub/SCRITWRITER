import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { colorPresets } from '@/lib/colorPresets'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { cn } from '@/lib/utils'
import { useColorPickerPortalContainer } from '@/components/format/ColorPickerPortalContext'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  size?: 'sm' | 'md'
}

export function ColorPicker({ value, onChange, size = 'md' }: ColorPickerProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const portalContainerRef = useColorPickerPortalContainer()
  const recentColors = useSettingsStore(state => state.recentColors)
  const addRecentColor = useSettingsStore(state => state.addRecentColor)
  const recentColorPresetIds = useSettingsStore(state => state.recentColorPresetIds)
  const lastSelectedColorPresetId = useSettingsStore(state => state.lastSelectedColorPresetId)
  const addRecentColorPreset = useSettingsStore(state => state.addRecentColorPreset)
  const setLastSelectedColorPresetId = useSettingsStore(state => state.setLastSelectedColorPresetId)

  const selectedPresetId = lastSelectedColorPresetId && colorPresets.some(p => p.id === lastSelectedColorPresetId)
    ? lastSelectedColorPresetId
    : null
  const selectedPreset = selectedPresetId ? colorPresets.find(p => p.id === selectedPresetId) : null

  const setSelectedPresetId = (id: string | null) => {
    if (id) setLastSelectedColorPresetId(id)
    else setLastSelectedColorPresetId(null)
  }

  const applyColor = (color: string, presetId?: string) => {
    try {
      onChange(color)
      addRecentColor(color)
      if (presetId) addRecentColorPreset(presetId)
    } catch (err) {
      if (import.meta.env.DEV) console.error('[ColorPicker] applyColor failed:', err)
    }
  }
  const applyAndClose = (color: string, presetId?: string) => {
    applyColor(color, presetId)
    setShowPicker(false)
  }
  
  const buttonSize = size === 'sm' ? 'w-4 h-4' : 'w-7 h-7'
  const pickerWidth = size === 'sm' ? 192 : 224
  const pickerHeight = 220
  const pickerWidthClass = size === 'sm' ? 'w-48' : 'w-56'
  const margin = 8

  const updatePosition = useMemo(() => {
    return () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const container = portalContainerRef?.current
      if (container) {
        const cr = container.getBoundingClientRect()
        const triggerBottom = rect.bottom - cr.top
        const triggerLeft = rect.left - cr.left
        const spaceBelow = cr.height - (triggerBottom + margin)
        const spaceAbove = triggerBottom - margin
        let top: number
        if (spaceBelow >= pickerHeight) {
          top = triggerBottom + margin
        } else if (spaceAbove >= pickerHeight) {
          top = triggerBottom - margin - pickerHeight
        } else {
          top = Math.max(margin, Math.min(triggerBottom + margin, cr.height - pickerHeight - margin))
        }
        const left = Math.max(margin, Math.min(triggerLeft, cr.width - pickerWidth - margin))
        setPosition({ top, left })
      } else {
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const left = Math.min(
          Math.max(margin, rect.left),
          viewportWidth - pickerWidth - margin
        )
        const spaceBelow = viewportHeight - (rect.bottom + margin)
        const spaceAbove = rect.top - margin
        let top: number
        if (spaceBelow >= pickerHeight) {
          top = rect.bottom + margin
        } else if (spaceAbove >= pickerHeight) {
          top = rect.top - margin - pickerHeight
        } else {
          top = Math.max(margin, Math.min(rect.bottom + margin, viewportHeight - pickerHeight - margin))
        }
        setPosition({ top, left })
      }
    }
  }, [pickerWidth, pickerHeight, portalContainerRef])

  useLayoutEffect(() => {
    if (!showPicker) return
    updatePosition()
  }, [showPicker, updatePosition])

  useEffect(() => {
    if (!showPicker) return
    const onReposition = () => updatePosition()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPicker(false)
    }
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [showPicker, updatePosition])
  
  const openPicker = () => {
    updatePosition()
    setShowPicker(true)
  }

  return (
    <div
      className="relative inline-block"
      data-color-picker
      onPointerDownCapture={(e) => {
        if (e.button !== 0) return
        const target = e.target as Node
        if (!triggerRef.current?.contains(target)) return
        e.preventDefault()
        e.stopPropagation()
        openPicker()
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation() }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
        className={cn(buttonSize, "min-w-[16px] min-h-[16px] border border-border rounded flex items-center justify-center shrink-0 cursor-pointer")}
        style={{ backgroundColor: value }}
      >
        <span className="sr-only">색상 선택</span>
      </button>
      
      {showPicker && createPortal(
        <>
          <div
            className={cn(portalContainerRef?.current ? "absolute inset-0" : "fixed inset-0", "z-[9998] bg-black/20 pointer-events-auto")}
            style={{ cursor: 'default' }}
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowPicker(false)
            }}
            aria-hidden
          />
          <div
            data-color-picker-popover
            className={cn(pickerWidthClass, portalContainerRef?.current ? "absolute" : "fixed", "p-2 bg-card border border-border rounded shadow-lg z-[9999] space-y-1.5 pointer-events-auto")}
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div>
              <label className="text-[9px] text-muted-foreground block mb-0.5">프리셋</label>
              <select
                value={selectedPresetId || ''}
                onChange={(e) => {
                  const id = (e.target as HTMLSelectElement).value || null
                  setSelectedPresetId(id)
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full h-6 text-[10px] border border-border rounded bg-background px-1"
              >
                <option value="">선택...</option>
                {[
                  ...recentColorPresetIds
                    .map(id => colorPresets.find(p => p.id === id))
                    .filter((p): p is NonNullable<typeof p> => !!p),
                  ...colorPresets.filter(p => !recentColorPresetIds.includes(p.id)),
                ].map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.nameKo}
                  </option>
                ))}
              </select>
            </div>

            {selectedPreset && (
              <div>
                <div className="text-[9px] text-muted-foreground mb-0.5">{selectedPreset.nameKo}</div>
                <div className="grid grid-cols-5 gap-0.5">
                  {selectedPreset.colors.map((color, i) => (
                    <button
                      key={i}
                      type="button"
                      onPointerDown={(e) => { e.stopPropagation(); applyColor(color, selectedPreset.id) }}
                      className="w-full aspect-square rounded border border-border cursor-pointer"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {recentColors.length > 0 && (
              <div>
                <div className="text-[9px] text-muted-foreground mb-0.5">최근 사용</div>
                <div className="flex gap-0.5 flex-wrap">
                  {recentColors.map((color, i) => (
                    <button
                      key={i}
                      type="button"
                      onPointerDown={(e) => { e.stopPropagation(); applyColor(color) }}
                      className="w-5 h-5 rounded border border-border cursor-pointer"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}
            
            <div onPointerDown={(e) => e.stopPropagation()}>
              <label className="text-[9px] text-muted-foreground block mb-0.5">직접 선택</label>
              <input
                type="color"
                value={value}
                onChange={(e) => {
                  const v = (e.target as HTMLInputElement)?.value
                  if (v) applyColor(v)
                }}
                className="w-full h-6 border border-border rounded cursor-pointer"
              />
            </div>
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onPointerDown={(e) => { e.stopPropagation(); setShowPicker(false) }}
                className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                닫기
              </button>
            </div>
          </div>
        </>,
        portalContainerRef?.current ?? document.body
      )}
    </div>
  )
}
