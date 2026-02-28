export interface ThemeDefinition {
  id: string
  name: string
  nameKo: string
  variables: Record<string, string>
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  theme?: ThemeDefinition
  commands?: CommandExtension[]
}

export interface CommandExtension {
  id: string
  label: string
  category: string
  run: () => void
}
