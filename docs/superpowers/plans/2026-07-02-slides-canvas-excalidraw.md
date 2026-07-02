# 슬라이드 Excalidraw 캔버스 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 슬라이드 본문 표현을 wiremd(md 텍스트)에서 Excalidraw 캔버스(도형 자유 배치)로 대체하고, 장면을 `Slide.document(jsonb)`에 저장한다.

**Architecture:** `SlidePage`/`Slide`/`SlideSection`/`SlideComment` 데이터 구조는 유지한다. `Slide`에 `document Json?`를 신설해 Excalidraw 장면 `{ elements, appState, files }`를 저장한다. Excalidraw는 브라우저 전용이므로 `"use client"` 래퍼에서 `next/dynamic`의 `ssr:false`로 로드하고, 뷰+편집을 단일 캔버스로 통합해 변경을 디바운스 자동저장한다. wiremd 렌더/편집/의존성은 제거한다.

**Tech Stack:** Next.js 16.2 (App Router, Turbopack), React 19.2, TypeScript, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL(Supabase), Tailwind v4, `@excalidraw/excalidraw`, pnpm.

## Global Constraints

- **매 태스크마다 커밋한다.** 논리적 단위가 끝나면 커밋하며 무관한 변경을 섞지 않는다. (coworks CLAUDE.md)
- **Next 16은 학습된 버전과 다르다.** 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 확인한다. (AGENTS.md)
- **자동화 테스트 러너 없음.** 검증은 타입체크(`pnpm exec tsc --noEmit`), 빌드(`pnpm build`), dev 서버 수동 확인, DB 조회로 한다. 새 테스트 러너를 도입하지 않는다.
- **Prisma v7**: 연결 URL은 `prisma.config.ts`(CLI, `DATABASE_URL_UNPOOLED`) + 런타임 어댑터(`src/lib/prisma.ts`, `DATABASE_URL`)가 관리. 마이그레이션은 `pnpm exec prisma migrate dev --name <name>`.
- **Server Action 관례**: 로그인 확인(`getCurrentMemberId`/`getCurrentMember` → 없으면 `redirect("/signin")`) → 소유 검증 → 변경 → `revalidatePath`. 반환은 `SlideActionResult`.
- **인증 유틸**: `@/lib/auth`의 `getCurrentMember()`, `getCurrentMemberId()`.
- **jsonb 저장 상한**: `JSON.stringify(document).length` ≤ 5,000,000. 초과 시 저장 거부.
- **Excalidraw 직렬화**: 저장/전달 시 `serializeAsJSON(elements, appState, files, "database")`로 정제(휘발성 `appState` 필드 제거)한다. 수동 정제하지 않는다.

---

### Task 1: Prisma 스키마 — `Slide.document` 추가 + `content` nullable

**Files:**
- Modify: `prisma/schema.prisma:374-388` (`Slide` 모델)
- Create: `prisma/migrations/<timestamp>_slides_canvas_document/migration.sql` (migrate가 생성)

**Interfaces:**
- Produces: `Slide.document: Prisma.JsonValue | null` (jsonb), `Slide.content: string | null` (기존 NOT NULL → nullable). 후속 태스크의 Server Action·페이지가 이 필드를 사용.

- [ ] **Step 1: `Slide` 모델 수정**

`prisma/schema.prisma`의 `Slide` 모델을 아래로 교체한다. `content`를 옵셔널로 바꾸고 주석을 갱신, `document` 추가.

