---
version: "1.1"
created: "2026-06-08"
updated: "2026-06-08"
author: "arahansa"
---

# 완료된 작업 목록 페이지 설계

## 배경 / 요구사항

`docs/domain/03-node.md`(124행~) "추가 기능":

> 어떤 요구사항(REQUIREMENT)이 상태가 완료(DONE)로 변경되면, 완료된 시간을 저장하고 싶어.
> 그리고 별도의 페이지를 만들어서, 오늘 완료된 작업 목록들 보여지게 하고 싶어.
> 해당 페이지의 상단에 검색영역을 두고 달력을 하나 둬서, 특정 기간내에 완료된 작업들도 같이 보여지게 하고 싶어.
> 검색영역에는 체크박스 - 오늘완료된 작업목록 보기와 달력 이렇게 되면 될 것같아.

요약하면 ① REQUIREMENT가 DONE이 될 때 완료 시각을 저장하고, ② 프로젝트별 "완료된 작업 목록" 페이지를 만들어 ③ 상단 검색영역(체크박스 "오늘 완료" + 기간 달력)으로 조회한다.

## 확정된 결정

- **페이지 범위**: 프로젝트별. 경로 `/project/[id]/completed`. 좌측 네비(`PROJECT_TASK_ITEMS`)에 추가.
- **completedAt 의미**: "마지막 DONE 시각". DONE으로 전환될 때마다 갱신하고, DONE에서 다른 상태로 바뀌면 `null`로 되돌린다.
- **달력 UI**: 네이티브 `<input type="date">` 2개(시작일·종료일). 외부 의존성 없음.
- **체크박스·달력 관계**: 체크박스 ON이면 "오늘"만 표시하고 date input은 비활성(`disabled`)·무시. OFF이면 기간(from~to)으로 조회. 둘 중 하나만 적용된다. 페이지 진입 기본값은 체크박스 ON(오늘).
- **구현 방식**: 서버 컴포넌트 + URL 쿼리 파라미터 필터(A안). 기존 목록 페이지(`table-view`) 패턴과 일관. 별도 API·server action 불필요.

## 데이터 모델

`Node` 모델에 완료 시각 컬럼 추가.

```prisma
model Node {
  // ... 기존 필드
  status      NodeStatus @default(DRAFT)
  completedAt DateTime?  // DONE 전환 시각. DONE이 아니면 null. (03-node.md 추가기능)
  // ...
}
```

- 마이그레이션: `pnpm exec prisma migrate dev --name add-node-completed-at`.
- 기존에 이미 DONE인 노드는 `completedAt`이 `null`로 남는다(과거 전환 시각 미기록). 도메인상 허용.
- `completedAt`은 **version 증가와 무관**. 상태 변경은 version을 증가시키지 않는 기존 정책을 유지한다.

### 상태 변경 로직 (`updateNodeStatus`)

`src/app/project/[id]/node/[nodeId]/actions.ts`의 `updateNodeStatus`를 수정한다. 이미 전환 여부(`current?.status`)를 알고 있으므로 분기만 추가한다.

- 비DONE → DONE: `data: { status, completedAt: new Date() }`
- DONE → 다른 상태: `data: { status, completedAt: null }`
- 변화 없음(DONE→DONE, 비DONE→같은 비DONE): `completedAt`은 건드리지 않음(`data: { status }`)

기존 코드는 `current.status`를 `prisma.node.update` **이전에** 조회한다. 이 순서를 유지하고, `current.status`와 새 `status`를 비교해 `data` 객체를 구성한 뒤 **단일 update 호출**에 `completedAt`을 포함시킨다(추가 조회 금지). DONE 전환 시 기존 `fireCompleteNotifications` 호출 분기는 그대로 둔다.

## 라우팅 & 페이지

### `src/app/project/[id]/completed/page.tsx` (서버 컴포넌트)

- `export const dynamic = "force-dynamic"`.
- 로그인(`getCurrentMember`, 없으면 `/signin`) + 프로젝트 존재(`notFound`) 검증 — 기존 페이지와 동일.
- Next.js 16: `params`·`searchParams` 모두 `Promise`.
- **searchParams 해석**:
  - `today` 파라미터가 있으면(`today=1`) → 오늘 모드. `from`/`to`가 함께 있어도 today가 우선(체크박스 ON이면 date input 무시). 손으로 편집한 URL 방어.
  - `today`/`from`/`to` 모두 없음 → 오늘(체크박스 ON). 기본값.
  - `today`가 없고 `from`/`to`가 있으면 → 기간 검색.
