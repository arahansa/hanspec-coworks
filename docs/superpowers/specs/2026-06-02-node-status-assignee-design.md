---
version: "1.0"
created: "2026-06-02"
updated: "2026-06-02"
author: "arahansa"
---

# 노드 상태 + 담당자 지정 설계 (03-node.md 추가요청 1·2)

## 배경

`docs/domain/03-node.md`의 "# 추가요청"(89행) 이후 두 가지 요구사항을 구현한다.

1. **추가요청1 — 노드 상태**: 노드 상태를 변경할 수 있다. 주로 REQUIREMENT
   레벨에서 변경한다. 상태는 `초안 / 진행중 / 완료`.
2. **추가요청2 — 담당자 지정**: 한 노드에 여러 담당자를 지정할 수 있다. 우선
   REQUIREMENT만 지정 가능. REQUIREMENT 상세보기에서 `@`로 지정한다. 필요하면
   `02-member.md`의 사용자 목록 API도 만든다.

참조:
- `docs/domain/03-node.md` — 노드 도메인 + 추가요청
- `docs/domain/02-member.md` — 멤버
- `docs/superpowers/specs/2026-06-01-requirement-detail-task-design.md` — 기존 상세 페이지

## 결정 사항 (확정)

- **상태 범위**: REQUIREMENT 노드에서만 변경(문서 "주로 REQUIREMENT"에 맞춤).
- **상태 저장**: 별도 이력 테이블 없이 `Node.status` enum 컬럼. 기본값 `DRAFT`(초안).
- **담당자 범위**: 우선 REQUIREMENT만 지정.
- **담당자 후보**: 전체 멤버. `@` 입력 시 username으로 검색.

## 범위

1. **`NodeStatus` enum + `Node.status` 컬럼** + **`NodeAssignee` 조인 테이블** (Prisma + 마이그레이션).
2. **Server Actions**: 상태 변경 / 담당자 추가 / 담당자 제거.
3. **멤버 목록 API**: `GET /api/members` (검색 지원).
4. **UI**: REQUIREMENT 상세 페이지에 상태 섹션 + 담당자 섹션.

## 데이터 모델

```prisma
/// 노드 상태. 주로 REQUIREMENT에서 사용. (03-node.md 추가요청1)
enum NodeStatus {
  DRAFT // 초안
  IN_PROGRESS // 진행중
  DONE // 완료
}

model Node {
  // ...기존 필드 유지
  status    NodeStatus @default(DRAFT)
  assignees NodeAssignee[]
}

/// 노드-담당자 다대다 조인. 우선 REQUIREMENT에만 지정. (03-node.md 추가요청2)
model NodeAssignee {
  nodeId     Int
  memberId   Int
  assignedAt DateTime @default(now())

  node   Node   @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  member Member @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@id([nodeId, memberId])
  @@map("node_assignee")
}
```

- `Member`에 역참조 `assignedNodes NodeAssignee[]` 추가.
- 복합 PK `(nodeId, memberId)`로 동일 멤버 중복 지정을 DB 레벨에서 방지.
- `onDelete: Cascade` — 노드/멤버 삭제 시 매핑도 삭제.

## Server Actions (`src/app/project/[id]/node/[nodeId]/actions.ts`에 추가)

기존 `createTask`의 `{ ok, error }` 결과 패턴과 REQUIREMENT 검증을 재사용한다.
공통 검증(로그인 + 노드 존재 + REQUIREMENT)은 작은 헬퍼로 묶는다.

- `updateNodeStatus(nodeId, status): Promise<NodeActionResult>`
  - status가 `NodeStatus` 값인지 검증. REQUIREMENT 검증. `prisma.node.update`.
  - 주의: 상태 변경은 도메인상 `version` 증가 대상이 아니다(이름/설명 수정만 version+1).
