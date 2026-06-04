---
version: "1.1"
created: "2026-05-30"
updated: "2026-06-04"
author: "arahansa"
---

# 개요
태그(Tag) : 각 기능에 걸쳐 로깅이나 보안같은 부분들을 구현하기 위한 횡단 관심사를 나타내기 위함 

# 태그(Tag) 테이블 설계
id: primary key, auto increment
name: 태그 이름 (varchar 255)
project_id : 노드가 속한 프로젝트의 id (number)

# 연관 테이블 - tag_node
id: primary key, auto increment
tag_id: 태그의 id (number)
node_id: 노드의 id (number)

# 편집되는 부분
FEATURE나 REQUIREMENT 노드 상세보기에서 태그를 입력할 수 있다. 여러개를 입력할 수 있다.

## 구현 완료 (2026-06-04)

- **스키마**: `Tag`(`projectId`+`name` 유니크, `@@map("tag")`) + `NodeTag`(다대다, `@@map("node_tag")`). 노드 레벨과 무관하므로 마이그레이션 변경 없음.
- **부여 범위**: FEATURE·REQUIREMENT 노드 상세 패널에서 입력. `@`로 하나씩 입력하며, 없는 태그는 프로젝트 스코프로 신규 생성, 있는 태그는 자동완성 펼침목록에서 선택.
- **동기화**: `setNodeTags(nodeId, names)` Server Action이 입력 목록에 맞춰 연결을 재설정한다(정규화·대소문자 중복 제거, 빠진 연결 해제). 태그 마스터(Tag)는 다른 노드가 참조할 수 있어 삭제하지 않는다.

### 산출 코드
- `prisma/schema.prisma` — `Tag`, `NodeTag` 모델
- `src/app/project/[id]/table-view/actions.ts` — `setNodeTags`(FEATURE·REQUIREMENT), `listProjectTags`
- `src/app/project/[id]/table-view/NodeDetailPanel.tsx` — FEATURE·REQUIREMENT 태그 입력 UI
- `src/app/project/[id]/table-view/TagInput.tsx` — `@` 태그 입력·자동완성
- `src/app/project/[id]/table-view/page.tsx`, `NodeEditor.tsx` — 조회·표시 연동

