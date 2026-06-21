---
version: "1.0"
created: "2026-06-22"
author: "arahansa"
status: "approved"
---

# 슬라이드 기획서 (Slides) 설계

원본 요구사항: `docs/feature/02-slides.md`

## 1. 개요

프로젝트별 **테이블뷰**와 나란히, **슬라이드 기획서** 보기 영역을 추가한다.
각 페이지는 wiremd(md) 본문으로 와이어프레임을 그리고, 본문의 `(1)(2)` 마커에 대한
설명을 우측 코멘트 패널에 둔다. 페이지는 **버전 이력**을 가지며, **섹션(구역)** 으로 묶인다.

내용(본문) 채우기는 차후 Claude 세션과의 대화로 진행하므로, v1 웹 UI는
**구조 관리 + 기본 md 편집기(미리보기 포함)** 에 집중한다.

## 2. 렌더링 접근

직접 파서를 만들지 않고 **`wiremd` npm 패키지**(MIT, TypeScript, Remark 기반)를 사용한다.

- API: `parse(md)` → `renderToHTML(ast, { style, inlineStyles })` → 스타일 인라인 HTML 문자열.
- wiremd는 **Node 전용**이므로 **서버에서 렌더**한다.
  - 페이지 뷰: 서버 컴포넌트에서 직접 import 후 렌더.
  - 에디터 미리보기: `POST /api/slides/render` 라우트에서 렌더해 HTML 반환.
- 공통 헬퍼: `src/lib/wiremd.ts`의 `renderWiremd(content): string`.
- 기본 스타일 상수 하나(`sketch`, Balsamiq 풍)로 시작. 다중 스타일 토글은 차후.

## 3. 데이터 모델 (Prisma)

원본 spec의 표를 **페이지별 버전 이력** 결정에 맞춰 조정한다. 논리적 페이지를 묶는 키가
없어 `SlidePage`를 신설하고, spec의 `slide`는 "한 페이지의 한 버전"으로, `slide_section_slide`는
페이지 단위(`SlideSectionPage`)로 매핑한다.

| 모델 (`@@map`) | 역할 | 핵심 필드 |
|---|---|---|
| `SlidePage` (`slide_page`) | 논리적 페이지 | id, projectId, title, position, createdAt, updatedAt |
| `Slide` (`slide`) | 페이지의 한 버전 | id, pageId, version, content(md) · `@@unique([pageId, version])` |
| `SlideSection` (`slide_section`) | 구역(프로젝트 소속) | id, projectId, name, position, createdAt |
| `SlideSectionPage` (`slide_section_page`) | 섹션↔페이지 N:M | id, sectionId, pageId · `@@unique([sectionId, pageId])` |
| `SlideComment` (`slide_comment`) | 버전별 (n)번 설명 | id, slideId, commentNum, comment · `@@unique([slideId, commentNum])` |

- `Project`에 `slidePages`, `slideSections` 관계 추가. 모든 FK는 `onDelete: Cascade`.
- 코멘트는 **버전(Slide)에 귀속** — `(1)(2)` 마커가 버전별 내용이기 때문.
- **원본 spec과의 차이**(페이지별 버전 결정의 귀결):
  - `slide.project_id` → 페이지로 이동(projectId는 page에서 파생).
  - `slide_section`에 `projectId` 추가(프로젝트 소속).
  - 조인 테이블이 슬라이드(버전)가 아닌 **페이지**를 가리킴.

## 4. 버전 정책

- 에디터 저장은 기본적으로 **현재(최신) 버전 내용을 in-place 수정**한다.
- "새 버전 만들기" 액션 → `version = max+1`, **현재 내용을 복사**해 새 버전 생성
  (코멘트는 복사하지 않고 새로 작성). Node의 `version`과 동일하게 별도 개념.
- 페이지 뷰는 기본 최신 버전을 보여주고, 버전 셀렉터로 과거 버전을 열람한다.

## 5. 라우팅 & 화면

- LeftNav `PROJECT_TASK_ITEMS`에 `{ segment: "/slides", label: "슬라이드 기획서" }` 추가.
- **`/project/[id]/slides`** (인덱스): 섹션별 페이지 목록 + 미분류 페이지.
  인라인으로 페이지/섹션 CRUD, 섹션에 페이지 배치/해제 (NodeEditor의 인라인 편집 패턴 차용).
- **`/project/[id]/slides/[pageId]`** (뷰): 좌측 wiremd 렌더 본문(서버 렌더) + 우측 코멘트 패널
  (번호 → 설명) + 버전 셀렉터 + 편집 진입(본문 textarea + 미리보기, 코멘트 CRUD).

## 6. 편집 범위 (v1)

- 페이지/섹션 **생성·이름변경·삭제**, 섹션에 페이지 **배치/해제**, **코멘트 CRUD**.
- 본문은 **textarea + "미리보기"**(wiremd 렌더). 실시간 라이브 에디터·DnD 정렬 제외.
- Server Actions: `src/app/project/[id]/slides/actions.ts`.
- 인증: 기존 웹 페이지 관례(로그인 + 프로젝트 존재 확인)를 따른다.

## 7. 보안

wiremd 출력은 `dangerouslySetInnerHTML`로 주입된다. 작성자는 인증된 멤버지만 저장형 XSS를
막기 위해, wiremd가 raw HTML을 이스케이프하는지 **설치 후 실제 동작을 검증**하고,
필요하면 렌더 결과를 sanitize한다. (기존 `MarkdownView`는 react-markdown으로 raw HTML을
통과시키지 않아 안전하지만, 여기서는 HTML 문자열 주입이라 별도 처리가 필요하다.)

## 8. 의존성 & 위험

- `wiremd`(현재 v0.1.5, 초기 버전 — API 변동/버그 가능성). 서버에서만 import.
  Next 번들 이슈 시 `serverExternalPackages`로 분리.

## 9. v1 범위 밖 (차후 과제)

- 토큰 기반 슬라이드 콘텐츠 API(Claude 세션 작성용) — `docs/apis/`에 별도 설계.
- DnD 정렬, 다중 비주얼 스타일 토글, React/HTML export, 실시간 미리보기,
  `(n)` 마커 ↔ 코멘트 하이라이트 연동.

## 10. 산출물(예정)

- `prisma/schema.prisma` — 5개 모델 + Project 관계 + 마이그레이션.
- `src/lib/wiremd.ts` — `renderWiremd`.
- `src/app/api/slides/render/route.ts` — 미리보기 렌더 API.
- `src/app/project/[id]/slides/actions.ts` — Server Actions.
- `src/app/project/[id]/slides/page.tsx` + 관리 컴포넌트 — 인덱스.
- `src/app/project/[id]/slides/[pageId]/page.tsx` + 뷰/에디터 컴포넌트.
- `src/components/LeftNav.tsx` — 내비 항목 추가.
