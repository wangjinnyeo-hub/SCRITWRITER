export interface AppCommand {
  id: string
  label: string
  category: 'file' | 'format' | 'view' | 'settings' | 'edit' | 'plot'
  shortcut?: string
  run: () => void
  isEnabled?: () => boolean
  icon?: string
}

class CommandRegistry {
  private commands = new Map<string, AppCommand>()

  register(command: AppCommand) {
    this.commands.set(command.id, command)
  }

  get(id: string): AppCommand | undefined {
    return this.commands.get(id)
  }

  list(): AppCommand[] {
    return Array.from(this.commands.values())
  }
}

export const commandRegistry = new CommandRegistry()
