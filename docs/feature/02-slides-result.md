---
created: "2026-06-22"
author: "Claude (Opus 4.8)"
feature: "슬라이드 기획서 (Slides)"
branch: "feature/slides"
status: "구현 완료 (검증 통과) · 머지 대기"
---

# 슬라이드 기획서 — 구현 결과 보고서

요구사항: `docs/feature/02-slides.md`
설계: `docs/superpowers/specs/2026-06-22-slides-design.md`

## 1. 한눈에 보기

프로젝트별 **슬라이드 기획서** 영역을 새로 추가했습니다. 각 페이지의 본문(md)을
[wiremd](https://wiremd.dev) 문법으로 작성하면 와이어프레임으로 렌더링되고, 본문의
`(1) (2)` 마커에 대한 설명을 우측 코멘트 패널에 답니다. 페이지는 **버전 이력**을 가지며
**섹션(구역)** 으로 묶입니다.

- 좌측 내비게이션 `슬라이드 기획서` → `/project/:id/slides`
- 인덱스에서 페이지/섹션을 만들고, 페이지를 섹션에 배치
- 페이지 뷰에서 와이어프레임 + 코멘트 확인, 본문 편집·미리보기, 새 버전 생성

> 명세대로 **본문 내용 채우기는 차후 Claude 세션과의 대화로** 진행하는 것을 전제로,
> v1 웹 UI는 **구조 관리 + 기본 md 에디터(미리보기 포함)** 에 집중했습니다.

## 2. 핵심 설계 결정 (브레인스토밍에서 합의)

| 주제 | 결정 |
|---|---|
| 렌더링 | `wiremd` npm 패키지로 **서버 사이드 렌더**. 직접 파서 미구현 |
| 버전 | **페이지별 버전 이력** (논리적 페이지 → 여러 버전) |
| 섹션 | **프로젝트 소속**, **페이지**(버전 아님)를 묶음 |
| 편집 범위(v1) | 구조 CRUD + 기본 md 에디터 + 미리보기 (실시간/DnD 제외) |

### 데이터 모델 — 원본 spec 표와의 차이

페이지별 버전 이력을 위해 spec의 표를 조정했습니다(설계 문서 3절 참조).

- `slide_page` **신설**: 논리적 페이지(projectId, title, position).
- `slide`: "한 페이지의 한 버전"으로 재정의(pageId + version + content). `project_id`는 page로 이동.
- `slide_section`: **projectId 추가**(프로젝트 소속).
- `slide_section_slide` → `slide_section_page`: 조인이 **버전이 아닌 페이지**를 가리킴.
- `slide_comment`: 그대로(slideId = 버전에 귀속). `(n)` 마커가 버전별 내용이기 때문.

## 3. wiremd 통합 & 보안

- `renderToHTML`은 `<!DOCTYPE html>…<style>…` 형태의 **완전한 HTML 문서**를 반환하며,
  **raw HTML/스크립트를 이스케이프하지 않습니다**(실측 확인: `<script>`가 그대로 통과).
- 그래서 결과를 페이지에 직접 주입하지 않고 **sandbox된 `<iframe srcDoc>`**(`SlideFrame`)로
  렌더합니다. `sandbox=""`(allow-scripts 없음)라 문서 내 스크립트가 실행되지 않아
  **저장형 XSS를 차단**하면서, 인라인 스타일/폰트는 정상 동작합니다. 별도 sanitizer 불필요.
- `wiremd`는 Node 전용이라 `next.config.ts`의 `serverExternalPackages`로 분리했습니다.
- 기본 스타일은 `sketch`(Balsamiq 풍) 상수 하나. 다중 스타일 토글은 차후 과제.

## 4. 산출물

스키마/인프라
- `prisma/schema.prisma` — 5개 모델 + `Project` 관계
- `prisma/migrations/20260621153358_add_slides/` — **Supabase에 적용 완료**
- `next.config.ts` — `serverExternalPackages: ["wiremd"]`
- `package.json` — `wiremd@0.1.5`

렌더링/API
- `src/lib/wiremd.ts` — `renderWiremd(content)`
- `src/app/project/[id]/slides/SlideFrame.tsx` — sandbox iframe 렌더
- `src/app/api/slides/render/route.ts` — `POST /api/slides/render`(미리보기, 세션 인증)

서버 액션
- `src/app/project/[id]/slides/actions.ts` — 페이지/섹션/코멘트 CRUD,
  섹션 배치/해제, 본문 수정, 새 버전 생성

UI
- `src/components/LeftNav.tsx` — 내비 항목 추가
- `src/app/project/[id]/slides/page.tsx` + `SlidesManager.tsx` — 인덱스(관리)
- `src/app/project/[id]/slides/[pageId]/page.tsx` + `SlideEditor.tsx` — 뷰 + 에디터

## 5. 검증 결과

- ✅ `wiremd` 렌더 실측: 정상 HTML 생성(스크립트 미이스케이프 확인 → iframe sandbox로 대응)
- ✅ `prisma validate` 통과, `prisma migrate dev` **DB 적용 완료**
- ✅ `pnpm exec tsc --noEmit` — **에러 0**
- ✅ `pnpm build` — 성공. 신규 라우트 3개 정상 생성
  (`/api/slides/render`, `/project/[id]/slides`, `/project/[id]/slides/[pageId]`)

### 아직 하지 않은 검증 (권장)

- **로그인 상태의 실제 브라우저 E2E 테스트** — 렌더 API가 세션 인증을 요구해
  자동화로 끝까지 확인하지 못했습니다. 사람이 로그인 후 페이지 생성→본문 작성→
  미리보기→저장→코멘트→새 버전 흐름을 한 번 확인하길 권장합니다.
- wiremd v0.1.5는 초기 버전이라 복잡한 문법에서 파싱 이슈 가능성이 있습니다
  (`renderWiremd`는 파싱 실패 시 오류 문서를 iframe에 표시하도록 방어).

## 6. 사용법

1. 프로젝트 선택 → 좌측 `슬라이드 기획서`.
2. `+ 페이지`로 페이지 생성, `+ 섹션`으로 구역 생성, 미분류 페이지의 `섹션에 추가…`로 배치.
3. 페이지 클릭 → 와이어프레임 + 코멘트. 하단 `편집`에서 본문(wiremd) 작성 후
   `미리보기`로 확인하고 `저장`. `새 버전 만들기`로 현재 내용을 복제한 버전 생성.
4. 본문에 `(1) (2)` 마커를 적고, 편집의 코멘트 폼에서 번호별 설명을 답니다.

간단 예시 본문:
```
# 로그인

[[ 로고 | 메뉴 | 도움말 ]]

## 다시 오신 걸 환영합니다 (1)

[이메일________]
[비밀번호______]
[ ] 자동 로그인
[로그인]   (2)
```

## 7. 차후 과제

- 토큰 기반 슬라이드 콘텐츠 API(Claude 세션이 본문을 쓰도록) — `docs/apis/`에 별도 설계.
- DnD 정렬, 다중 비주얼 스타일 토글, React/HTML export, 실시간 미리보기,
  `(n)` 마커 ↔ 코멘트 하이라이트 연동.

## 8. Git

- 브랜치: `feature/slides` (← `dev`에서 분기)
- 커밋:
  - `a755742` docs: 설계(spec)
  - `fc488a6` feat: 스키마 5모델 + 마이그레이션 + wiremd 의존성
  - `b00d6e9` feat: wiremd 렌더 lib/iframe/API + 서버 액션
  - `8a42f1a` feat: 내비 + 인덱스/뷰/에디터 UI
  - `ee8767e` docs: 02-slides 요구사항 본문 보강
- **다음 단계**: 위 E2E 확인 후 `feature/slides` → `dev`(또는 `main`) 머지/PR.
  마이그레이션은 이미 적용됐으므로 다른 환경에 배포 시 `prisma migrate deploy` 필요.
