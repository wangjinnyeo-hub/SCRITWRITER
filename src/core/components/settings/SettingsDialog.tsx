import { createContext, useContext, useState, useEffect } from 'react'
import { useSettingsStore } from '@/store/settings/settingsStore'
import { useDefaultSettingsStore } from '@/store/settings/defaultSettingsStore'
import { useProjectStore } from '@/store/project/projectStore'
import { commandRegistry } from '@/lib/commandRegistry'
import { WorkspaceStyleDialog } from '@/components/ui/WorkspaceStyleDialog'
import { Input } from '@/components/ui/input'
import type { ScriptPropertyType } from '@/types'

export type SettingsEditSource = 'project' | 'default'

const SettingsEditSourceContext = createContext<SettingsEditSource>('project')

/** 설정/기본설정 창에서 공통으로 사용. 소스에 따라 project 스토어 또는 default 스토어 반환 */
function useSettingsForEditor() {
  const source = useContext(SettingsEditSourceContext)
  const projectStore = useSettingsStore()
  const defaultStore = useDefaultSettingsStore()
  return source === 'default' ? defaultStore : projectStore
}

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  /** 열릴 때 먼저 보여줄 섹션 (메뉴에서 '단축키 설정' 등으로 열 때 사용) */
  initialSection?: SettingsSection | null
}

type SettingsSection = 'general' | 'terminology' | 'shortcuts' | 'directions'

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: '일반' },
  { id: 'terminology', label: '용어' },
  { id: 'shortcuts', label: '단축키' },
  { id: 'directions', label: '연출 설정' },
]

function SettingsDialogInner({
  resetToDefaults,
  initialSection,
  children,
}: {
  resetToDefaults: () => void
  initialSection?: SettingsSection | null
  children: (activeSection: SettingsSection) => React.ReactNode
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection ?? 'general')
  useEffect(() => {
    if (initialSection) setActiveSection(initialSection)
  }, [initialSection])
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-32 border-r border-border bg-[var(--sidebar-bg)] py-2 flex-shrink-0">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
              activeSection === s.id
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            {s.label}
          </button>
        ))}
        <div className="border-t border-border mt-2 pt-2">
          <button
            onClick={resetToDefaults}
            className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            기본값 복원
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">{children(activeSection)}</div>
    </div>
  )
}

export function SettingsDialog({ open, onClose, initialSection }: SettingsDialogProps) {
  const resetToDefaults = useSettingsStore(state => state.resetToDefaults)
  return (
    <WorkspaceStyleDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="설정"
      size="medium"
      description="일반, 단축키, 연출 관련 환경설정을 변경합니다."
      className="min-h-[400px]"
    >
      <SettingsEditSourceContext.Provider value="project">
        <SettingsDialogInner resetToDefaults={resetToDefaults} initialSection={open ? initialSection ?? undefined : undefined}>
          {(section) => (
            <>
              {section === 'general' && <GeneralSection />}
              {section === 'terminology' && <TerminologySection />}
              {section === 'shortcuts' && <ShortcutsSection />}
              {section === 'directions' && <DirectionsSection />}
            </>
          )}
        </SettingsDialogInner>
      </SettingsEditSourceContext.Provider>
    </WorkspaceStyleDialog>
  )
}

export function DefaultSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const resetToDefaults = useDefaultSettingsStore(state => state.resetToDefaults)
  return (
    <WorkspaceStyleDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="기본설정"
      size="medium"
      description="새 프로젝트 생성 시 적용할 기본 설정을 조율합니다."
      className="min-h-[400px]"
    >
      <SettingsEditSourceContext.Provider value="default">
        <SettingsDialogInner resetToDefaults={resetToDefaults}>
          {(section) => (
            <>
              {section === 'general' && <GeneralSection />}
              {section === 'terminology' && <TerminologySection />}
              {section === 'shortcuts' && <ShortcutsSection />}
              {section === 'directions' && <DirectionsSection />}
            </>
          )}
        </SettingsDialogInner>
      </SettingsEditSourceContext.Provider>
    </WorkspaceStyleDialog>
  )
}

function TerminologySection() {
  const store = useSettingsForEditor()
  const propertyLabels = store.propertyLabels
  const setPropertyLabel = store.setPropertyLabel
  const ALL_TYPES: ScriptPropertyType[] = ['character', 'dialogue', 'action', 'narration', 'background', 'direction']
  return (
    <div className="space-y-4">
      <SettingGroup label="유형 명칭">
        <div className="space-y-0">
          {ALL_TYPES.map(type => (
            <div key={type} className="flex items-center gap-2 py-1 border-b border-border/40 last:border-0">
              <span className="w-16 text-[10px] text-muted-foreground">{type}</span>
              <Input
                value={propertyLabels[type]}
                onChange={(e) => setPropertyLabel(type, e.target.value)}
                className="w-40 h-6 text-xs px-1 border-0 border-b border-border rounded-none bg-transparent"
              />
            </div>
          ))}
        </div>
      </SettingGroup>
    </div>
  )
}

