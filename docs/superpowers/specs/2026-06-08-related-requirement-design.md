---
version: "1.0"
created: "2026-06-08"
updated: "2026-06-08"
author: "arahansa"
---

# 관련 요구사항(Related Requirements) 설계

## 배경

요구사항(REQUIREMENT) 상세를 볼 때, 본질적으로 연관된 다른 요구사항을 함께 탐색하고 싶다는
요구가 있다. 본문에 `#id` 인라인 링크를 적는 방식과, 명시적 관계 테이블을 두는 방식을 비교했다.

- **인라인 링크(`#id`)**: 본문 텍스트가 관계의 SSOT가 되어 백링크(양방향)를 얻으려면 모든
  노드 본문을 파싱해야 하고, 노드 삭제/이동 시 깨진 링크가 본문에 남는다. 관계에 메타데이터를
  붙일 자리도 없다.
- **관계 테이블**: 기존 `NodeAssignee`·`NodeTag` 조인 패턴과 동형. 양방향 조회·삭제 정합성·
  차후 type 확장이 모두 자연스럽다. coworks는 **DB가 SSOT**(CLAUDE.md)이므로 이 방식이 철학에
  더 부합한다.

→ **관계 테이블 방식을 채택한다.**

> standalone(MD 파일) 쪽은 위키링크(`[[...]]`) 철학(website-docs decision 18)을 따르지만,
> coworks는 DB SSOT라는 다른 전제이므로 별도로 관계를 테이블로 둔다.

## 결정 사항

| 항목 | 결정 |
|------|------|
| 관계 유형 | 단순 "관련"만. type 컬럼 없음(차후 확장 여지만 남김) |
| 방향성 | 무방향. 한 행으로 양쪽 상세에서 모두 보임 |
| 입력 방식 | 전용 UI 섹션(`AssigneeSection` 패턴 재사용) |
| 연결 범위 | 같은 프로젝트 내 REQUIREMENT끼리만 |

## 데이터 모델

기존 `NodeAssignee`와 동형의 자기참조 다대다 조인. **무방향을 한 행으로** 표현하기 위해
항상 `nodeAId < nodeBId`로 정규화하여 저장한다(`(1,2)`와 `(2,1)` 중복 방지, `@@id`가 중복 차단).

```prisma
/// 요구사항 간 "관련" 연결. 무방향 — 항상 nodeAId < nodeBId로 정규화 저장하여
/// 한 행으로 양쪽에서 보인다. 우선 같은 프로젝트의 REQUIREMENT끼리만 연결.
/// 관계 종류 구분은 차후 type 컬럼으로 확장.
model NodeRelation {
  nodeAId   Int
  nodeBId   Int
  createdAt DateTime @default(now())

  nodeA Node @relation("RelationA", fields: [nodeAId], references: [id], onDelete: Cascade)
  nodeB Node @relation("RelationB", fields: [nodeBId], references: [id], onDelete: Cascade)

  @@id([nodeAId, nodeBId])
  @@index([nodeBId])
  @@map("node_relation")
}
```

Node 모델에 역관계 두 개(`relationsA`, `relationsB`)를 추가한다.

양쪽 조회: `WHERE nodeAId = ? OR nodeBId = ?` 한 번으로 상대 노드 집합을 얻는다.

## 서버 액션 (`node/[nodeId]/actions.ts`)

`requireRequirementNode` 헬퍼·`revalidatePath` 규칙을 그대로 재사용한다.

- `addRelation(nodeId, otherId)`:
  - 두 노드 모두 REQUIREMENT, 같은 프로젝트, 자기 자신 아님 검증.
  - `[a, b] = nodeId < otherId ? [nodeId, otherId] : [otherId, nodeId]`로 정규화.
  - 복합키 `upsert`로 멱등 처리(중복 추가 무시).
  - 양쪽 상세 경로 revalidate.
- `removeRelation(nodeId, otherId)`:
  - 정규화 후 `delete`. 없으면(P2025) 무시.
  - 양쪽 상세 경로 revalidate.

## 후보 검색 API (`/api/related-requirements`)

`/api/members` 패턴을 따른다.

- `GET /api/related-requirements?nodeId=<id>&q=<prefix>`
- 로그인 검증. nodeId의 projectId를 구해, 같은 프로젝트의 REQUIREMENT 중 name이 q를 포함
  (대소문자 무시)하는 노드를 최대 10개. 자기 자신·이미 연결된 노드는 호출 측에서 제외.
- 반환: `{ ok: true, candidates: [{ id, name }] }`

## UI (`RelatedRequirementSection.tsx`)

`AssigneeSection`을 본떠 작성한다.

- 헤더 "관련 요구사항 (N)"
- 연결된 요구사항 목록: 각 항목은 상세 페이지로 가는 `Link`(`/project/{projectId}/node/{id}`)
  + 제거(✕) 버튼.
- 입력: name 검색 → 자동완성 드롭다운에서 선택해 `addRelation`.
  - 드롭다운은 섹션 위치상 잘릴 수 있으므로 `AssigneeSection`과 동일하게 처리(필요 시 방향 조정).

## 데이터 연결

- `lib/requirement-detail.ts`: `loadRequirementDetail`에 `relationsA`/`relationsB`를 select하고,
  상대 노드를 `related: { id, name }[]`로 평탄화. `projectId`도 데이터에 포함(링크 생성용).
- `RequirementDetailBody`: `RequirementDetailData`에 `projectId`, `related` 추가, 섹션 렌더.
- 상세 페이지·모달은 같은 본문을 공유하므로 자동 반영.
- 테이블뷰 패널(`NodeDetailPanel`)은 이번 범위에서 제외(데이터 로딩 경로가 다르고 경량 패널 유지).

## 비범위(차후)

- 관계 type 구분(의존/중복/차단 등)
- 본문 인라인 `[[#id]]` 문법
- 크로스 프로젝트 연결
- 테이블뷰 패널 내 관련 요구사항 표시
