import type { SWFile, WorkspaceLayoutState } from '@/types'

const SW_FILE_VERSION = '1.0'
const LOCAL_STORAGE_KEY = 'script-writer-file'

/** 기본 프로젝트 확장자. 파일 연결·인식용 */
export const DEFAULT_PROJECT_EXT = 'scrwrt'
const ACCEPT_EXTENSIONS = '.scrwrt,.sw,.json'

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.electron !== 'undefined'
}

/** 저장 시 현재 UI 레이아웃을 파일에 붙일 때 사용 */
export function attachWorkspaceLayout(
  file: SWFile,
  layout: WorkspaceLayoutState
): SWFile {
  return { ...file, workspaceLayout: layout }
}

export function serializeFile(file: SWFile): string {
  return JSON.stringify({
    version: SW_FILE_VERSION,
    data: file,
  }, null, 2)
}

export function deserializeFile(content: string): SWFile {
  const parsed = JSON.parse(content)
  if (parsed.version && parsed.data) {
    return parsed.data as SWFile
  }
  return parsed as SWFile
}

export function saveToLocalStorage(file: SWFile): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, serializeFile(file))
  } catch (error) {
    if (import.meta.env.DEV) console.error('Failed to save to localStorage:', error)
  }
}

export function loadFromLocalStorage(): SWFile | null {
  try {
    const content = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (content) {
      return deserializeFile(content)
    }
  } catch (error) {
    if (import.meta.env.DEV) console.error('Failed to load from localStorage:', error)
  }
  return null
}

/** 웹: 재진입 시 기존 저장 데이터를 버리고 새 가이드로 시작할 때 사용 */
export function clearLocalStorageFile(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
  } catch {
    if (import.meta.env.DEV) console.error('Failed to clear localStorage file')
  }
}

export function downloadFile(file: SWFile, filename?: string): void {
  const content = serializeFile(file)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `${file.project.title}.${DEFAULT_PROJECT_EXT}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function openFilePicker(): Promise<SWFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = ACCEPT_EXTENSIONS
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        try {
          const content = await file.text()
          const swFile = deserializeFile(content)
          resolve(swFile)
        } catch (error) {
          if (import.meta.env.DEV) console.error('Failed to read file:', error)
          resolve(null)
        }
      } else {
        resolve(null)
      }
    }
    input.click()
  })
}

/** 저장용 파일명으로 쓸 수 있도록 제목 치환. 빈 문자열·'제목 없음'·'새 프로젝트' 등은 '무제' 또는 '제목없음_YYYYMMDD'. */
export function sanitizeTitleForFilename(title: string): string {
  const t = (title || '').trim()
  if (!t || t === '제목 없음' || t === '새 프로젝트') {
    return `제목없음_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  }
  const safe = t.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim()
  return safe || `제목없음_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
}

/** 데스크톱: 제목으로 기본 저장 경로 반환. (파일 탐색기 없이 저장할 때 사용) */
export async function getDefaultSavePath(projectTitle: string): Promise<string | null> {
  if (!isDesktop() || !window.electron) return null
  const base = sanitizeTitleForFilename(projectTitle)
  const ext = `.${DEFAULT_PROJECT_EXT}`
  const filename = base.endsWith(ext) || base.endsWith('.sw') ? base : `${base}${ext}`
  return window.electron.getDefaultProjectPath(filename)
}

/** 데스크톱: 기본 프로젝트 폴더 내 파일 전체 경로. (가이드 등 고정 파일명용) */
export async function getDefaultProjectPath(filename: string): Promise<string | null> {
  if (!isDesktop() || !window.electron) return null
  return window.electron.getDefaultProjectPath(filename)
}

/** 데스크톱: 지정 경로에 파일 저장. 실패 시 { error } 반환. */
export async function saveToPath(file: SWFile, filePath: string): Promise<{ error?: string }> {
  if (!isDesktop() || !window.electron) {
    return { error: 'Not in desktop mode' }
  }
  const content = serializeFile(file)
  const result = await window.electron.saveToPath(filePath, content)
  return result.error ? { error: result.error } : {}
}

/** 데스크톱: 저장 대화상자로 경로 선택 후 반환. 취소 시 null. */
export async function showSaveDialog(defaultName?: string): Promise<string | null> {
  if (!isDesktop() || !window.electron) return null
  const result = await window.electron.showSaveDialog(defaultName)
  return result.path ?? null
}

/** 데스크톱: 열기 대화상자로 파일 선택 후 내용과 경로 반환. 웹이면 content/path 없이 openFilePicker()로 대체. */
export async function openFromPath(): Promise<{ content: string; path: string } | null> {
  if (isDesktop() && window.electron) {
    const result = await window.electron.openFile()
    if (result.error || result.content == null) return null
    return { content: result.content, path: result.path ?? '' }
  }
  const swFile = await openFilePicker()
  if (!swFile) return null
  return { content: serializeFile(swFile), path: '' }
}

/** 데스크톱: 경로로 파일 읽어서 SWFile 반환. 실패 시 null. */
export async function loadFromPath(filePath: string): Promise<SWFile | null> {
  if (!isDesktop() || !window.electron) return null
  const result = await window.electron.readFile(filePath)
  if (result.error || result.content == null) return null
  try {
    return deserializeFile(result.content)
  } catch {
    return null
  }
}
