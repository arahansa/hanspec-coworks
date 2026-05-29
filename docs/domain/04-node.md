---
version: "1.2"
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

### 계층 규칙 (편집기)
- **MODULE**: 최상위 노드(`parentId=null`). 프로젝트에 직접 속한다.
- **FEATURE**: MODULE의 자식(`parentId=<모듈 id>`). MODULE 하위에만 만들 수 있다.
- 노드 수정 시(이름·설명) `version`을 1 증가시킨다. (MODULE/FEATURE 공통)
- 노드 삭제 시 하위 노드는 `onDelete: Cascade`로 함께 삭제된다.

### 구현 단계
- 1단계: Node 테이블 전체 구조 + **MODULE** 레벨 CRUD.
- 2단계(현재): **FEATURE** 레벨 추가. 좌측 트리에서 MODULE 아래 FEATURE를 펼침·접힘으로 표시하고, MODULE/FEATURE 공통 우측 패널에서 편집한다.
- 이후 단계에서 REQUIREMENT 레벨과 태그, TASK로 확장한다.

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

