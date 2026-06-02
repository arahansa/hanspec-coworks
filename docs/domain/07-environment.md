---
version: "1.1"
created: "2026-06-02"
updated: "2026-06-02"
author: "arahansa"
---

프로젝트 관리 메뉴에서
테이블뷰 아래에 "환경변수 관리" 페이지 추가하고, 각 프로젝트별로 환경변수 관리할 수 있게 해줘.
이렇게처리할 수 있게 하자.

# 테이블 정보

주키
필드명(varchar 50)
변수값(varchar 255)


# 사용 방법
특정 프로젝트는 서버코드 위치, 프론트코드 위치 등등 여러 저장소 위치가 혼재될 예정이다.
그렇기 때문에 해당 위치를 환경변수를 통해서 위치를 기록한다. 

이 환경변수는 .env 에서 같은 이름으로 오버라이딩 가능하다.
그래서 로컬에서 동작시킬 때는 사용자가 서버, 프론트 둘 다 클론 받아두면 각각의 위치를 코드참조할 수 있다.

노드의 설명 같은 곳에 `{{환경변수명}}` 이렇게 적히는 경우는 환경변수로 인식한다.

## 구현 완료 (2026-06-02) — CRUD + 메뉴

이번 단계에서는 프로젝트별 환경변수 CRUD와 좌측 네비 메뉴까지 구현했다.
`.env` 오버라이딩 해석과 노드 설명의 `{{필드명}}` 치환은 차후 과제로 남긴다.

- **권한**: 로그인 멤버 누구나 조회·편집.
- **테이블**: `Environment`(id PK, name VarChar(50), value VarChar(255), projectId FK, `@@unique([projectId, name])`).
- **메뉴**: 좌측 네비 프로젝트 작업 메뉴에 "환경변수 관리"(`/project/{id}/environment`) 추가.
- 필드명은 `.env` 호환을 위해 영문/숫자/언더스코어만 허용(숫자 시작 불가).

### 산출 코드
- `prisma/schema.prisma` — `Environment` 모델
- `prisma/migrations/20260602062922_add_environment/`
- `src/components/LeftNav.tsx` — "환경변수 관리" 메뉴
- `src/app/project/[id]/environment/page.tsx` — 관리 페이지
- `src/app/project/[id]/environment/actions.ts` — create/update/delete
- `src/app/project/[id]/environment/EnvironmentEditor.tsx` — 편집 UI

