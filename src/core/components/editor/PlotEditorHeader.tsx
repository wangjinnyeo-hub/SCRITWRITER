import { useSettingsStore } from '@/store/settings/settingsStore'
import type { Episode } from '@/types/sw'
import { Tooltip } from '@/components/ui/Tooltip'

interface PlotEditorHeaderProps {
  episode: Episode | undefined
  editingEpisodeSubtitle: boolean
  setEditingEpisodeSubtitle: (v: boolean) => void
  episodeId: string
  updateEpisode: (episodeId: string, patch: Partial<Episode>) => void
  selectedPlotBoxIds: string[]
  setSelectedPlotBoxIds: (ids: string[] | ((prev: string[]) => string[])) => void
  isPlotCenteredMode: boolean
  plotContentVisible: boolean
  togglePlotContentVisible: () => void
  /** true면 에피소드 이름(부제) 숨김 — 좌우 1·2단계에서 글자 깨짐 방지 */
  hideEpisodeName?: boolean
}

export function PlotEditorHeader({
  episode,
  editingEpisodeSubtitle,
  setEditingEpisodeSubtitle,
  episodeId,
  updateEpisode,
  selectedPlotBoxIds,
  setSelectedPlotBoxIds,
  isPlotCenteredMode,
  plotContentVisible,
  togglePlotContentVisible,
  hideEpisodeName = false,
}: PlotEditorHeaderProps) {
  const defaultFontFamily = useSettingsStore(state => state.defaultFontFamily)
  const defaultFontStyle = defaultFontFamily ? { fontFamily: defaultFontFamily } : undefined
  return (
    <div className="h-8 min-w-0 px-2 border-b border-border flex items-center justify-between shrink-0" style={defaultFontStyle}>
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <span className="text-xs font-medium shrink-0">{String(episode?.number).padStart(2, '0')}</span>
        {!hideEpisodeName && (editingEpisodeSubtitle ? (
          <input
            type="text"
            value={episode?.subtitle ?? ''}
            onChange={(e) => {
              if (selectedPlotBoxIds.length >= 1) setSelectedPlotBoxIds([])
              updateEpisode(episodeId, { subtitle: e.target.value })
            }}
            onBlur={() => setEditingEpisodeSubtitle(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingEpisodeSubtitle(false) }}
            className="text-[10px] text-foreground outline-none bg-transparent flex-1 min-w-0 border-0 rounded-none"
            placeholder="에피소드 제목"
            autoFocus
          />
        ) : (
          <Tooltip content="제목 편집" side="bottom">
            <span
              className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors break-words min-w-0"
              onClick={() => setEditingEpisodeSubtitle(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingEpisodeSubtitle(true) } }}
              aria-label="제목 편집"
            >
              {episode?.subtitle || '제목 없음'}
            </span>
          </Tooltip>
        ))}
      </div>
      {!isPlotCenteredMode && (
        <button
          onClick={togglePlotContentVisible}
          className="min-h-[24px] px-1.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={plotContentVisible ? '플롯 내용 숨김' : '플롯 내용 표시'}
        >
          {plotContentVisible ? '내용 숨김' : '내용 표시'}
        </button>
      )}
    </div>
  )
}
