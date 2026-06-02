---
version: "1.2"
created: "2026-06-01"
updated: "2026-06-02"
author: "arahansa"
---

# 관리자(SUPER) 인 경우 나타나는 좌측 네비게이션
로그인한 MEMBER의 등급이 SUPER인 경우, 아래 컨텐츠 영역을 좌우로 나눠서 좌측에 sub navigation 메뉴들이 나타난다.
어드민 /admin 페이지 하위로 나타나는 경우를 말한다.
- 프로젝트 관리 : /admin/projects
- 회원 관리 : /admin/members

# 일반 경로에서의 좌측 네비게이션

## 프로젝트가 선택되지 않은 경우
- 프로젝트 목록(문서: `../domain/01-project.md`)을 나타낸다.
- 프로젝트 하나를 클릭하면 프로젝트를 선택하게 된다. (path: `/project/{id}` 이동)

## 프로젝트가 선택된 경우
- 프로젝트 이름을 클릭하면 해당 프로젝트에서 작업할 수 있는 영역(`/project/{id}`)으로 이동된다.
- 프로젝트 내에서 할 수 있는 작업들은 다음과 같다. 
  - TableView (`/project/{id}/table-view`)

## 펼침·접힘 (v1.2)
- 좌측 네비게이션 전체를 펼치거나 접을 수 있다.
  - **펼침**: 프로젝트 목록·작업 메뉴가 보이는 기본 상태. 헤더에 접기 버튼(`«`).
  - **접힘**: 얇은 바에 펼치기 버튼(`»`)만 노출해 본문 영역을 넓힌다.
- 접힘 상태는 `localStorage`(키: `coworks.leftnav.collapsed`)에 저장되어 새로고침·경로 이동 후에도 유지된다.
- 산출 코드: `src/components/LeftNav.tsx`

