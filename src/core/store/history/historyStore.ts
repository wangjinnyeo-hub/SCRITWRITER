import { create } from 'zustand'

export interface Command {
  execute: () => void
  undo: () => void
  description: string
}

interface HistoryState {
  past: Command[]
  future: Command[]
  
  executeCommand: (command: Command) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  clear: () => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  
  executeCommand: (command) => {
    command.execute()
    set((state) => ({
      past: [...state.past, command],
      future: [],
    }))
  },
  
  undo: () => {
    const { past, future } = get()
    if (past.length === 0) return
    
    const command = past[past.length - 1]
    command.undo()
    
    set({
      past: past.slice(0, -1),
      future: [command, ...future],
    })
  },
  
  redo: () => {
    const { past, future } = get()
    if (future.length === 0) return
    
    const command = future[0]
    command.execute()
    
    set({
      past: [...past, command],
      future: future.slice(1),
    })
  },
  
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  
  clear: () => set({ past: [], future: [] }),
}))