- **날짜 경계(서버 로컬 타임존)**:
  - 오늘: `start = 오늘 00:00:00`, `end = 내일 00:00:00`. `completedAt: { gte: start, lt: end }`.
  - 기간: `from` 당일 00:00 ~ `to`+1일 00:00(즉 `to` 당일 포함). `from`만/`to`만 있는 경우도 한쪽 경계만 적용.
  - 잘못된 날짜 문자열은 무시(해당 경계 미적용).
- **조회**:
  ```
  where: { projectId, level: "REQUIREMENT", status: "DONE", completedAt: { gte, lt } }
  orderBy: { completedAt: "desc" }
  select: { id, name, completedAt, status,
            parent: { select: { name, parent: { select: { name } } } },  // FEATURE → MODULE
            assignees: { select: { member: { select: { id, username } } } } }
  ```
  - `completedAt`이 null인 노드는 `gte`/`lt` 조건으로 자연히 제외된다.
- 결과를 직렬화(`completedAt.toISOString()`, assignees 평탄화)하여 검색폼 + 목록에 전달.

### 좌측 네비 (`src/components/LeftNav.tsx`)

`PROJECT_TASK_ITEMS`에 항목 추가:
```ts
{ segment: "/completed", label: "완료된 작업" }
```

## 컴포넌트 & UI

### `CompletedSearchForm.tsx` (클라이언트 컴포넌트)

- `<form method="get">`로 URL 쿼리를 갱신 → 서버 컴포넌트가 재조회. server action 불필요.
- 구성:
  - 체크박스 "오늘 완료된 작업 보기" (`name="today"`, value `1`).
  - date input 2개: 시작일(`name="from"`)·종료일(`name="to"`), 초기값은 현재 searchParams 반영.
  - 체크박스 ON이면 date input `disabled`(회색). 토글은 클라이언트 상태로 즉시 반영.
  - "검색" 버튼으로 submit.
- 검증: `from > to`이면 submit 막고 안내 문구. 체크박스 ON이면 `from`/`to`를 쿼리에서 제외(today=1만), OFF이면 today를 제외.

### 목록 (서버 컴포넌트에서 직접 렌더)

- 행/카드 리스트. 각 항목:
  - 요구사항 이름(상세 링크 `/project/[id]/node/[nodeId]`)
  - 소속 경로: `모듈명 > 기능명`(parent 체인에서 도출)
  - 완료 시각 `YYYY-MM-DD HH:mm`
  - 담당자(있으면 username 목록)
- 헤더: 현재 필터 요약("오늘 완료" 또는 "2026-06-01 ~ 2026-06-07") + 건수.
- 비어 있으면 "완료된 작업이 없습니다." 안내.
- 스타일: `p-8`, zinc 팔레트, 다크모드 클래스 — 기존 `table-view/page.tsx` 패턴 준수.

## 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `prisma/schema.prisma` | `Node.completedAt DateTime?` 추가 |
| `prisma/migrations/.../migration.sql` | 마이그레이션 생성 |
| `src/app/project/[id]/node/[nodeId]/actions.ts` | `updateNodeStatus`에 completedAt 분기 |
| `src/app/project/[id]/completed/page.tsx` | 신규 (서버 컴포넌트) |
| `src/app/project/[id]/completed/CompletedSearchForm.tsx` | 신규 (검색영역) |
| `src/components/LeftNav.tsx` | 네비 항목 "완료된 작업" 추가 |
| `docs/domain/03-node.md` | 구현 완료 기록 추가 |

## 비범위 (YAGNI)

- 전역(모든 프로젝트) 완료 목록 뷰.
- 완료 시각의 전체 이력(audit log) — "마지막 DONE 시각" 단일 값만 저장.
- CSV/엑셀 내보내기, 페이지네이션(현재 데이터 규모상 불필요).
- REQUIREMENT 외 레벨의 완료 시각.
- 다중 사용자/원격 타임존 정확성. "오늘"·기간 경계는 서버 로컬 타임존 단일 기준으로만 계산한다.

## 구현 참고

- `/completed` 페이지는 `force-dynamic`이므로 매 요청 재조회된다. 따라서 `updateNodeStatus`에서 `/completed` 경로에 대한 `revalidatePath`는 **불필요**(추가하지 않는다).
