import type { SWFile, Project, Episode, PlotBox, ScriptUnit, Character } from '@/types'
import { generateId } from './ids'
import { getDefaultWorkspaceLayout } from '@/store/ui/uiStore'
import { DEFAULT_CHARACTER_COLORS, EXTRA_CHARACTER_COLOR } from '@/lib/colorPresets'

/** 기본 가이드: 샘플과 동일한 사용법 내용, 제목만 '가이드'. 앱 시작 시 복원할 파일이 없을 때 사용. */
export function createGuideProject(): SWFile {
  const sample = createSampleProject()
  return {
    ...sample,
    project: { ...sample.project, title: '가이드' },
    episodes: sample.episodes.map(ep => ({ ...ep, subtitle: '가이드' })),
  }
}

/** 샘플: 설명서 말투, 기능·단축키 위주. 플롯 박스(Shift+Enter 먼저) → 스크립트 유형(추가 방법·콜론 등) → 유형 변경 → 선택·이동·레이아웃. */
export function createSampleProject(): SWFile {
  const now = Date.now()
  const extraId = generateId()
  const charAId = generateId()
  const charBId = generateId()
  const project: Project = {
    id: generateId(),
    title: '사용 방법',
    createdAt: now,
    updatedAt: now,
    characters: [
      { id: extraId, name: '엑스트라', color: EXTRA_CHARACTER_COLOR, shortcut: 0, visible: true },
      { id: charAId, name: 'A', color: DEFAULT_CHARACTER_COLORS[0], shortcut: 1, visible: true },
      { id: charBId, name: 'B', color: DEFAULT_CHARACTER_COLORS[1], shortcut: 2, visible: true },
    ],
    settings: {},
  }
  const epId = generateId()
  const u = (order: number, type: ScriptUnit['type'], content: string, characterId?: string, dialogueLabel?: string): ScriptUnit => ({
    id: generateId(),
    order,
    type,
    characterId,
    dialogueLabel,
    content,
  })
  const plotIds = Array.from({ length: 6 }, () => generateId())

  // 1. 플롯 박스 사용법 — Shift+Enter를 제일 먼저. 그 다음 플롯 선택·확정·추가·분할.
  const plot1Content = '모든 내용은 플롯 박스 안에 작성한다. 한 플롯은 한 장면 단위이며, 요약만 넣거나 여러 단락을 이어 쓸 수 있다.'
  const plot1Units: ScriptUnit[] = [
    u(0, 'background', 'S#1 플롯 박스 사용법'),
    u(1, 'narration', '새 단락 추가 — 단락 끝에서 Shift+Enter. 같은 유형의 단락이 바로 아래 삽입된다.'),
    u(2, 'action', '단락 중간에서 Shift+Enter를 누르면 커서 위치를 기준으로 단락이 둘로 나뉜다.'),
    u(3, 'narration', 'Shift+Enter 다음에 올 유형은 설정에서 지정할 수 있다.'),
    u(4, 'action', '플롯 선택 — 왼쪽 목록에서 클릭. 확정 — 더블클릭 또는 Enter. 확정한 플롯만 시나리오 창에 순서대로 표시된다.'),
    u(5, 'narration', '플롯 추가 — 목록 위 + 버튼. 현재 선택한 플롯 뒤에 새 플롯이 추가된다.'),
    u(6, 'action', '스크립트 내 플롯 분할 — 시나리오 창에서 분할 기준이 될 단락에 커서를 두고 Ctrl+Enter. 해당 단락부터 이후 내용이 새 플롯으로 이동한다.'),
  ]

  // 2. 스크립트 유형 — 추가 방법 먼저. 그 다음 유형별 설명(배경·지문·나레이션·대사·연출). 콜론(:) 기능을 별도로 설명.
  const plot2Units: ScriptUnit[] = [
    u(0, 'background', 'S#2 스크립트 유형'),
    u(1, 'narration', '단락 추가 방법: ① 단락 끝에서 Shift+Enter ② / 입력 후 유형·연출·캐릭터 선택 ③ @ 입력 후 유형·캐릭터 선택.'),
    u(2, 'background', '배경 — 장소·시간을 적는 유형. 설정에서 자동 번호(S#1, S#2 …)를 사용할 수 있다.'),
    u(3, 'action', '지문 — 캐릭터의 동작·행동을 서술한다.'),
    u(4, 'narration', '나레이션 — 화자 서술.'),
    u(5, 'dialogue', '대사 — 캐릭터의 대사. 같은 캐릭터의 연속 대사는 그룹으로 묶어 표시할 수 있다.', charAId),
    u(6, 'narration', '콜론(:) — 대사 단락에서 콜론을 입력하면 캐릭터 선택 팔레트가 열린다. 캐릭터를 선택하면 해당 단락이 그 캐릭터의 대사로 지정된다.'),
    u(7, 'dialogue', '엑스트라를 선택한 경우 장면·연출마다 다른 이름을 붙일 수 있다. 캐릭터명 레이블을 더블클릭하면 해당 대사만의 이름을 직접 입력할 수 있다.', extraId, '손님'),
    u(8, 'direction', '연출 — 촬영·연출 지시. 설정의 연출 목록에서 항목을 선택하면 해당 이름이 들어간 단락이 자동으로 생성된다.'),
    u(9, 'narration', '사이드바에서 캐릭터 이름·색상을 변경하면 프로젝트 전체에 반영된다.'),
  ]

  // 3. 유형 변경 — 핸들 우클릭, 텍스트 밖 더블클릭, #, 본문 더블클릭 순환
  const plot3Units: ScriptUnit[] = [
    u(0, 'background', 'S#3 유형 변경'),
    u(1, 'narration', '단락 유형만 바꾸기 — 단락 왼쪽 핸들 우클릭, 또는 단락 텍스트가 아닌 영역 더블클릭. 메뉴에서 유형을 선택한다.'),
    u(2, 'action', '# 유형 변경 — 단락 안에서 #(또는 ##, ###) 입력 후 스페이스. 현재 단락의 유형만 지정한 유형으로 바뀐다.'),
    u(3, 'narration', '단락 본문 더블클릭 시 유형이 순환된다(지문→행동→나레이션→배경→대사→연출).'),
  ]

  // 4. 선택 — Ctrl 다중선택, Shift 범위 선택
  const plot4Units: ScriptUnit[] = [
    u(0, 'background', 'S#4 선택'),
    u(1, 'narration', '다중 선택 — Ctrl+클릭으로 단락 또는 플롯을 하나씩 추가 선택한다.'),
    u(2, 'action', '범위 선택 — Shift+클릭으로 첫 클릭 위치부터 두 번째 클릭 위치까지 범위로 선택한다.'),
  ]

  // 5. 이동 — 그룹 이동, 플롯 순서
  const plot5Units: ScriptUnit[] = [
    u(0, 'background', 'S#5 이동'),
    u(1, 'narration', '선택한 단락을 드래그하여 다른 위치 또는 다른 플롯으로 이동할 수 있다.'),
    u(2, 'action', '플롯 순서 변경 — 왼쪽 목록에서 플롯을 드래그하여 순서를 바꾼다.'),
    u(3, 'narration', '시나리오 창에서 플롯 제목을 드래그해도 플롯 순서를 바꿀 수 있다.'),
  ]

  // 6. 상하 레이아웃
  const plot6Units: ScriptUnit[] = [
    u(0, 'background', 'S#6 상하 레이아웃'),
    u(1, 'narration', '상하 레이아웃 — 헤더의 상하 아이콘을 선택하면 플롯 목록이 위, 시나리오가 아래에 배치된다.'),
    u(2, 'action', '한 플롯을 크게 보며 작성할 때 유용하다. 넓은 화면에서 사용하기 적합하다.'),
  ]

  const episode: Episode = {
    id: epId,
    number: 1,
    subtitle: '사용 방법',
    plotBoxes: [
      { id: plotIds[0], order: 0, title: '1. 플롯 박스 사용법', content: plot1Content, scriptUnits: plot1Units },
      { id: plotIds[1], order: 1, title: '2. 스크립트 유형', content: '추가 방법, 유형별 설명, 콜론(:), 엑스트라, 연출', scriptUnits: plot2Units },
      { id: plotIds[2], order: 2, title: '3. 유형 변경', content: '핸들 우클릭, #, 더블클릭 순환', scriptUnits: plot3Units },
      { id: plotIds[3], order: 3, title: '4. 선택', content: 'Ctrl 다중선택, Shift 범위 선택', scriptUnits: plot4Units },
      { id: plotIds[4], order: 4, title: '5. 이동', content: '단락·그룹 이동, 플롯 순서 변경', scriptUnits: plot5Units },
      { id: plotIds[5], order: 5, title: '6. 상하 레이아웃', content: '헤더 상하 아이콘, 한 플롯 중심 작성', scriptUnits: plot6Units },
    ],
  }
  return {
    version: '1.0',
    project,
    episodes: [episode],
    workspaceLayout: getDefaultWorkspaceLayout(),
  }
}

export function createEmptyProject(title: string = '새 프로젝트'): SWFile {
  const now = Date.now()
  const project: Project = {
    id: generateId(),
    title,
    createdAt: now,
    updatedAt: now,
    characters: [
      { id: generateId(), name: '엑스트라', color: EXTRA_CHARACTER_COLOR, shortcut: 0, visible: true },
      { id: generateId(), name: '주인공', color: DEFAULT_CHARACTER_COLORS[0], shortcut: 1, visible: true },
      { id: generateId(), name: '조연', color: DEFAULT_CHARACTER_COLORS[1], shortcut: 2, visible: true },
      { id: generateId(), name: '캐릭터A', color: DEFAULT_CHARACTER_COLORS[2], shortcut: 3, visible: true },
    ],
    settings: {}
  }

  const firstEpisode: Episode = {
    id: generateId(),
    number: 1,
    subtitle: '',
    plotBoxes: [
      {
        id: generateId(),
        order: 0,
        content: '',
        scriptUnits: []
      }
    ]
  }

  return {
    version: '1.0',
    project,
    episodes: [firstEpisode],
    workspaceLayout: getDefaultWorkspaceLayout(),
  }
}

export { generateId }
