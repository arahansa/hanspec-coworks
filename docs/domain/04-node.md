---
version: "1.1"
created: "2026-05-30"
updated: "2026-05-30"
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

### 구현 단계
- 1단계(현재): Node 테이블 전체 구조를 만들되, 노드 편집기는 **MODULE 레벨**(`level=MODULE`, `parentId=null`)의 생성·조회·수정·삭제만 구현한다.
- 이후 단계에서 FEATURE / REQUIREMENT 레벨과 자식 노드, 태그, TASK로 확장한다.

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

