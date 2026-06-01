---
version: "1.4"
created: "2026-05-30"
updated: "2026-06-02"
author: "arahansa"
---

# 개요
노드(Node) : 프로젝트에서 나타나지는 작업의 단위

# 노드(Node) 테이블 설계
id: 멤버의 고유 식별자(숫자) auto increment
name : 노드 이름(varchar 255)
level : 노드 레벨 (varchar 20)(ENUM) - 아래에 설명
description : 노드 설명 (text)
parent_id : 상위 노드의 id (number)
project_id : 노드가 속한 프로젝트의 id (number)
version : 버전 (number)

## Prisma 모델 설계
위 테이블을 Prisma로 구현한 설계는 다음과 같다. (`prisma/schema.prisma`)

```prisma
enum NodeLevel {
  MODULE
  FEATURE
  REQUIREMENT
}

model Node {
  id          Int       @id @default(autoincrement())
  name        String    @db.VarChar(255)
  level       NodeLevel
  description String?   @db.Text
  parentId    Int? // self-ref. 최상위(MODULE)는 null
  projectId   Int
  version     Int       @default(1)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  parent   Node?   @relation("NodeChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children Node[]  @relation("NodeChildren")
  project  Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

- **parent_id (self-reference)**: 노드는 자기 자신을 부모로 참조하는 트리 구조다. 최상위 MODULE 노드는 `parentId`가 `null`이다.
- **삭제 정책 (`onDelete: Cascade`)**: 노드를 삭제하면 그 하위 노드도 함께 삭제된다. 프로젝트가 삭제되면 해당 프로젝트의 모든 노드가 삭제된다.
- **version**: 기본값 1. 노드의 `name`/`description`을 **수정할 때마다 1씩 증가**한다.
- Project 모델에는 역관계 `nodes Node[]`를 추가한다.

### 계층 규칙 (편집기)
- **MODULE**: 최상위 노드(`parentId=null`). 프로젝트에 직접 속한다.
- **FEATURE**: MODULE의 자식. MODULE 하위에만 만들 수 있다.
- **REQUIREMENT**: FEATURE의 자식. FEATURE 하위에만 만들 수 있으며 자식 노드를 가질 수 없다(TASK는 추후).
- 노드 수정 시(이름) `version`을 1 증가시킨다. (모든 레벨 공통)
- 노드 삭제 시 하위 노드는 `onDelete: Cascade`로 함께 삭제된다.

### 편집기 UI (매트릭스 테이블)
- 화면은 **모듈 | 기능 | 요구사항** 3열 테이블이다.
- 같은 상위에 속한 하위 노드가 여러 개면 상위 셀을 `rowSpan`으로 세로 병합한다(스프레드시트 형태).
- 각 셀은 이름을 **인라인 편집**하며, 셀을 벗어날 때(blur) 변경분을 자동 저장한다(`version+1`).
- 하위가 없는 셀은 "기능 없음 / 요구사항 없음"으로 표시하고, 각 칸 하단에 "+ 추가" 행을 둔다.
- 설명·버전은 별도 열로 노출하지 않는다(이름 중심).

### 구현 단계
- 1단계: Node 테이블 전체 구조 + **MODULE** 레벨.
- 2단계: **FEATURE** 레벨 추가.
- 3단계(현재): **REQUIREMENT** 레벨 추가 + 매트릭스 테이블 UI 전환.
- 이후 단계에서 태그, TASK로 확장한다.

# 관련문서
- [프로젝트](./01-project.md)

# NODE LEVEL(ENUM)
- MODULE : 모듈
- FEATURE : 기능
- REQUIREMENT : 요구사항

# 기능
## 노드 생성
- 최상위 노드는 MODULE 로만 만들 수 있습니다.
- 노드는 자식노드를 만들 수 있습니다.
- REQUIREMENT 노드는 자식노드를 만들 수 없으며 TASK를 만들 수 있습니다.

## 태그 붙이기
- 노드에 태그(`./05-tag.md`)를 붙이거나 삭제할 수 있습니다. (태그는 여러개 붙일 수 있음)

# 추가요청
- 특정 노드에 대하여 상태를 변경할 수 있습니다. 주로 REQUIREMENT 레벨 노드에서 상태 변경을 할 수 있습니다.
- 상태는 다음과 같이 있습니다.

```
초안
진행중
완료
```

## 추가요청2 담당자 지정 가능
하나의 노드당 여러 명의 담당자를 지정할 수 있습니다. 우선 REQUIREMENT만 지정할 수 있도록 합니다. 
필요하다면 테이블을 알아서 만들어주고, REQUIREMENT 상세보기에서 담당자를 @를 통해서 지정할 수 있도록 해주세요
필요하다면 ./02-member.md 의 사용자 목록을 불러오는 API 도 만들어주세오ㅛ 

### 구현 완료 (2026-06-02)
추가요청1·2를 모두 구현했다. 설계: `docs/superpowers/specs/2026-06-02-node-status-assignee-design.md`.

- **상태**: `Node.status`(`NodeStatus` enum: `DRAFT`/`IN_PROGRESS`/`DONE`, 기본 `DRAFT`) 컬럼 추가. REQUIREMENT 상세에서만 변경. 상태 변경은 `version`을 증가시키지 않는다(이름/설명 수정만 version+1).
- **담당자**: `node_assignee` 조인 테이블(복합 PK `(nodeId, memberId)`)로 한 REQUIREMENT에 여러 담당자 지정. 상세에서 `@` 검색 자동완성으로 추가/제거.
- **멤버 API**: `GET /api/members?q=<prefix>` — username prefix(대소문자 무시) 검색, 비로그인 401. 비밀번호 등 민감 필드 미반환.
- **산출 코드**: `prisma/schema.prisma`(NodeStatus·Node.status·NodeAssignee), `src/app/api/members/route.ts`, `src/app/project/[id]/node/[nodeId]/{actions.ts,StatusSection.tsx,AssigneeSection.tsx,node-status.ts,page.tsx}`.