- `addAssignee(nodeId, memberId): Promise<NodeActionResult>`
  - 멤버 존재 검증. REQUIREMENT 검증. `upsert`(복합키)로 멱등 추가.
- `removeAssignee(nodeId, memberId): Promise<NodeActionResult>`
  - `delete`(복합키). 없으면 무시(P2025 catch).
- 모두 성공 시 `revalidatePath(/project/{projectId}/node/{nodeId})`.

```ts
export type NodeActionResult = { ok: true } | { ok: false; error: string };
```

## 멤버 목록 API (`src/app/api/members/route.ts`)

`02-member.md`가 요청한 사용자 목록 API. Route Handler.

- `GET /api/members?q=<prefix>`: 로그인(`getCurrentMember`) 검증 후, 전체 멤버에서
  `username`이 `q`로 시작하는(대소문자 무시) 멤버 `{ id, username }`를 최대 10명
  반환. `q`가 비면 상위 10명.
- 비로그인 시 401.
- 비밀번호 등 민감 필드는 절대 select 하지 않는다.

## UI (REQUIREMENT 상세 페이지)

`src/app/project/[id]/node/[nodeId]/page.tsx`의 node 조회에 `status`,
`assignees: { member: { id, username } }`를 추가하고, 아래 두 Client 섹션을
TaskSection 위/아래 적절한 위치에 렌더한다.

### StatusSection (Client)
- 현재 상태를 배지로 표시(라벨: 초안/진행중/완료, 상태별 색).
- 3개 상태 세그먼트 버튼. 클릭 시 `updateNodeStatus` 호출 → `router.refresh()`.
- 진행 중 비활성화, 실패 시 에러 메시지.

### AssigneeSection (Client)
- 현재 담당자 칩 목록(`@username` + ✕ 제거 버튼). 제거 시 `removeAssignee`.
- `@` 입력란: 입력 시 `/api/members?q=`를 디바운스 호출해 자동완성 후보를 띄우고,
  선택하면 `addAssignee` 호출. 이미 지정된 멤버는 후보에서 제외/무시.
- 진행 중 비활성화, 실패 시 에러 메시지.

상태 라벨·색 매핑은 한 곳(상수)에서 관리해 StatusSection과 배지가 공유한다.

## 마이그레이션

```bash
pnpm exec prisma migrate dev --name add_node_status_and_assignee
```

`Node.status` 컬럼(기본 DRAFT) + `node_assignee` 테이블 생성. 대상 DB는 원격
Supabase이며 컬럼/테이블 추가만 하므로 기존 데이터 손실은 없다. 기존 행의 status는
기본값 DRAFT로 채워진다.

## 테스트·검증

이 프로젝트는 테스트 프레임워크가 없으므로 `pnpm exec tsc --noEmit` + dev 서버
수동 검증으로 확인한다.

- 마이그레이션 후 Prisma client 재생성 확인(`NodeAssignee.ts`, `Node`에 status).
- REQUIREMENT 상세에서: 상태 3종 전환 / 담당자 `@`검색·추가·중복방지·제거.
- `GET /api/members?q=` 응답 형식·검색·401 확인.
- 비REQUIREMENT 노드에서 status/assignee 액션이 거부되는지(검증) 확인.

## 산출 코드 (예정)

- `prisma/schema.prisma` — NodeStatus enum, Node.status/assignees, NodeAssignee, Member.assignedNodes
- `prisma/migrations/*_add_node_status_and_assignee/migration.sql`
- `src/app/api/members/route.ts`
- `src/app/project/[id]/node/[nodeId]/actions.ts` (액션 추가)
- `src/app/project/[id]/node/[nodeId]/StatusSection.tsx`
- `src/app/project/[id]/node/[nodeId]/AssigneeSection.tsx`
- `src/app/project/[id]/node/[nodeId]/node-status.ts` (상태 라벨·색 상수, 공유)
- `src/app/project/[id]/node/[nodeId]/page.tsx` (수정)
