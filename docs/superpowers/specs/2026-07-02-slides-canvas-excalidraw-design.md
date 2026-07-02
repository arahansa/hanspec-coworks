---
version: "1.0"
created: "2026-07-02"
author: "arahansa"
status: "draft"
supersedes: "docs/superpowers/specs/2026-06-22-slides-design.md (렌더/편집 부분)"
---

# 슬라이드 캔버스(Excalidraw) 전환 설계

원본 요구: `temp/request.md` + 후속 대화. 기존 슬라이드 설계(`2026-06-22-slides-design.md`)의
**페이지/버전/섹션/코멘트 데이터 구조는 유지**하고, **본문 표현을 wiremd(md 텍스트)에서
Excalidraw 캔버스(도형 자유 배치)로 대체**한다.

## 1. 결정 사항

1. **라이브러리**: **Excalidraw**(`@excalidraw/excalidraw`). MIT 라이선스, 손그림 스타일이
   기존 `sketch`(Balsamiq 풍) 와이어프레임 성격과 일치. tldraw 대비 라이선스/워터마크 부담 없음.
2. **대체(replace)**: wiremd 렌더·편집 경로를 **제거**하고 캔버스로 대체한다. 포맷 공존
   (discriminator) 방식은 채택하지 않는다. → 코드/의존성 단순화.
3. **저장**: `Slide`에 **`document Json?`(Postgres `jsonb`)** 컬럼을 신설하여 Excalidraw 장면
   `{ elements, appState, files }`을 저장한다. SVG를 저장하지 않는다(편집 원본은 구조화 JSON).

## 2. 데이터 모델 (Prisma)

`Slide` 모델만 변경한다. `SlidePage` / `SlideSection` / `SlideSectionPage` / `SlideComment`는 **불변**.

| 변경 | 내용 |
|---|---|
| 추가 | `document Json?` — Excalidraw 장면. 캔버스가 비어 있으면 `null` |
| 변경 | `content String? @db.Text` — **nullable로 완화**. 캔버스 슬라이드는 사용하지 않음(레거시 컬럼으로 잔존, 데이터 파괴 없음) |

- 기존 `content` 컬럼은 **드롭하지 않는다**(파괴적 마이그레이션 회피). 캔버스 슬라이드에서는 `null`.
- `SlideComment(commentNum, comment)`는 그대로 재사용 — 이미지 우측 "Description" 표에 해당.
  캔버스 안에 `(1)(2)` 번호 도형을 직접 그리고, 우측 코멘트 패널이 번호로 설명을 매핑한다.
- 마이그레이션: `pnpm exec prisma migrate dev --name slides_canvas_document`.

## 3. 저장 포맷

Excalidraw 장면 스냅샷을 그대로 jsonb에 저장한다.

```jsonc
{ "elements": [ /* ExcalidrawElement[] */ ],
  "appState": { /* 뷰포트/배경 등. collaborators 등 비직렬화 필드는 저장 전 제거 */ },
  "files":    { /* BinaryFiles: 붙여넣은 이미지 등 */ } }
```

- 빈 슬라이드는 `document = null` (컴포넌트가 빈 캔버스로 초기화).
- `appState`는 통째로 저장하지 말고 Excalidraw 권장대로 **직렬화 가능한 필드만** 저장한다
  (`collaborators`, `selectedElementIds` 등 휘발성 제외). 헬퍼에서 정제.

## 4. 컴포넌트 / 렌더링 (클라이언트 전용)

Excalidraw는 **브라우저 전용**(window 의존)이라 서버 렌더 불가.

- **`src/components/ExcalidrawCanvas.tsx`** (신설, `"use client"`):
  - `@excalidraw/excalidraw`를 **`dynamic(() => import(...), { ssr: false })`** 로 로드. CSS
    (`@excalidraw/excalidraw/index.css`) import.
  - props: `initialDocument`, `viewMode?: boolean`, `onChange?(document)`.
  - 편집 모드: `onChange`에서 장면을 정제해 상위로 전달(디바운스는 상위에서).
  - 뷰 모드: `viewModeEnabled`로 편집 잠금.
- **뷰+편집 통합**: 기존 "위=읽기 뷰 / 아래=편집기" 2단 구성을 **단일 편집 캔버스**로 통합한다
  (무거운 Excalidraw 인스턴스 이중 마운트 방지). 우측 코멘트 패널·버전 셀렉터는 유지.

## 5. Server Actions (`actions.ts`)

기존 패턴(로그인 확인 → 소유 검증 → `revalidatePath`)을 그대로 따른다.

