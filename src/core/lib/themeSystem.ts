import type { ThemeDefinition } from '@/types/plugin'

const THEME_STORAGE_KEY = 'sw-active-theme'

export function applyTheme(theme: ThemeDefinition) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.variables)) {
    root.style.setProperty(key, value)
  }
  if (theme.id === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  localStorage.setItem(THEME_STORAGE_KEY, theme.id)
}

export function resetTheme() {
  const root = document.documentElement
  root.removeAttribute('style')
  root.classList.remove('dark')
  localStorage.removeItem(THEME_STORAGE_KEY)
}

export function getSavedThemeId(): string | null {
  return localStorage.getItem(THEME_STORAGE_KEY)
}

export const defaultTheme: ThemeDefinition = {
  id: 'light',
  name: 'Light',
  nameKo: '라이트',
  variables: {
    '--background': '#ffffff',
    '--foreground': '#0a0a0a',
    '--card': '#ffffff',
    '--card-foreground': '#0a0a0a',
    '--primary': '#0a0a0a',
    '--primary-foreground': '#ffffff',
    '--secondary': '#f5f5f5',
    '--secondary-foreground': '#0a0a0a',
    '--muted': '#e5e5e5',
    '--muted-foreground': '#737373',
    '--accent': '#ebebeb',
    '--accent-foreground': '#0a0a0a',
    '--destructive': '#404040',
    '--destructive-foreground': '#ffffff',
    '--border': '#d4d4d4',
    '--input': '#d4d4d4',
    '--ring': '#475569',
    '--radius': '0.2rem',
    '--sidebar-bg': '#f0f0f0',
    '--panel-header': '#fafafa',
  },
}

export const darkTheme: ThemeDefinition = {
  id: 'dark',
  name: 'Dark',
  nameKo: '다크',
  variables: {
    '--background': '#0a0a0a',
    '--foreground': '#d4d4d4',
    '--card': '#141414',
    '--card-foreground': '#d4d4d4',
    '--primary': '#e5e5e5',
    '--primary-foreground': '#0a0a0a',
    '--secondary': '#1f1f1f',
    '--secondary-foreground': '#d4d4d4',
    '--muted': '#262626',
    '--muted-foreground': '#a3a3a3',
    '--accent': '#2a2a2a',
    '--accent-foreground': '#d4d4d4',
    '--destructive': '#525252',
    '--destructive-foreground': '#e5e5e5',
    '--border': '#404040',
    '--input': '#3f3f3f',
    '--ring': '#64748b',
    '--radius': '0.2rem',
    '--sidebar-bg': '#0f0f0f',
    '--panel-header': '#1a1a1a',
  },
}

export const builtinThemes: ThemeDefinition[] = [defaultTheme, darkTheme]
