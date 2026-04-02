# Frontend Component Map

## User Space

- `UserShell`
  - 일반 사용자 레이아웃
  - 상단 탭: `Home`, `Assignments`
  - 내부 라우트 렌더링 담당

- `TopTabs`
  - pill 형태 상단 내비게이션
  - 현재 활성 탭 강조

- `HomePage`
  - 2열 대시보드 레이아웃
  - 왼쪽:
    - 개인 저장공간 카드
    - 관리자 미리보기용 전체 저장공간 카드
  - 오른쪽:
    - 마감 임박 과제 패널
    - 즐겨찾기 패널

- `AssignmentsPage`
  - 과제 라이브러리 표
  - 상단 액션:
    - 과목 필터
    - 과목 추가
    - 과제 추가
  - 과제 등록 모달 오픈

- `NewAssignmentModal`
  - 기본 정보 영역
  - 첨부 업로드 영역
  - 제출 여부 체크

## Admin Space

- `AdminPage`
  - 관리자 전용 독립 화면
  - 상단 탭은 `Admin` 하나만 표시
  - 허용 이메일 관리 테이블
  - 이메일 입력 + 초대 버튼

## Data Layer

- `mockData.ts`
  - 과목/과제/사용량/허용 유저 목업 데이터

## Routing

- `/`
  - 일반 사용자 홈
- `/assignments`
  - 일반 사용자 과제 관리
- `/admin`
  - 관리자 전용 공간