```prisma
/// 한 페이지(SlidePage)의 한 버전. document는 Excalidraw 장면(jsonb).
/// content(레거시 wiremd 본문)는 캔버스 전환 후 미사용 — nullable로 잔존.
/// 코멘트는 (1)(2) 마커가 버전별 내용이므로 버전(Slide)에 귀속된다.
/// 참조: docs/superpowers/specs/2026-07-02-slides-canvas-excalidraw-design.md
model Slide {
  id        Int      @id @default(autoincrement())
  pageId    Int
  version   Int // 페이지 내 버전 번호 (1부터)
  content   String?  @db.Text // 레거시(wiremd). 캔버스 슬라이드는 null.
  document  Json?    // Excalidraw 장면 { elements, appState, files }. 빈 캔버스는 null.
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  page     SlidePage      @relation(fields: [pageId], references: [id], onDelete: Cascade)
  comments SlideComment[]

  @@unique([pageId, version])
  @@index([pageId])
  @@map("slide")
}
```

- [ ] **Step 2: 마이그레이션 생성·적용**

Run: `pnpm exec prisma migrate dev --name slides_canvas_document`
Expected: 마이그레이션 생성 후 적용 성공, `prisma generate` 자동 실행. 생성된 `migration.sql`에 `ALTER TABLE "slide" ADD COLUMN "document" JSONB` 와 `content`의 `DROP NOT NULL`이 포함되는지 확인.

- [ ] **Step 3: 타입 생성 확인**

Run: `pnpm exec tsc --noEmit`
Expected: 통과. (기존 `actions.ts`가 `content` 를 non-null로 쓰는 곳이 있어 에러가 나면 Task 4에서 정리하므로, 이 단계에서는 스키마/생성만 확인. 에러가 스키마 외 파일이면 무시하고 진행.)

- [ ] **Step 4: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(slides): Slide.document(jsonb) 추가 + content nullable"
```

---

### Task 2: 의존성 교체 — wiremd 제거, Excalidraw 추가

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts`

**Interfaces:**
- Produces: `@excalidraw/excalidraw` 임포트 가능. `next.config.ts`에서 `serverExternalPackages` 정리.

- [ ] **Step 1: Excalidraw 설치, wiremd 제거**

Run:
```bash
pnpm remove wiremd
pnpm add @excalidraw/excalidraw
```
Expected: 설치 성공. React 19.2 peer 경고/에러가 나면 출력 확인 — 에러(설치 실패)면 `pnpm add @excalidraw/excalidraw@latest` 또는 릴리스 노트에서 React 19 지원 버전을 확인해 고정한다. 경고 수준이면 진행.

- [ ] **Step 2: `next.config.ts`에서 wiremd 외부화 제거**

`next.config.ts`를 아래로 교체(더 이상 wiremd 없음, Excalidraw는 클라이언트 동적 import라 별도 설정 불필요).

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 3: 설치·타입 확인**

Run: `pnpm exec tsc --noEmit`
Expected: `wiremd` 임포트가 남은 파일(예: `src/lib/wiremd.ts`)에서 에러가 날 수 있음 — Task 6에서 삭제하므로 이 단계에서는 `package.json`/`next.config.ts` 변경 자체만 확인.

- [ ] **Step 4: 커밋**

```bash
git add package.json pnpm-lock.yaml next.config.ts
git commit -m "chore(slides): wiremd 제거, @excalidraw/excalidraw 추가"
```

---

### Task 3: `ExcalidrawCanvas` 클라이언트 래퍼 컴포넌트

**Files:**
- Create: `src/components/ExcalidrawCanvas.tsx`

**Interfaces:**
- Produces:
  - `type SceneDocument = { elements: unknown[]; appState: Record<string, unknown>; files: Record<string, unknown> }`
  - `export function ExcalidrawCanvas(props: { initialDocument: SceneDocument | null; viewMode?: boolean; onChange?: (doc: SceneDocument) => void; className?: string }): JSX.Element`
- Consumes: `@excalidraw/excalidraw` (`Excalidraw`, `serializeAsJSON`).

- [ ] **Step 1: Next 16 동적 import 규칙 확인**

`node_modules/next/dist/docs/`에서 `next/dynamic` / `ssr: false` 관련 가이드를 확인한다(클라이언트 컴포넌트에서만 `ssr:false` 허용되는지 등). 확인한 내용에 맞춰 아래 구현을 조정한다.

