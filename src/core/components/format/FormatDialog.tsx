import { useState, useRef, useLayoutEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ColorPickerPortalContext } from './ColorPickerPortalContext'
import { StylesTab } from './tabs/StylesTab'
import { PalettesTab } from './tabs/PalettesTab'

interface FormatDialogProps {
  open: boolean
  onClose: () => void
}

type FormatTab = 'styles' | 'palettes'

const FORMAT_TABS: { id: FormatTab; label: string }[] = [
  { id: 'styles', label: '유형 스타일' },
  { id: 'palettes', label: '캐릭터 팔레트' },
]

function logFormatDialog(msg: string, data: Record<string, unknown>) {
  fetch('http://127.0.0.1:7242/ingest/88c5408a-5008-4939-ac01-c6dc3fd592a0', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b4e779' },
    body: JSON.stringify({ sessionId: 'b4e779', runId: 'format-dialog', hypothesisId: 'H1-H5', location: 'FormatDialog.tsx', message: msg, data, timestamp: Date.now() }),
  }).catch(() => {})
}

export function FormatDialog({ open, onClose }: FormatDialogProps) {
  const [activeTab, setActiveTab] = useState<FormatTab>('styles')
  const colorPickerPortalRef = useRef<HTMLDivElement | null>(null)

  // #region agent log
  useLayoutEffect(() => {
    if (!open) return
    const el = colorPickerPortalRef.current
    const computed = el ? getComputedStyle(el) : null
    logFormatDialog('FormatDialog opened', {
      portalPointerEvents: computed?.pointerEvents ?? 'no-ref',
      portalZIndex: computed?.zIndex ?? 'no-ref',
      portalChildCount: el?.childElementCount ?? 0,
    })
  }, [open])
  // #endregion

  return (
    <ColorPickerPortalContext.Provider value={colorPickerPortalRef}>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[820px] max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 rounded border border-border bg-background shadow-none"
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement
          if (target?.closest?.('[data-color-picker-popover], [data-color-picker]')) e.preventDefault()
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>서식</DialogTitle>
          <DialogDescription>유형 스타일과 캐릭터 팔레트를 설정합니다. 용어·연출 목록은 설정에서 편집합니다.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-[var(--panel-header)]">
          <span className="text-xs font-medium">서식</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          className="flex flex-1 overflow-hidden"
          onPointerDown={(e) => {
            // #region agent log
            logFormatDialog('content area pointerdown', { tag: (e.target as HTMLElement)?.tagName, id: (e.target as HTMLElement)?.id })
            // #endregion
          }}
        >
          <div className="w-36 border-r border-border bg-[var(--sidebar-bg)] py-2 flex-shrink-0">
            {FORMAT_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 flex overflow-hidden">
            {activeTab === 'styles' && <StylesTab />}
            {activeTab === 'palettes' && (
              <div className="flex-1 overflow-auto p-4">
                <PalettesTab />
              </div>
            )}
          </div>
        </div>
        <div
        ref={colorPickerPortalRef}
        className="absolute inset-0 pointer-events-none z-[100]"
        aria-hidden
        onPointerDown={(e) => {
          // #region agent log
          logFormatDialog('portal div pointerdown (should not fire)', { childCount: colorPickerPortalRef.current?.childElementCount })
          // #endregion
        }}
      />
      </DialogContent>
    </Dialog>
    </ColorPickerPortalContext.Provider>
  )
}
