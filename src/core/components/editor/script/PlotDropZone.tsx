import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { PLOT_TARGET_SCENARIO_PREFIX } from '../constants'

type PlotDropZoneProps = {
  plotId: string
  plotLabel: string
  children?: React.ReactNode
  className?: string
}

export function PlotDropZone({ plotId, children, className }: PlotDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: PLOT_TARGET_SCENARIO_PREFIX + plotId })
  return (
    <div
      ref={setNodeRef}
      className={cn(className, 'min-h-[28px] flex items-center')}
    >
      {children}
    </div>
  )
}