- [ ] **Step 2: 컴포넌트 작성**

`src/components/ExcalidrawCanvas.tsx`:

```tsx
// 참조: docs/superpowers/specs/2026-07-02-slides-canvas-excalidraw-design.md
// Excalidraw 캔버스 래퍼. 브라우저 전용이라 ssr:false 동적 import로 로드한다.
"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { serializeAsJSON } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export type SceneDocument = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

// Excalidraw 본체는 window에 의존 → 서버 렌더 금지.
const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => m.Excalidraw),
  { ssr: false, loading: () => <div className="p-4 text-sm text-zinc-400">캔버스 로딩…</div> },
);

type Props = {
  initialDocument: SceneDocument | null;
  viewMode?: boolean;
  onChange?: (doc: SceneDocument) => void;
  className?: string;
};

export function ExcalidrawCanvas({ initialDocument, viewMode, onChange, className }: Props) {
  // initialData는 마운트 시 1회만 반영되므로 안정적인 값으로 고정.
  const initialData = useMemo(
    () =>
      initialDocument
        ? {
            elements: initialDocument.elements as never,
            appState: { ...(initialDocument.appState as object), collaborators: undefined },
            files: initialDocument.files as never,
          }
        : undefined,
    [initialDocument],
  );

  return (
    <div className={className ?? "h-[70vh] w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"}>
      <Excalidraw
        initialData={initialData}
        viewModeEnabled={viewMode ?? false}
        onChange={(elements, appState, files) => {
          if (!onChange) return;
          // serializeAsJSON("database")이 휘발성 appState를 정제한 문자열을 반환.
          const parsed = JSON.parse(
            serializeAsJSON(elements, appState, files, "database"),
          ) as { elements: unknown[]; appState: Record<string, unknown>; files: Record<string, unknown> };
          onChange({ elements: parsed.elements, appState: parsed.appState, files: parsed.files });
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: 타입 확인**

Run: `pnpm exec tsc --noEmit`
Expected: `ExcalidrawCanvas.tsx` 관련 에러 없음. (Excalidraw 타입 시그니처가 다르면 실제 `node_modules/@excalidraw/excalidraw` 타입에 맞춰 `onChange`/`initialData` 형태를 조정.)

- [ ] **Step 4: 커밋**

```bash
git add src/components/ExcalidrawCanvas.tsx
git commit -m "feat(slides): ExcalidrawCanvas 클라이언트 래퍼"
```

---

### Task 4: Server Actions — `updateSlideDocument` 추가, 생성/새버전 조정, wiremd 액션 제거

**Files:**
- Modify: `src/app/project/[id]/slides/actions.ts`

**Interfaces:**
- Consumes: `SceneDocument` 형태의 JSON(클라이언트에서 전달). Prisma `Slide.document`.
- Produces:
  - `export async function updateSlideDocument(slideId: number, document: unknown): Promise<SlideActionResult>`
  - `createSlidePage(projectId, title)` — v1 생성 시 `document` 미설정(null), `content` 미설정.
  - `createSlideVersion(pageId)` — 최신 버전의 `document` 복사.
  - `updateSlideContent` 제거(더 이상 사용 안 함).

- [ ] **Step 1: import에 `Prisma` 추가**

`actions.ts` 상단 import에 Prisma 네임스페이스를 추가(`Prisma.DbNull` 사용).

```ts
import { Prisma } from "@/generated/prisma/client";
```

(`src/lib/prisma.ts`가 `@/generated/prisma/client`에서 `PrismaClient`를 가져오므로 `Prisma` 네임스페이스도 같은 경로에서 가져온다.)

- [ ] **Step 2: 상수 추가, `updateSlideContent` 제거, `updateSlideDocument` 추가**

`actions.ts`에서 `CONTENT_MAX` 부근에 상한 상수를 추가하고, `updateSlideContent` 함수(현재 253-277행)를 아래 `updateSlideDocument`로 교체한다.

```ts
const DOCUMENT_MAX = 5_000_000; // 직렬화 문자열 길이 상한(바이트 근사)

