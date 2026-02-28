import { useSettingsStore } from '@/store/settings/settingsStore'

interface FullViewHeaderProps {
  episodeNumber: number
  episodeSubtitle?: string
  onOpenExportDialog: () => void
  onClose: () => void
}

export function FullViewHeader({
  episodeNumber,
  episodeSubtitle,
  onOpenExportDialog,
  onClose,
}: FullViewHeaderProps) {
  const defaultFontFamily = useSettingsStore(state => state.defaultFontFamily)
  const defaultFontStyle = defaultFontFamily ? { fontFamily: defaultFontFamily } : undefined
  return (
    <div className="h-7 px-3 border-b border-border flex items-center justify-between shrink-0 bg-[var(--panel-header)]" style={defaultFontStyle}>
      <div className="flex items-center gap-2">
        <h2 className="text-[10px] font-medium">전체보기</h2>
        <span className="text-[10px] text-muted-foreground">
          {String(episodeNumber).padStart(2, '0')}
          {episodeSubtitle && ` - ${episodeSubtitle}`}
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onOpenExportDialog}
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          title="내보내기 형식 열기"
          aria-label="내보내기 형식 열기"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5-5 5 5M12 15V3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          title="닫기"
          aria-label="전체보기 닫기"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