| 액션 | 변경 |
|---|---|
| `updateSlideDocument(slideId, document)` | **신설**. jsonb 저장. `updateSlideContent`(wiremd)를 대체. 직렬화 크기 상한 검증 |
| `createSlidePage(projectId, title)` | v1 초기 슬라이드 생성 시 `content` 대신 `document = null` |
| `createSlideVersion(pageId)` | 최신 버전의 `document`를 복사(코멘트는 미복사 — 기존 정책 유지) |

- 크기 상한: `JSON.stringify(document).length`로 상한(예: 5MB) 검증. 초과 시 저장 거부.

## 6. 화면 흐름

- **인덱스(`/project/[id]/slides`)**: 변경 없음. 페이지/섹션 CRUD·배치 그대로. 포맷 선택 UI 불필요.
- **뷰/편집(`/project/[id]/slides/[pageId]`)**:
  - 서버 컴포넌트: 페이지·선택 버전·`document`·코멘트 조회(기존과 동일, `content` 대신 `document`).
  - 클라이언트: 단일 `ExcalidrawCanvas`(편집 가능) + 우측 코멘트 패널 + 버전 셀렉터/새 버전 버튼.
  - **자동 저장**: 캔버스 변경을 디바운스(약 800ms 유휴)해 `updateSlideDocument` 호출.
    "저장됨/저장 중" 표시. 정책은 **last-write-wins(단일 사용자)**.

## 7. 제거 대상 (wiremd 경로)

- `src/lib/wiremd.ts` — 삭제.
- `src/app/api/slides/render/route.ts` — 삭제(미리보기는 캔버스가 곧 실시간 편집이라 불필요).
- `src/app/project/[id]/slides/SlideFrame.tsx` — 삭제(iframe 렌더 불필요).
- `SlideEditor.tsx` — textarea/미리보기 로직 제거, 캔버스+코멘트 관리로 재작성.
- `package.json` — `wiremd` 의존성 제거, `@excalidraw/excalidraw` 추가.
- `serverExternalPackages`에 wiremd 항목이 있으면 정리.

## 8. 보안

- wiremd는 raw HTML 문자열을 `iframe srcDoc`에 주입(저장형 XSS 위험 → sandbox로 방어)했다.
  Excalidraw는 **JSON을 라이브러리가 캔버스로 렌더**하므로 HTML 주입 경로가 사라진다.
  `dangerouslySetInnerHTML`·sandbox iframe 모두 불필요.
- 저장 시 jsonb 크기 상한 외 추가 검증은 최소화(도형 데이터는 실행 코드가 아님).

## 9. 위험 요소

- **Next 16.2 + Excalidraw SSR/번들**: 반드시 `ssr:false` 동적 import. `AGENTS.md` 경고대로 이
  개조판 Next의 동적 import·CSS 처리 방식을 문서(`node_modules/next/dist/docs/`)로 확인.
  번들 이슈 시 `transpilePackages`/`serverExternalPackages` 조정.
- **React 19 호환**: `@excalidraw/excalidraw`가 React 19.2를 지원하는 버전인지 설치 시 검증
  (미지원 시 호환 버전 고정 또는 peerdep 확인).
- **번들 크기**: Excalidraw는 큼 → 캔버스 페이지에서만 lazy load(동적 import로 자연 분리).
- **jsonb 비대화**: 이미지 붙여넣기(`files`)로 커질 수 있음 → 크기 상한으로 방어. 대용량 이미지
  별도 스토리지 분리는 차후 과제.

## 10. v1 범위 밖 (차후)

- 실시간 동시편집(CRDT/Yjs), PNG/SVG export, `(n)` 마커 ↔ 코멘트 클릭 하이라이트 연동,
  wiremd↔캔버스 상호 변환/기존 wiremd 데이터 마이그레이션, 다중 이미지 외부 스토리지.

## 11. 산출물(예정)

- `prisma/schema.prisma` — `Slide.document` 추가 + `content` nullable + 마이그레이션.
- `src/components/ExcalidrawCanvas.tsx` — 캔버스 래퍼(신설).
- `src/app/project/[id]/slides/[pageId]/SlideEditor.tsx` — 캔버스+코멘트로 재작성.
- `src/app/project/[id]/slides/[pageId]/page.tsx` — `document` 조회로 전환.
- `src/app/project/[id]/slides/actions.ts` — `updateSlideDocument` 추가, 생성/새버전 조정.
- 삭제: `src/lib/wiremd.ts`, `src/app/api/slides/render/route.ts`, `SlideFrame.tsx`.
- `package.json` — 의존성 교체(`wiremd` 제거, `@excalidraw/excalidraw` 추가).