/** 슬라이드(버전)의 Excalidraw 장면(document)을 in-place로 저장한다. */
export async function updateSlideDocument(
  slideId: number,
  document: unknown,
): Promise<SlideActionResult> {
  const [, slide] = await Promise.all([
    assertAuthenticated(),
    prisma.slide.findUnique({
      where: { id: slideId },
      select: { id: true, pageId: true, page: { select: { projectId: true } } },
    }),
  ]);
  if (!slide) return { ok: false, error: "존재하지 않는 슬라이드입니다." };

  if (document === null || typeof document !== "object") {
    return { ok: false, error: "장면 데이터가 올바르지 않습니다." };
  }
  if (JSON.stringify(document).length > DOCUMENT_MAX) {
    return { ok: false, error: "장면이 너무 큽니다. 이미지 크기를 줄여 주세요." };
  }

  await prisma.slide.update({
    where: { id: slideId },
    data: { document: document as Prisma.InputJsonValue },
  });
  revalidatePath(`/project/${slide.page.projectId}/slides/${slide.pageId}`);
  return { ok: true, id: slideId };
}
```

- [ ] **Step 3: `createSlidePage`의 초기 버전 생성 수정**

`createSlidePage`(현재 37-71행) 안의 `versions: { create: { version: 1, content: "" } }` 를 아래로 바꾼다(빈 캔버스는 document 미설정).

```ts
        versions: { create: { version: 1 } },
