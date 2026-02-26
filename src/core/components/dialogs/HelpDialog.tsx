import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useUIStore } from '@/store/ui/uiStore'

interface HelpDialogProps {
  open: boolean
  onClose: () => void
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px] max-h-[85vh] overflow-hidden flex flex-col rounded border border-border bg-background shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>도움말</DialogTitle>
          <DialogDescription>단축키와 기본 사용 흐름을 안내합니다.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-[var(--panel-header)]">
          <span className="text-xs font-medium">도움말</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="닫기">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-auto p-4 space-y-5 text-[11px]">
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2">단축키</h3>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl</kbd> + <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Z</kbd> — 되돌아가기</li>
              <li><kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl</kbd> + <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Shift</kbd> + <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Z</kbd> — 다시 실행</li>
              <li><kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Shift</kbd> + <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd> — 새 단락 추가 / 단락 분할</li>
              <li><kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl</kbd> + 클릭 — 다중 선택</li>
              <li><kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Shift</kbd> + 클릭 — 범위 선택</li>
              <li><kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">/</kbd> — 유형·연출·캐릭터 팔레트</li>
              <li><kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">@</kbd> — 유형·캐릭터 팔레트</li>
              <li><kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">#</kbd>, <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">##</kbd> 등 + 스페이스 — 해당 유형으로 변경</li>
              <li>단락 본문 더블클릭 — 유형 순환 (지문→행동→나레이션→배경→대사→연출)</li>
              <li>대사 단락에서 <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">:</kbd> 입력 — 캐릭터 선택 팔레트 (설정에서 &quot;: 대사 인식&quot; 켜야 함)</li>
            </ul>
          </section>
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2">플롯(시나리오) 관련</h3>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><strong className="text-foreground">플롯 박스 이동</strong> — 왼쪽 플롯 목록에서 플롯을 드래그해 순서를 바꿉니다.</li>
              <li><strong className="text-foreground">플롯 분리</strong> — 시나리오 편집 중 커서 위치에서 <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl</kbd> + <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd>를 누르면 해당 위치에서 플롯이 둘로 나뉩니다.</li>
              <li><strong className="text-foreground">플롯 추가</strong> — 플롯 목록 아래 &quot;+ 추가&quot; 버튼, 우클릭 메뉴 &quot;플롯 추가&quot;, 또는 <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl</kbd> + <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Shift</kbd> + <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">P</kbd>로 새 플롯을 추가합니다.</li>
              <li><strong className="text-foreground">되돌아가기 / 다시 실행</strong> — 플롯 추가·삭제·이동·분리 등은 모두 <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+Z</kbd>로 되돌리고 <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+Shift+Z</kbd>로 다시 실행할 수 있습니다.</li>
            </ul>
          </section>
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2">기본 흐름</h3>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
              <li>에피소드를 선택한 뒤, 왼쪽 플롯 목록에서 플롯(장면)을 클릭해 선택하고 더블클릭 또는 Enter로 확정합니다.</li>
              <li>확정한 플롯이 시나리오 창에 표시됩니다. 단락 끝에서 <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Shift+Enter</kbd>로 새 단락을 추가합니다.</li>
              <li>유형 변경: 단락 왼쪽 핸들 우클릭, 또는 <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">#</kbd>·<kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">/</kbd>·<kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">@</kbd>를 사용합니다.</li>
              <li>대사는 캐릭터를 지정한 뒤 작성합니다. &quot; : &quot; 포함 줄은 설정에서 &quot;모든 : 대사 인식&quot;을 켜면 자동으로 대사로 인식됩니다.</li>
              <li>단락·플롯을 드래그해 순서를 바꾸거나 다른 플롯으로 이동할 수 있습니다.</li>
              <li>헤더에서 전체보기·내보내기·서식·설정을 열 수 있습니다.</li>
            </ol>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
