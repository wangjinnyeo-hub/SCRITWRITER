export interface ElectronAPI {
  saveToPath: (filePath: string, content: string) => Promise<{ path?: string; error?: string }>
  showSaveDialog: (defaultName?: string) => Promise<{ path: string | null }>
  openFile: () => Promise<{ content: string | null; path: string | null; error?: string }>
  getUserDataPath: () => Promise<string>
  setLastOpenedPath: (lastPath: string | null) => Promise<{ error?: string }>
  getLastOpenedPath: () => Promise<string | null>
  /** 앱 시작/파일 연결로 전달된 열기 대기 경로. 한 번 호출 시 반환 후 초기화됨. */
  getPendingOpenPath: () => Promise<string | null>
  /** .scrwrt 등 파일 더블클릭 시(두 번째 인스턴스/open-file) 경로 수신 콜백 등록 */
  onOpenFileFromArg: (callback: (path: string) => void) => void
  /** 기본 프로젝트 폴더 내 파일 전체 경로. filename 예: '가이드.scrwrt' */
  getDefaultProjectPath: (filename: string) => Promise<string>
  readFile: (filePath: string) => Promise<{ content: string | null; error?: string }>
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowUnmaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  setWindowTitle: (title: string) => Promise<void>
  /** 새 창 열기. 각 창에서 서로 다른 프로젝트를 동시에 작업할 수 있음. */
  openNewWindow: () => Promise<void>
}

declare global {
  interface Window {
    electron?: ElectronAPI
  }
}

export {}