```

- [ ] **Step 4: `createSlideVersion`이 document를 복사하도록 수정**

`createSlideVersion`(현재 283-308행)에서 최신 버전 조회 select와 create data를 아래로 바꾼다.

```ts
  const latest = await prisma.slide.findFirst({
    where: { pageId },
    orderBy: { version: "desc" },
    select: { version: true, document: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await prisma.slide.create({
    data: {
      pageId,
      version: nextVersion,
      document:
        latest?.document == null
          ? Prisma.DbNull
          : (latest.document as Prisma.InputJsonValue),
    },
    select: { id: true },
  });
```

- [ ] **Step 5: 타입 확인**

Run: `pnpm exec tsc --noEmit`
Expected: `actions.ts` 통과. (`page.tsx`/`SlideEditor.tsx`가 아직 `content`/`updateSlideContent`를 참조해 에러가 나면 Task 5에서 교체하므로 그 파일들의 에러만 남는지 확인.)

- [ ] **Step 6: 커밋**

```bash
git add "src/app/project/[id]/slides/actions.ts"
git commit -m "feat(slides): updateSlideDocument 추가, 생성/새버전 document 처리"
```

---

### Task 5: 뷰/편집 페이지 재작성 — 단일 캔버스 + 코멘트 + 자동저장

**Files:**
- Modify: `src/app/project/[id]/slides/[pageId]/page.tsx`
- Modify: `src/app/project/[id]/slides/[pageId]/SlideEditor.tsx`

**Interfaces:**
- Consumes: `ExcalidrawCanvas`, `SceneDocument`(Task 3); `updateSlideDocument`, `createSlideVersion`, `upsertSlideComment`, `deleteSlideComment`(Task 4/기존).
- Produces: 캔버스 편집 + 디바운스 자동저장 UI. `SlideFrame`/`renderWiremd` 참조 제거.

- [ ] **Step 1: `page.tsx`를 document 조회·전달로 교체**

`src/app/project/[id]/slides/[pageId]/page.tsx`에서 wiremd 렌더(`renderWiremd`, `SlideFrame`)를 제거하고 `document`를 조회해 `SlideEditor`에 넘긴다. 파일 전체를 아래로 교체.

```tsx
// 참조: docs/superpowers/specs/2026-07-02-slides-canvas-excalidraw-design.md
// 슬라이드 페이지: 단일 Excalidraw 캔버스(선택 버전) + 우측 코멘트 + 버전 셀렉터 + 자동저장.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import type { SceneDocument } from "@/components/ExcalidrawCanvas";
import { SlideEditor } from "./SlideEditor";

export const dynamic = "force-dynamic";

export default async function SlidePageView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pageId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const { id, pageId: pageIdStr } = await params;
  const projectId = Number(id);
  const pageId = Number(pageIdStr);
  if (!Number.isInteger(projectId) || !Number.isInteger(pageId)) notFound();

  const page = await prisma.slidePage.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      title: true,
      projectId: true,
      project: { select: { name: true } },
      versions: { orderBy: { version: "desc" }, select: { version: true } },
    },
  });
  if (!page || page.projectId !== projectId) notFound();

  const versionNumbers = page.versions.map((v) => v.version);
  const latest = versionNumbers[0] ?? 1;
  const sp = await searchParams;
  const requested = Number(sp.v);
  const selectedVersion = versionNumbers.includes(requested) ? requested : latest;

  const slide = await prisma.slide.findFirst({
    where: { pageId, version: selectedVersion },
    select: {
      id: true,
      version: true,
      document: true,
      comments: {
        orderBy: { commentNum: "asc" },
        select: { id: true, commentNum: true, comment: true },
      },
    },
  });
  if (!slide) notFound();

  const initialDocument = (slide.document as SceneDocument | null) ?? null;

  return (
    <div className="p-8">
      <nav className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href={`/project/${projectId}/slides`} className="hover:underline">
          {page.project.name} · 슬라이드 기획서
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">›</span>
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{page.title}</span>
      </nav>

      <div className="mt-2 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {page.title}
        </h1>
        <span className="font-mono text-xs text-zinc-400">#{page.id}</span>
        <div className="flex items-center gap-1">
          {versionNumbers.map((v) => {
            const active = v === selectedVersion;
            return (
              <Link
                key={v}
                href={`/project/${projectId}/slides/${pageId}?v=${v}`}
                aria-current={active ? "page" : undefined}
                className={`rounded px-2 py-0.5 font-mono text-xs transition ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                v{v}
              </Link>
            );
          })}
        </div>
      </div>

      <SlideEditor
        key={slide.id}
        projectId={projectId}
        slideId={slide.id}
        pageId={pageId}
        version={slide.version}
        initialDocument={initialDocument}
        comments={slide.comments}
      />
    </div>
  );
}
```

- [ ] **Step 2: `SlideEditor.tsx` 재작성 — 캔버스 + 자동저장 + 코멘트**

`src/app/project/[id]/slides/[pageId]/SlideEditor.tsx` 전체를 아래로 교체.

```tsx
// 참조: docs/superpowers/specs/2026-07-02-slides-canvas-excalidraw-design.md
// 단일 Excalidraw 캔버스(편집) + 디바운스 자동저장 + 우측 코멘트 패널/관리 + 새 버전.
"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExcalidrawCanvas, type SceneDocument } from "@/components/ExcalidrawCanvas";
import {
  updateSlideDocument,
  createSlideVersion,
  upsertSlideComment,
  deleteSlideComment,
  type SlideActionResult,
} from "../actions";

export type CommentItem = { id: number; commentNum: number; comment: string };

type Props = {
  projectId: number;
  slideId: number;
  pageId: number;
  version: number;
  initialDocument: SceneDocument | null;
  comments: CommentItem[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function SlideEditor({
  projectId,
  slideId,
  pageId,
  version,
  initialDocument,
  comments,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const [commentNum, setCommentNum] = useState("");
  const [commentText, setCommentText] = useState("");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDoc = useRef<SceneDocument | null>(null);

  // 캔버스 변경 → 800ms 디바운스 후 저장. onChange가 초기 마운트에도 불릴 수 있어
  // 실제 저장은 사용자 상호작용 이후에만 의미 있도록 latestDoc에 담아두고 타이머로 커밋.
  const handleChange = useCallback(
    (doc: SceneDocument) => {
      latestDoc.current = doc;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const toSave = latestDoc.current;
        if (!toSave) return;
        setSaveState("saving");
        setError(null);
        void updateSlideDocument(slideId, toSave).then((res: SlideActionResult) => {
          if (res.ok) {
            setSaveState("saved");
          } else {
            setSaveState("error");
            setError(res.error);
          }
        });
      }, 800);
    },
    [slideId],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function run(action: () => Promise<SlideActionResult>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function startEditComment(c: CommentItem) {
    setCommentNum(String(c.commentNum));
    setCommentText(c.comment);
  }

  const saveLabel =
    saveState === "saving" ? "저장 중…" : saveState === "saved" ? "저장됨" : saveState === "error" ? "저장 실패" : "";

  return (
    <section>
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          편집 <span className="font-mono text-sm text-zinc-400">v{version}</span>
        </h2>
        {saveLabel && (
          <span
            className={`text-xs ${
              saveState === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {saveLabel}
          </span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("현재 캔버스를 복사해 새 버전을 만들까요? (코멘트는 복사되지 않습니다)")) {
              run(() => createSlideVersion(pageId), () =>
                router.push(`/project/${projectId}/slides/${pageId}`),
              );
            }
          }}
          className="ml-auto rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          새 버전 만들기
        </button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <ExcalidrawCanvas initialDocument={initialDocument} onChange={handleChange} />
        </div>

        <aside className="w-full shrink-0 lg:w-72">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            코멘트 (캔버스의 (n) 마커 설명)
          </h3>

          {comments.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <span className="shrink-0 font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                    ({c.commentNum})
                  </span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                    {c.comment}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startEditComment(c)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteSlideComment(c.id))}
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const num = Number(commentNum);
              if (!Number.isInteger(num) || num < 1 || !commentText.trim()) return;
              run(() => upsertSlideComment(slideId, num, commentText), () => {
                setCommentNum("");
                setCommentText("");
              });
            }}
            className="flex flex-col gap-2"
          >
            <input
              type="number"
              min={1}
              value={commentNum}
              disabled={pending}
              onChange={(e) => setCommentNum(e.target.value)}
              placeholder="(n)"
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={commentText}
              disabled={pending}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="이 번호에 대한 설명"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={pending || !commentNum || !commentText.trim()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              코멘트 저장
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: 타입 확인**

Run: `pnpm exec tsc --noEmit`
Expected: `page.tsx`/`SlideEditor.tsx` 통과. 남는 에러는 아직 삭제 안 한 `SlideFrame.tsx`(wiremd) 정도 — Task 6에서 제거.

- [ ] **Step 4: 커밋**

```bash
git add "src/app/project/[id]/slides/[pageId]/page.tsx" "src/app/project/[id]/slides/[pageId]/SlideEditor.tsx"
git commit -m "feat(slides): 뷰/편집 페이지를 Excalidraw 캔버스+자동저장으로 재작성"
```

---

### Task 6: wiremd 경로 제거 + 빌드/런타임 검증

**Files:**
- Delete: `src/lib/wiremd.ts`
- Delete: `src/app/api/slides/render/route.ts`
- Delete: `src/app/project/[id]/slides/SlideFrame.tsx`

**Interfaces:**
- Consumes: 이전 태스크 산출물 전체.
- Produces: wiremd 잔재 없는 빌드.

- [ ] **Step 1: 잔여 참조 확인**

Run: `git grep -n "wiremd\|SlideFrame\|renderWiremd\|updateSlideContent" -- src`
Expected: 삭제 예정 3개 파일 외의 참조가 없어야 한다. 만약 다른 파일에 남아 있으면 해당 참조를 먼저 제거한다.

- [ ] **Step 2: 파일 삭제**

Run:
```bash
git rm src/lib/wiremd.ts "src/app/api/slides/render/route.ts" "src/app/project/[id]/slides/SlideFrame.tsx"
```
Expected: 3개 파일 삭제. `slides/api/render` 디렉터리가 비면 함께 정리.

- [ ] **Step 3: 타입체크**

Run: `pnpm exec tsc --noEmit`
Expected: 전체 통과(에러 0).

- [ ] **Step 4: 빌드**

Run: `pnpm build`
Expected: 성공. Excalidraw 관련 SSR/`window` 에러가 나면 Task 3의 `ssr:false` 동적 import와 `"use client"` 배치를 재점검(캔버스는 반드시 클라이언트에서만 마운트).

- [ ] **Step 5: dev 서버 수동 검증**

Run: `pnpm dev` 후 브라우저에서 `/project/<id>/slides` → 페이지 생성 → 페이지 진입.
확인 항목:
1. 캔버스가 뜨고 도형을 그릴 수 있다.
2. 잠시 후 "저장됨" 표시가 뜬다.
3. 새로고침 시 그린 도형이 유지된다(= document 저장/로드 정상).
4. 코멘트 `(n)` 추가/수정/삭제가 동작한다.
5. "새 버전 만들기" → 캔버스 내용이 복사된 새 버전이 생기고 버전 셀렉터로 전환된다.

DB 확인(선택): `pnpm exec prisma studio`로 `slide.document`가 채워졌는지 본다.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "chore(slides): wiremd 렌더/미리보기/iframe 경로 제거"
```

---

## Self-Review

**Spec coverage (스펙 각 절 → 태스크):**
- §1 결정(Excalidraw/대체/document jsonb) → Task 1·2·3 전반.
- §2 데이터 모델(document 추가, content nullable, 다른 모델 불변) → Task 1.
- §3 저장 포맷(serializeAsJSON database) → Task 3 Step 2, Global Constraints.
- §4 컴포넌트(ssr:false, 뷰+편집 통합) → Task 3, Task 5.
- §5 Server Actions(updateSlideDocument, 생성/새버전) → Task 4.
- §6 화면 흐름(인덱스 불변, 자동저장 last-write-wins) → Task 5. (인덱스 `SlidesManager`/index `page.tsx`는 변경 없음 — 스펙과 일치, 태스크 불필요.)
- §7 제거 대상(wiremd.ts, render route, SlideFrame, SlideEditor 재작성, 의존성, next.config) → Task 2·5·6.
- §8 보안(HTML 주입 경로 소멸) → 자연 충족(캔버스 JSON 렌더, iframe/dangerouslySetInnerHTML 제거) — Task 5·6.
- §9 위험(Next16/React19/번들/jsonb) → Task 2 Step1(React19), Task 3 Step1(Next16 dynamic), Task 4(jsonb 상한), Task 6 Step4(빌드).
- §10 범위 밖 → 태스크 없음(의도적).

**Placeholder scan:** TBD/TODO/"적절히 처리" 없음. 코드 스텝은 실제 코드 포함.

**Type consistency:** `SceneDocument`(Task 3) → `page.tsx`/`SlideEditor`(Task 5)에서 동일 사용. `updateSlideDocument(slideId, document)`(Task 4) 시그니처 → `SlideEditor` 호출부 일치. `SlideActionResult`(기존) 반환 일관. `Prisma.InputJsonValue`/`Prisma.DbNull`(Task 4) 사용 일관.

**주의(구현 시 검증):** Prisma 클라이언트 import 경로(`@/generated/prisma`)와 Excalidraw 실제 타입 시그니처(`onChange`/`serializeAsJSON`/`initialData`)는 설치된 버전 기준으로 확인해 맞춘다.
