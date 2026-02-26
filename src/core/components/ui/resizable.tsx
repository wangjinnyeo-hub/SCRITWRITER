import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { cn } from '@/lib/utils'

interface ResizablePanelGroupProps extends React.ComponentProps<typeof PanelGroup> {
  className?: string
}

function ResizablePanelGroup({ className, ...props }: ResizablePanelGroupProps) {
  return (
    <PanelGroup
      className={cn('flex h-full w-full', className)}
      {...props}
    />
  )
}

const ResizablePanel = Panel

interface ResizableHandleProps extends React.ComponentProps<typeof PanelResizeHandle> {
  className?: string
  withHandle?: boolean
  direction?: 'horizontal' | 'vertical'
}

function ResizableHandle({ className, withHandle = false, direction = 'horizontal', ...props }: ResizableHandleProps) {
  const isVertical = direction === 'vertical'
  return (
    <PanelResizeHandle
      className={cn(
        'relative group flex items-center justify-center shrink-0',
        'bg-transparent transition-colors',
        'hover:bg-muted/50',
        'data-[resize-handle-active]:bg-muted',
        isVertical
          ? 'h-[12px] w-full cursor-row-resize'
          : 'w-[8px] h-full cursor-col-resize',
        className
      )}
      {...props}
    >
      <div className={cn(
        'bg-border transition-colors',
        'group-hover:bg-primary/30',
        'group-data-[resize-handle-active]:bg-primary/50',
        isVertical ? 'h-px w-full' : 'w-px h-full'
      )} />
      {withHandle && (
        <div className={cn(
          'absolute flex items-center justify-center',
          isVertical ? 'inset-x-0 h-full' : 'inset-y-0 w-full',
          'opacity-0 group-hover:opacity-100 transition-opacity'
        )}>
          <div className={cn('flex gap-0.5', isVertical ? 'flex-row' : 'flex-col')}>
            <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
            <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
            <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
          </div>
        </div>
      )}
    </PanelResizeHandle>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
