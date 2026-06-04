---
version: "1.0"
created: "2026-06-04"
updated: "2026-06-04"
author: "arahansa"
---

# TableView "진행중만 보기" 필터 설계

## 배경 / 목적

`/project/[id]/table-view`는 MODULE→FEATURE→REQUIREMENT 3단계 트리를 표로 보여준다.
요구사항(REQUIREMENT)에는 상태(`DRAFT`/`IN_PROGRESS`/`DONE`)가 있다.

작업 중인 항목만 빠르게 보고 싶을 때를 위해, 모듈 멀티셀렉트 필터 옆에
**"진행중만 보기" 체크박스**를 추가한다. 체크하면 `IN_PROGRESS` 요구사항과
그 상위 기능·모듈만 표에 남긴다.

## 동작 정의

체크박스가 켜지면(`inProgressOnly = true`):

1. **요구사항**: `status === "IN_PROGRESS"`인 것만 표시.
2. **기능(FEATURE)**: 진행중 요구사항이 하나도 없는 기능은 **아예 숨긴다**.
3. **모듈(MODULE)**: 진행중 요구사항을 가진 기능이 하나도 없는 모듈은 **아예 숨긴다**.
4. **추가 affordance**: `+ 기능 추가` / `+ 요구사항 추가` 버튼과 빈 플레이스홀더
   (`요구사항 없음` / `기능 없음`) 행은 **모두 숨긴다**. 진행중만 보기는 조회/검토
   모드이며, 편집(추가)은 체크 해제 후에 한다.

체크가 꺼지면 기존 동작 그대로(전체 트리 + 추가 버튼).

### 모듈 멀티셀렉트와의 합성

기존 모듈 멀티셀렉트 필터와 **AND**로 합성한다. 즉 "멀티셀렉트로 선택된 모듈" 중
"진행중 요구사항이 있는 모듈"만 남는다. 적용 순서는 멀티셀렉트 → 진행중 필터.

## 상태 관리

화면 상태로만 둔다(서버/URL에 유지하지 않음). 기존 모듈 멀티셀렉트와 동일하게
`useState`로 관리하며, 새로고침/이동 시 초기화(체크 해제)된다.

```ts
const [inProgressOnly, setInProgressOnly] = useState(false);
```

## 구현 (NodeEditor.tsx 단일 파일)

서버/DB/액션 변경은 없다. `page.tsx`가 이미 REQUIREMENT의 `status`를
조회·직렬화해 `ReqNode.status`로 넘기고 있으므로, 클라이언트에서 거르기만 하면 된다.

### 1) 트리 가지치기(prune)

기존 `visibleModules`(모듈 멀티셀렉트 적용 결과)를 한 번 더 변환한다.

```ts
function pruneInProgress(modules: ModuleNode[]): ModuleNode[] {
  return modules
    .map((m) => ({
      ...m,
      children: m.children
        .map((f) => ({
          ...f,
          children: f.children.filter((r) => r.status === "IN_PROGRESS"),
        }))
        .filter((f) => f.children.length > 0), // 진행중 요구사항 없는 기능 제거
    }))
    .filter((m) => m.children.length > 0); // 진행중 기능 없는 모듈 제거
}

const displayModules = inProgressOnly
  ? pruneInProgress(visibleModules)
  : visibleModules;
```

`buildRows`에는 `displayModules`를 넘긴다.

### 2) 추가 버튼·빈 행 숨김

`buildRows`에 옵션 플래그를 추가한다.

```ts
function buildRows(
  modules: ModuleNode[],
  hideAffordances = false,
): Row[]
```

`hideAffordances === true`이면:
- `feat-add`, `req-add` 행을 push하지 않는다.
- 가지치기로 빈 기능/모듈은 이미 제거되었으므로 `mod-empty`/`req-empty`도 발생하지
  않는다(자식이 항상 1개 이상). 방어적으로 빈 분기도 push하지 않는다.

호출: `buildRows(displayModules, inProgressOnly)`.

### 3) 체크박스 UI

상단 필터 줄(`<div className="mb-3 flex items-center gap-3">`)에서
`ModuleFilter` 옆에 체크박스를 둔다. 라벨 "진행중만".

```tsx
<label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
  <input
    type="checkbox"
    checked={inProgressOnly}
    onChange={(e) => setInProgressOnly(e.target.checked)}
  />
  진행중만
</label>
```

### 빈 결과 처리

필터 결과 `displayModules`가 비면(진행중 요구사항이 전혀 없음), 기존
"선택된 모듈이 없습니다" 분기와 구분되는 안내를 보여준다. 표 영역 렌더 조건을
`displayModules.length === 0`까지 포함하도록 확장하고, 진행중 필터로 비었을 때는
"진행중인 요구사항이 없습니다." 안내를 표시한다.

## 영향 범위

- `src/app/project/[id]/table-view/NodeEditor.tsx` — 체크박스, 상태,
  `pruneInProgress`, `buildRows` 플래그, 빈 결과 안내.

서버 액션·Prisma 스키마·page.tsx·NodeDetailPanel은 변경하지 않는다.

## 검증

- `tsc --noEmit` 통과, dev 서버 정상 컴파일.
- 수동: 진행중 요구사항이 섞인 프로젝트에서 체크 on/off 시
  (a) 진행중 요구사항만 남는지, (b) 진행중 없는 기능/모듈이 사라지는지,
  (c) 추가 버튼이 사라지는지, (d) 모듈 멀티셀렉트와 AND로 합성되는지,
  (e) 진행중이 전혀 없을 때 안내 문구가 뜨는지.

## 산출 코드

- `src/app/project/[id]/table-view/NodeEditor.tsx`
