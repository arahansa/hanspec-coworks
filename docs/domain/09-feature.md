---
version: "1.1"
created: "2026-06-02"
updated: "2026-06-02"
author: "arahansa"
---

# 개요

이 파일은 `./03-node.md` 에서 FEATURE에 해당하는 Node 들에 대한 내용을 다룬다. 

# 추가 필드
- Node는 ENDPOINT를 가질 수 있다. 문자열 255자까지 허용
- 테이블뷰에서 FEATURE 노드에서 ENDPOINT 정보가 있는 경우 노출된다.
- FEATURE 상세보기에서 ENDPOINT를 적을 수 있다.
- FEATURE 상세보기에서 TAG를 적을 수 있다. TAG도 @를 통해서 하나하나씩 입력 가능하다. 없는 것을 새로 넣으면 신규로 TAG가 입력되고 있는 TAG를 입력하면 기존태그 펼침목록에서 선택되서 입력된다.

## 구현 완료 (2026-06-02)

- **ENDPOINT**: `Node.endpoint`(`VarChar(255)`, nullable) 컬럼 추가. FEATURE 상세에서만 입력하며, 테이블뷰 FEATURE 셀에 값이 있을 때 노출.
- **TAG**: 프로젝트 스코프 `Tag` 모델 + `NodeTag` 조인(다대다). 자동완성 펼침목록은 프로젝트별로 모은다. 우선 FEATURE에만 부여. `@`로 하나씩 입력하며, 없는 태그는 신규 생성·있는 태그는 목록에서 선택.

### 산출 코드
- `prisma/schema.prisma` — `Node.endpoint`, `Tag`, `NodeTag` 모델
- `prisma/migrations/20260602031038_add_endpoint_and_tags/`
- `src/app/project/[id]/table-view/actions.ts` — `updateNode`(endpoint), `listProjectTags`, `setFeatureTags`
- `src/app/project/[id]/table-view/NodeDetailPanel.tsx` — FEATURE ENDPOINT·TAG 입력 UI
- `src/app/project/[id]/table-view/TagInput.tsx` — `@` 태그 입력·자동완성 컴포넌트
- `src/app/project/[id]/table-view/NodeEditor.tsx`, `page.tsx` — 조회·표시 연동
