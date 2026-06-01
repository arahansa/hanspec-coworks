---
version: "1.0"
created: "2026-06-01"
updated: "2026-06-01"
author: "arahansa"
---

# 요구사항 상세 페이지 + Task 관리 설계

## 배경

TableView(node-mode)에서 요구사항(REQUIREMENT 노드)을 클릭하면 우측 사이드바
(`NodeDetailPanel`)에 상세 정보가 나타난다. 여기서 요구사항의 **세부 페이지**로
진입할 수 있게 하고, 그 페이지에서 요구사항에 속한 **Task**를 생성·조회한다.

참조:
- `docs/domain/06-task.md` — Task 테이블 설계
- `docs/domain/03-node.md` — Node 도메인

## 범위

1. **상세 아이콘** — 사이드바 X 버튼 좌측에 상세 아이콘 추가. **REQUIREMENT 레벨에만** 노출.
   클릭 시 요구사항 상세 페이지로 이동.
2. **요구사항 상세 페이지** — 신규 라우트 `/project/[id]/node/[nodeId]`.
   요구사항 정보 + 소속 Task 목록 + 인라인 생성 폼.
3. **Task 모델** — Prisma schema에 추가 + 마이그레이션.

## 데이터 모델

`docs/domain/06-task.md` 설계를 따르고 타임스탬프를 추가한다.

```prisma
model Task {
  id          Int      @id @default(autoincrement())
  progress    Int      @default(0)   // 진행도 (0~100)
  description String   @db.Text       // 작업 설명
  nodeId      Int                     // 소속 REQUIREMENT 노드
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  node        Node     @relation(fields: [nodeId], references: [id], onDelete: Cascade)
}
```

`Node` 모델에 역참조 `tasks Task[]` 추가. 노드 삭제 시 Task는 Cascade 삭제.

마이그레이션: `pnpm exec prisma migrate dev --name add_task`.

## 컴포넌트 & 라우트

| 경로 | 종류 | 책임 |
|------|------|------|
| `src/app/project/[id]/node/[nodeId]/page.tsx` | server | 노드+Task 조회, 접근 검증, 레이아웃 |
| `src/app/project/[id]/node/[nodeId]/TaskSection.tsx` | client | Task 목록 렌더 + 인라인 생성 폼 |
| `src/app/project/[id]/node/[nodeId]/actions.ts` | server | `createTask` server action |
| `src/app/project/[id]/node-mode/NodeDetailPanel.tsx` | client(수정) | REQUIREMENT일 때 상세 아이콘 노출, projectId prop 추가 |
| `src/app/project/[id]/node-mode/NodeEditor.tsx` | client(수정) | NodeDetailPanel에 projectId 전달, 상세 이동 핸들러 |

### 상세 아이콘 동작
- `NodeDetailPanel`은 `projectId`와 `onNavigateDetail`(또는 직접 링크)을 받는다.
- `node.level === "REQUIREMENT"`일 때만 아이콘 렌더.
- 클릭 → `/project/{projectId}/node/{nodeId}` 이동(`next/navigation` router.push 또는 Link).

### 상세 페이지
- 로그인 + 프로젝트/노드 존재 검증(기존 `assertAccess` 패턴 재사용).
- 노드가 REQUIREMENT가 아니면 안내 메시지(또는 node-mode로 돌아가기 링크).
- 상단: 요구사항 이름, `#id`, 설명.
- 하단: `TaskSection` — Task 목록(progress, description) + 인라인 폼.

### createTask action
```ts
createTask(nodeId: number, description: string, progress: number): Promise<TaskActionResult>
```
- 노드 존재 + REQUIREMENT 검증, 접근 검증.
- description 필수, progress 0~100 범위 검증(기본 0).
- 생성 후 `revalidatePath(/project/{id}/node/{nodeId})`.

## 데이터 흐름

```
TableView 사이드바 → 상세 아이콘 클릭
  → /project/[id]/node/[nodeId] (server fetch: node + tasks)
  → TaskSection 인라인 폼 제출
  → createTask server action
  → revalidatePath → Task 목록 갱신
```

## 에러 처리
- 미로그인 → `/signin` 리다이렉트.
- 존재하지 않는 노드/프로젝트 → 안내 메시지.
- REQUIREMENT 아님 → 상세 페이지에서 Task 영역 숨기고 안내.
- description 공백 → 폼 검증 에러 표시.

## 비범위 (YAGNI)
- Task 수정/삭제/진행도 슬라이더 등은 이번 범위 밖(추후).
- 모듈·기능 레벨 상세 페이지는 만들지 않는다(상세 아이콘은 REQUIREMENT 전용).
