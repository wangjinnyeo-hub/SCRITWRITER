export type ScriptPropertyType = 
  | 'character'
  | 'dialogue'
  | 'narration'
  | 'action'
  | 'background'
  | 'direction'

export interface Character {
  id: string
  name: string
  color: string
  shortcut: number
  visible: boolean
}

export interface ScriptUnit {
  id: string
  order: number
  type: ScriptPropertyType
  characterId?: string
  /** 엑스트라 대사일 때 시나리오 창에 표시할 개별 이름 (엑스트라는 팔레트에서 이름 통일 불가) */
  dialogueLabel?: string
  content: string
}

export interface PlotBox {
  id: string
  order: number
  title?: string
  content: string
  scriptUnits: ScriptUnit[]
}

export interface Episode {
  id: string
  number: number
  subtitle: string
  plotBoxes: PlotBox[]
}

export interface PropertyStyle {
  fontFamily?: string
  fontSize?: number
  color?: string
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textAlign?: 'left' | 'center' | 'right'
}

export interface ProjectSettings {
  propertyLabels?: Partial<Record<ScriptPropertyType, string>>
  propertyStyles?: Partial<Record<ScriptPropertyType, PropertyStyle>>
  doubleEnterDelay?: number
  slashShortcutsEnabled?: boolean
  slashShortcuts?: {
    action?: string
    narration?: string
    background?: string
  }
}

export interface Project {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  characters: Character[]
  characterPalettes?: CharacterPalette[]
  settings?: ProjectSettings
}

/** 에디터 레이아웃 모드: 플롯/시나리오 배치 */
export type EditorLayoutMode =
  | 'horizontal'
  | 'horizontal-reversed'
  | 'vertical'
  | 'vertical-reversed'

/** 파일에 저장하는 워크스페이스 인터페이스 상태 (열 때 그대로 복원) */
export interface WorkspaceLayoutState {
  editorLayoutMode: EditorLayoutMode
  leftPanelVisible: boolean
  plotPanelVisible: boolean
  scriptPanelVisible: boolean
  plotContentVisible: boolean
  /** 모드별 패널 비율 [위/왼, 아래/오른] 합 100 */
  panelSizes: Record<EditorLayoutMode, number[]>
  /** 플롯 확정 id 목록. 저장/열 때 복원 (선택 필드, 구 파일 호환) */
  confirmedPlotBoxIds?: string[]
}

export interface SWFile {
  version: '1.0'
  project: Project
  episodes: Episode[]
  /** 저장 시 함께 저장, 열 때 복원 */
  workspaceLayout?: WorkspaceLayoutState
}

export interface RecentItem {
  id: string
  type: 'project' | 'episode'
  title: string
  subtitle?: string
  updatedAt: number
  projectId?: string
}

export interface StylePreset {
  id: string
  name: string
  styles: Record<ScriptPropertyType, PropertyStyle>
}

export interface CharacterPalette {
  id: string
  name: string
  characters: Character[]
  createdAt: number
  updatedAt: number
}