function GeneralSection() {
  const store = useSettingsForEditor()
  const propertyLabels = store.propertyLabels
  const startTypingType = store.startTypingType
  const setStartTypingType = store.setStartTypingType
  const backgroundSeqEnabled = store.backgroundSeqEnabled
  const setBackgroundSeqEnabled = store.setBackgroundSeqEnabled
  const backgroundSeqPrefix = store.backgroundSeqPrefix
  const setBackgroundSeqPrefix = store.setBackgroundSeqPrefix
  const backgroundSeqSuffix = store.backgroundSeqSuffix
  const setBackgroundSeqSuffix = store.setBackgroundSeqSuffix
  const backgroundSeqScope = store.backgroundSeqScope
  const setBackgroundSeqScope = store.setBackgroundSeqScope

  const scriptTypes = [
    { value: 'character', label: propertyLabels.character },
    { value: 'dialogue', label: propertyLabels.dialogue },
    { value: 'narration', label: propertyLabels.narration },
    { value: 'action', label: propertyLabels.action },
    { value: 'background', label: propertyLabels.background },
    { value: 'direction', label: propertyLabels.direction },
  ] as const

  return (
    <div className="space-y-4">
      <SettingGroup label="시나리오">
        <SettingRow label="시작 타이핑 유형">
          <select
            value={startTypingType}
            onChange={(e) => setStartTypingType(e.target.value as typeof startTypingType)}
            className="h-6 text-xs border border-border rounded px-1.5 bg-background min-w-[120px]"
          >
            {scriptTypes.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </SettingRow>
      </SettingGroup>
      <SettingGroup label="자동 순차 설정">
        <SettingRow label="자동 배경 숫자 할당">
          <input
            type="checkbox"
            checked={backgroundSeqEnabled}
            onChange={(e) => setBackgroundSeqEnabled(e.target.checked)}
            className="w-3.5 h-3.5"
          />
        </SettingRow>
        {backgroundSeqEnabled && (
          <>
            <SettingRow label="숫자 앞 단어">
              <Input
                value={backgroundSeqPrefix}
                onChange={(e) => setBackgroundSeqPrefix(e.target.value)}
                placeholder="예: S#"
                className="h-6 text-xs px-1.5 min-w-[80px] max-w-[120px]"
              />
            </SettingRow>
            <SettingRow label="숫자 뒤 단어">
              <Input
                value={backgroundSeqSuffix}
                onChange={(e) => setBackgroundSeqSuffix(e.target.value)}
                placeholder="예: (비워두기)"
                className="h-6 text-xs px-1.5 min-w-[80px] max-w-[120px]"
              />
            </SettingRow>
            <SettingRow label="범위">
              <select
                value={backgroundSeqScope}
                onChange={(e) => setBackgroundSeqScope(e.target.value as 'episode' | 'plot')}
                className="h-6 text-xs border border-border rounded px-1.5 bg-background min-w-[120px]"
              >
                <option value="episode">에피소드 전체</option>
                <option value="plot">플롯(시나리오)별</option>
              </select>
            </SettingRow>
          </>
        )}
      </SettingGroup>
    </div>
  )
}

function ShortcutsSection() {
  const store = useSettingsForEditor()
  const propertyLabels = store.propertyLabels
  const slashShortcutsEnabled = store.slashShortcutsEnabled
  const setSlashShortcutsEnabled = store.setSlashShortcutsEnabled
  const slashNumberAssignments = store.slashNumberAssignments
  const setSlashNumberAssignment = store.setSlashNumberAssignment
  const directionItems = store.directionItems
  const directionModeEnabled = store.directionModeEnabled
  const hashShortcuts = store.hashShortcuts
  const setHashShortcut = store.setHashShortcut
  const characters = useProjectStore(state => state.file?.project.characters ?? [])

  const TYPE_OPTIONS_NO_SAME = [
    { value: 'dialogue', label: propertyLabels.dialogue },
    { value: 'action', label: propertyLabels.action },
    { value: 'narration', label: propertyLabels.narration },
    { value: 'background', label: propertyLabels.background },
    { value: 'direction', label: propertyLabels.direction },
  ]

  const editCommands = commandRegistry.list().filter(c => c.category === 'edit' && c.shortcut)
  const plotCommands = commandRegistry.list().filter(c => c.category === 'plot' && c.shortcut)
  return (
    <div className="space-y-4">
      {(editCommands.length > 0 || plotCommands.length > 0) && (
        <SettingGroup label="편집·플롯 단축키">
          <ul className="space-y-1">
            {editCommands.map((cmd) => (
              <li key={cmd.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span>{cmd.label}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono shrink-0">{cmd.shortcut}</kbd>
              </li>
            ))}
            {plotCommands.map((cmd) => (
              <li key={cmd.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span>{cmd.label}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono shrink-0">{cmd.shortcut}</kbd>
              </li>
            ))}
          </ul>
        </SettingGroup>
      )}
      <SettingGroup label="# 단축키 매핑">
        {['#', '##', '###', '####'].map(pattern => (
          <div key={pattern} className="flex items-center gap-2">
            <code className="text-[10px] text-primary font-mono w-12 shrink-0">{pattern}</code>
            <span className="text-[10px] text-muted-foreground">→</span>
            <select
              value={hashShortcuts[pattern] || 'action'}
              onChange={(e) => setHashShortcut(pattern, e.target.value as any)}
              className="h-6 text-xs border border-border rounded px-1.5 bg-background flex-1"
            >
              {TYPE_OPTIONS_NO_SAME.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ))}
      </SettingGroup>

      <SettingGroup label="/ 팔레트 단축키">
        <SettingRow label="활성화">
          <input
            type="checkbox"
            checked={slashShortcutsEnabled}
            onChange={(e) => setSlashShortcutsEnabled(e.target.checked)}
            className="w-3.5 h-3.5"
          />
        </SettingRow>
      </SettingGroup>

      {slashShortcutsEnabled && (
        <SettingGroup label="숫자 1~9 할당">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => {
            const options: { value: string; label: string }[] = [
              { value: 'action', label: propertyLabels.action },
              { value: 'narration', label: propertyLabels.narration },
              { value: 'background', label: propertyLabels.background },
              ...(directionModeEnabled ? directionItems.filter(d => d.enabled).map(d => ({ value: d.id, label: d.label })) : []),
              ...characters.map(c => ({ value: c.id, label: c.name })),
            ]
            const current = slashNumberAssignments?.[digit] ?? (digit <= '3' ? ['action', 'narration', 'background'][parseInt(digit, 10) - 1] : '')
            return (
              <div key={digit} className="flex items-center gap-2 py-0.5">
                <code className="text-[10px] text-primary font-mono w-5 shrink-0">{digit}</code>
                <span className="text-[10px] text-muted-foreground shrink-0">→</span>
                <select
                  value={options.some(o => o.value === current) ? current : ''}
                  onChange={(e) => setSlashNumberAssignment(digit, e.target.value)}
                  className="h-6 text-xs border border-border rounded px-1.5 bg-background flex-1"
                >
                  <option value="">(미지정)</option>
                  {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </SettingGroup>
      )}
    </div>
  )
}

function DirectionsSection() {
  const store = useSettingsForEditor()
  const directionModeEnabled = store.directionModeEnabled
  const setDirectionModeEnabled = store.setDirectionModeEnabled
  const directionItems = store.directionItems
  const addDirectionItem = store.addDirectionItem
  const removeDirectionItem = store.removeDirectionItem
  const updateDirectionItem = store.updateDirectionItem
  const colonAsDialogue = store.colonAsDialogue
  const setColonAsDialogue = store.setColonAsDialogue

  const source = useContext(SettingsEditSourceContext)
  return (
    <div className="space-y-4">
      {source === 'default' && (
        <SettingGroup label="대사 인식">
          <SettingRow label="모든 ' : ' 를 대사로 인식">
            <input
              type="checkbox"
              checked={colonAsDialogue}
              onChange={(e) => setColonAsDialogue(e.target.checked)}
              className="w-3.5 h-3.5"
            />
          </SettingRow>
        </SettingGroup>
      )}
      <SettingGroup label="연출 모드">
        <SettingRow label="연출 모드 활성화">
          <input
            type="checkbox"
            checked={directionModeEnabled}
            onChange={(e) => setDirectionModeEnabled(e.target.checked)}
            className="w-3.5 h-3.5"
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup label="연출 목록">
        <div className="space-y-1">
          {directionItems.map(item => (
            <div key={item.id} className="flex items-center gap-1.5 group">
              <Input
                value={item.label}
                onChange={(e) => updateDirectionItem(item.id, e.target.value, item.enabled)}
                className="flex-1 h-6 text-xs px-1.5 border-border"
                disabled={!directionModeEnabled}
                style={{ opacity: directionModeEnabled ? 1 : 0.4 }}
              />
              <button
                onClick={() => removeDirectionItem(item.id)}
                disabled={!directionModeEnabled}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-opacity disabled:opacity-20"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={() => addDirectionItem('새 연출')}
            disabled={!directionModeEnabled}
            className="w-full mt-2 px-2 py-1 text-[10px] border border-dashed border-border rounded hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + 연출 추가
          </button>
        </div>
      </SettingGroup>
    </div>
  )
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs">{label}</span>
      {children}
    </div>
  )
}
