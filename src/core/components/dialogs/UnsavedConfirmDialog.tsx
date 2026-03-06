import { useUIStore } from '@/store/ui/uiStore'
import { useProjectStore } from '@/store/project/projectStore'
import { saveToLocalStorage, attachWorkspaceLayout, isDesktop } from '@/lib/fileIO'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export function UnsavedConfirmDialog() {
  const open = useUIStore(state => state.unsavedConfirmDialogOpen)
  const resolveUnsavedConfirm = useUIStore(state => state.resolveUnsavedConfirm)

  const handleChoice = (result: 'save' | 'discard' | 'cancel') => {
    if (result === 'save' && isDesktop()) {
      const file = useProjectStore.getState().file
      if (file) {
        const layout = useUIStore.getState().getWorkspaceLayoutSnapshot()
        saveToLocalStorage(attachWorkspaceLayout(file, layout))
        useProjectStore.getState().markClean()
      }
    }
    resolveUnsavedConfirm(result)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) handleChoice('cancel')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm rounded border border-border bg-background">
        <DialogHeader>
          <DialogTitle className="text-sm">저장하지 않은 변경</DialogTitle>
          <DialogDescription className="text-xs">
            저장하지 않은 변경이 있습니다. 저장하시겠습니까?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-1 sm:gap-0">
          <button
            type="button"
            onClick={() => handleChoice('cancel')}
            className="px-3 py-1.5 text-[11px] rounded border border-border bg-background hover:bg-muted transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => handleChoice('discard')}
            className="px-3 py-1.5 text-[11px] rounded border border-border bg-background hover:bg-muted transition-colors"
          >
            저장 안 함
          </button>
          {isDesktop() && (
            <button
              type="button"
              onClick={() => handleChoice('save')}
              className="px-3 py-1.5 text-[11px] rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              저장
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
