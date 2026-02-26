import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { PLOT_TARGET_PREFIX } from '../constants'

type PlotDropTargetProps = {
  plotId: string
  children: React.ReactNode
  className?: string
}

export function PlotDropTarget({ plotId, children, className }: PlotDropTargetProps) {
  const { setNodeRef, isOver } = useDroppable({ id: PLOT_TARGET_PREFIX + plotId })
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  )
}
