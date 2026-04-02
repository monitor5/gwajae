# Gwajae Technical Design

## 1. 권장 기술 스택

### 프론트엔드

- `React`
- `TypeScript`
- `CSS Modules`
- 라우팅: `React Router` 또는 프레임워크 내장 라우터

### 백엔드 / BaaS

- `Supabase`
  - Auth
  - Postgres
  - Storage

### 배포

- `Vercel`

## 2. 왜 Supabase인가

이 프로젝트는 다음 요구사항이 핵심이다.

- Google 로그인
- 허용 이메일 기반 접근 제어
- 사용자별 데이터 분리
- 사진/파일 업로드
- 가벼운 운영

Supabase는 `Auth + DB + Storage + Row Level Security`를 한 번에 제공하므로, Oracle Free Tier보다 MVP 구현 난이도가 낮고 운영이 단순하다.

## 3. Oracle Free Tier를 기본 선택으로 두지 않는 이유

- DB는 제공되지만 인증과 파일 저장을 별도로 더 많이 조립해야 함
- 프론트엔드와 바로 연결되는 사용자 권한 제어 구성이 Supabase보다 복잡함
- 이 프로젝트는 대규모 트래픽보다 개발 속도와 관리 편의성이 더 중요함

## 4. 시스템 아키텍처

### 전체 구조

1. React 프론트엔드
2. Supabase Auth로 Google 로그인
3. Supabase Postgres에 과목/과제/권한 데이터 저장
4. Supabase Storage에 사진/파일 저장
5. RLS로 사용자별 접근 통제

## 5. 권한 설계 원칙

### 핵심 원칙

- 로그인 허용 여부는 `allowed_users.email` 기준
- 실제 데이터 접근은 `auth.uid()` 기준
- 관리자 권한은 운영 기능 접근 권한이지, 전체 데이터 열람 권한이 아님

### 역할

- `admin`
- `member`

## 6. 데이터 모델 초안

### 6.1 allowed_users

서비스 접근 허용 계정 목록

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| email | text | 고유 이메일 |
| role | text | `admin` 또는 `member` |
| is_active | boolean | 활성 여부 |
| created_at | timestamptz | 생성일 |

### 6.2 profiles

로그인한 사용자 프로필

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | uuid | Supabase Auth User ID, PK |
| email | text | 사용자 이메일 |
| display_name | text | 표시 이름 |
| created_at | timestamptz | 생성일 |

### 6.3 subjects

사용자별 과목

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| owner_user_id | uuid | 사용자 ID |
| name | text | 과목명 |
| color | text | 파스텔 색상 키 |
| is_default | boolean | 기본 과목 여부 |
| created_at | timestamptz | 생성일 |

#### 제약

- 사용자마다 `미지정` 기본 과목 1개 필요
- `is_default = true`인 과목은 삭제 대신 보호 처리 권장

### 6.4 assignments

과제 메인 엔터티

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| owner_user_id | uuid | 사용자 ID |
| subject_id | uuid | 과목 ID |
| title | text | 과제명 |
| description | text | 설명 |
| due_date | date | 마감일 |
| submitted | boolean | 제출 여부 |
| is_favorite | boolean | 즐겨찾기 여부 |
| link_url | text | 외부 링크 |
| created_at | timestamptz | 생성일 |
| updated_at | timestamptz | 수정일 |

### 6.5 assignment_assets

과제 첨부 리소스

| 컬럼명 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| assignment_id | uuid | 과제 ID |
| owner_user_id | uuid | 사용자 ID |
| asset_type | text | `image` 또는 `file` |
| storage_path | text | Storage 경로 |
| file_name | text | 원본 파일명 |
| mime_type | text | MIME 타입 |
| size_bytes | bigint | 파일 크기 |
| is_thumbnail | boolean | 썸네일 여부 |
| created_at | timestamptz | 생성일 |

## 7. 저장소 구조 제안

### Storage 버킷

- `assignment-assets`

### 경로 구조 예시

```text
assignment-assets/{user_id}/{assignment_id}/{filename}
```

이 구조를 쓰면 사용자 단위로 용량 집계와 접근 제어가 쉬워진다.

## 8. 용량 제한 설계

### 사용자 제한

- 사용자 총 업로드 합계가 `100MB`를 초과하면 업로드 차단

### 전체 제한

- 관리자 홈에서는 전체 프로젝트 사용량을 `1GB` 기준으로 시각화

### 구현 방식

1. 파일 업로드 전 현재 사용자 총 사용량 조회
2. 새 파일 크기 합산 후 `100MB` 초과 여부 검사
3. 초과 시 업로드 차단
4. 전체 사용량 집계는 관리자 홈에서 별도 조회

## 9. 인증 흐름

1. 사용자가 Google OAuth 로그인 시도
2. 로그인 성공 후 사용자 이메일 확인
3. `allowed_users`에 존재하지 않거나 비활성이면 접근 거부
4. 허용된 사용자는 `profiles`에 upsert
5. 서비스 진입

## 10. RLS 방향

### 원칙

- `subjects.owner_user_id = auth.uid()`인 경우만 접근 가능
- `assignments.owner_user_id = auth.uid()`인 경우만 접근 가능
- `assignment_assets.owner_user_id = auth.uid()`인 경우만 접근 가능
- `allowed_users`는 관리자만 조회/수정 가능

### 관리자 주의사항

- 관리자라고 해서 다른 사용자의 과제 데이터를 조회하도록 정책을 열지 않음

## 11. 프론트엔드 페이지 구조 초안

### `/login`

- Google 로그인 버튼
- 허용되지 않은 계정 안내 메시지

### `/`

- 홈 탭 기본 진입

### `/assignments`

- 과제 관리 탭

### `/admin`

- 관리자 전용 탭

## 12. 주요 컴포넌트 초안

### 공통

- `AppLayout`
- `TopNavigation`
- `TabNavigation`
- `ProtectedRoute`
- `AdminRoute`

### 홈

- `StorageUsageCard`
- `ProjectStorageUsageCard`
- `FavoriteAssignmentsTable`
- `UpcomingAssignmentsTable`

### 과제 관리

- `SubjectFilter`
- `SubjectCreateButton`
- `AssignmentTable`
- `AssignmentCreateModal`
- `AssignmentDeleteDialog`
- `FavoriteToggle`
- `SubmittedToggle`

### 관리자

- `AllowedUsersTable`
- `AddAllowedUserModal`

## 13. 디자인 방향 메모

- 표 중심 UI
- 파스텔 과목 색상 배지
- 원형 사용량 그래프
- 핵심 액션 버튼은 우측 상단 고정 배치 권장
- 모달 입력 폼은 파일 업로드 영역과 기본 정보 영역을 분리

## 14. 초기 색상 프리셋 예시

- soft-pink
- soft-peach
- soft-yellow
- soft-lime
- soft-mint
- soft-sky
- soft-blue
- soft-lavender
- soft-purple
- soft-rose
- soft-sand
- soft-gray

## 15. 개발 시 주의점

- 이메일 whitelist만으로 데이터 보호를 끝내지 말고 반드시 RLS 적용
- 파일 업로드 후 메타데이터와 스토리지 정합성 관리 필요
- 과목 삭제 시 `미지정` 과목 이동을 트랜잭션 관점에서 처리
- 첨부파일 무제한 UX이므로 프론트에서 누적 용량 안내가 중요

