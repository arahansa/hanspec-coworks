---
version: "1.0"
created: "2026-06-02"
updated: "2026-06-02"
author: "arahansa"
---

# 액세스 토큰 발급/재갱신 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 멤버가 `/me` 페이지에서 로컬(CLI/MCP)용 액세스 토큰을 발급·재갱신하고, 발급일·7일 만료를 확인할 수 있게 한다.

**Architecture:** Prisma에 `access_token` 테이블(`AccessToken` 모델, 멤버당 1개 `userId @unique`)을 추가하고, server-only 유틸(`src/lib/access-token.ts`)에서 토큰 생성·조회·만료 파생 계산을 담당한다. `/me`(Server Component)에 토큰 섹션을 추가하고, 발급/재갱신은 `upsert` 기반 Server Action으로 처리한다. 토큰 복사 UI만 작은 Client Component로 분리한다.

**Tech Stack:** Next.js 16(App Router, Server Actions), TypeScript, Prisma 7(`@prisma/adapter-pg`), PostgreSQL, Tailwind CSS v4, `node:crypto`.

**검증 방식:** 이 프로젝트엔 테스트 프레임워크가 없고 기존 코드도 무테스트다. TDD/유닛테스트 대신 **dev 서버에서의 수동 검증**으로 확인한다(기존 관행 유지, YAGNI).

**참조 spec:** `docs/superpowers/specs/2026-06-02-access-token-design.md`

---

## File Structure

| 경로 | 책임 | 생성/수정 |
|------|------|-----------|
| `prisma/schema.prisma` | `AccessToken` 모델 + `Member.accessToken` 역참조 | 수정 |
| `prisma/migrations/*_add_access_token/migration.sql` | 테이블 생성 마이그레이션 | 자동 생성 |
| `src/lib/access-token.ts` | 토큰 문자열 생성·만료 파생 계산·조회 (server-only) | 생성 |
| `src/app/(auth)/me/actions.ts` | `issueAccessToken` Server Action (upsert) | 생성 |
| `src/app/(auth)/me/AccessTokenField.tsx` | 토큰 평문 표시 + 복사 버튼 (Client Component) | 생성 |
| `src/app/(auth)/me/page.tsx` | 액세스 토큰 섹션 추가 | 수정 |

---

## Chunk 1: 데이터 모델 + 토큰 유틸

### Task 1: AccessToken 모델 추가 + 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma` (Member 모델에 역참조 추가, 파일 끝에 AccessToken 모델 추가)
- Create(자동): `prisma/migrations/*_add_access_token/migration.sql`

- [ ] **Step 1: Member 모델에 역참조 필드 추가**

`prisma/schema.prisma`의 `Member` 모델(현재 `updatedAt DateTime @updatedAt` 다음 줄)에 추가:

```prisma
model Member {
  id        Int         @id @default(autoincrement())
  username  String      @unique @db.VarChar(20)
  password  String // bcrypt 해시 저장
  grade     MemberGrade @default(GENERAL)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  accessToken AccessToken?
}
```

- [ ] **Step 2: AccessToken 모델을 schema.prisma 끝에 추가**

```prisma
/// 멤버가 로컬(CLI/MCP) 환경에서 사용할 액세스 토큰. 멤버당 1개.
/// 유효기간(7일)은 컬럼이 아니라 createdAt 기준으로 애플리케이션에서 파생 계산한다.
/// 참조: docs/domain/08-access_token.md
model AccessToken {
  id        Int      @id @default(autoincrement())
  token     String // 액세스 토큰 문자열 (제약 없음)
  createdAt DateTime @default(now()) // 발급일
  userId    Int      @unique // member.id FK, 1인 1토큰

  member Member @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("access_token")
}
```

- [ ] **Step 3: 마이그레이션 생성·적용**

Run: `pnpm exec prisma migrate dev --name add_access_token`
Expected: 마이그레이션 SQL 생성, `access_token` 테이블 + `userId` unique 인덱스 + member FK 생성. Prisma client 재생성 성공. 에러 없이 종료.

- [ ] **Step 4: 생성된 client에 AccessToken 모델 반영 확인**

Run: `ls src/generated/prisma/models/ | grep -i AccessToken`
Expected: `AccessToken.ts` 가 존재.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: access_token 테이블 추가(AccessToken 모델·마이그레이션)"
```

---

### Task 2: 토큰 생성·조회 유틸 (`src/lib/access-token.ts`)

**Files:**
- Create: `src/lib/access-token.ts`

기존 `src/lib/auth.ts`의 server-only + `node:crypto` + Prisma 사용 패턴을 따른다.

- [ ] **Step 1: 유틸 모듈 작성**

`src/lib/access-token.ts` 전체:

```ts
// 참조: docs/domain/08-access_token.md (v1.0) — 액세스 토큰 발급/조회
//
// 멤버당 1개의 액세스 토큰. 유효기간은 발급일(createdAt)로부터 7일이며,
// 만료 컬럼 없이 애플리케이션에서 파생 계산한다.
import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** 액세스 토큰 유효기간(일). */
export const TOKEN_TTL_DAYS = 7;

const TOKEN_TTL_MS = TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

/** 임의의 액세스 토큰 문자열을 생성한다. */
export function generateTokenString(): string {
  return randomBytes(32).toString("base64url");
}

/** 발급일 기준 만료 시각을 계산한다. */
export function expiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + TOKEN_TTL_MS);
}

/** 발급일 기준 현재 만료 여부를 반환한다. */
export function isExpired(createdAt: Date): boolean {
  return Date.now() > expiresAt(createdAt).getTime();
}

export type AccessTokenView = {
  token: string;
  createdAt: Date;
  expiresAt: Date;
  expired: boolean;
};

/**
 * 멤버의 현재 액세스 토큰을 조회한다. 없으면 null.
 * 만료 시각·만료 여부를 파생 계산해 함께 반환한다.
 */
export async function getAccessToken(
  userId: number,
): Promise<AccessTokenView | null> {
  const row = await prisma.accessToken.findUnique({
    where: { userId },
    select: { token: true, createdAt: true },
  });
  if (!row) return null;

  return {
    token: row.token,
    createdAt: row.createdAt,
    expiresAt: expiresAt(row.createdAt),
    expired: isExpired(row.createdAt),
  };
}
```

- [ ] **Step 2: 타입 체크로 검증**

Run: `pnpm exec tsc --noEmit`
Expected: `src/lib/access-token.ts` 관련 에러 없음. (기존 코드의 무관한 에러가 있더라도 이 파일 관련 에러가 없으면 통과)

- [ ] **Step 3: Commit**

```bash
git add src/lib/access-token.ts
git commit -m "feat: 액세스 토큰 생성·조회 유틸 추가"
```

---

## Chunk 2: Server Action + UI

### Task 3: 발급/재갱신 Server Action (`src/app/(auth)/me/actions.ts`)

**Files:**
- Create: `src/app/(auth)/me/actions.ts`

기존 `src/app/(auth)/actions.ts`의 `"use server"` + `getCurrentMember`/redirect 패턴을 따른다.

- [ ] **Step 1: 액션 작성**

`src/app/(auth)/me/actions.ts` 전체:

```ts
// 참조: docs/domain/08-access_token.md (v1.0) — 액세스 토큰 발급/재갱신
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { generateTokenString } from "@/lib/access-token";

/**
 * 현재 로그인한 멤버의 액세스 토큰을 발급(없으면 생성, 있으면 교체)한다.
 * 멤버당 1개(userId unique)이므로 upsert로 발급/재갱신을 함께 처리한다.
 */
export async function issueAccessToken(): Promise<void> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const token = generateTokenString();
  await prisma.accessToken.upsert({
    where: { userId: member.id },
    create: { userId: member.id, token },
    // 재갱신: 토큰 문자열을 새로 발급하고 발급일을 현재로 갱신.
    update: { token, createdAt: new Date() },
  });

  revalidatePath("/me");
}
```

- [ ] **Step 2: 타입 체크로 검증**

Run: `pnpm exec tsc --noEmit`
Expected: `actions.ts` 관련 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/me/actions.ts"
git commit -m "feat: 액세스 토큰 발급/재갱신 Server Action 추가"
```

---

### Task 4: 토큰 표시 Client Component (`AccessTokenField.tsx`)

**Files:**
- Create: `src/app/(auth)/me/AccessTokenField.tsx`

복사 인터랙션만 클라이언트로 분리한다. 페이지 나머지는 Server Component 유지.

- [ ] **Step 1: 컴포넌트 작성**

`src/app/(auth)/me/AccessTokenField.tsx` 전체:

```tsx
// 참조: docs/domain/08-access_token.md (v1.0) — 토큰 평문 표시 + 복사
"use client";

import { useState } from "react";

/** 액세스 토큰을 평문으로 표시하고 클립보드 복사를 제공한다. */
export function AccessTokenField({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없으면 무시 — 사용자가 직접 선택해 복사할 수 있다.
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1.5 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {token}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크로 검증**

Run: `pnpm exec tsc --noEmit`
Expected: `AccessTokenField.tsx` 관련 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/me/AccessTokenField.tsx"
git commit -m "feat: 액세스 토큰 표시·복사 컴포넌트 추가"
```

---

### Task 5: /me 페이지에 액세스 토큰 섹션 추가

**Files:**
- Modify: `src/app/(auth)/me/page.tsx`

- [ ] **Step 1: import 및 데이터 조회 추가**

`page.tsx` 상단에 **신규 import만** 추가한다. `getCurrentMember`(`@/lib/auth`)와 `redirect`는 이미 import되어 있으므로 중복 추가하지 말 것.

```tsx
import { getAccessToken, TOKEN_TTL_DAYS } from "@/lib/access-token";
import { issueAccessToken } from "./actions";
import { AccessTokenField } from "./AccessTokenField";
```

`MePage` 함수 본문에서 member 확인 직후 토큰 조회 추가:

```tsx
export default async function MePage() {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const accessToken = await getAccessToken(member.id);
  // ...
```

- [ ] **Step 2: 토큰 섹션 JSX 추가**

기존 `<dl>` 블록(등급 표시) 다음, SUPER 링크 블록 앞에 액세스 토큰 섹션을 삽입한다. 날짜 포맷은 `toLocaleDateString("ko-KR")` 사용.

```tsx
      <section className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          액세스 토큰
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          로컬(CLI/MCP) 환경에서 사용합니다. 유효기간은 발급일로부터 {TOKEN_TTL_DAYS}일입니다.
        </p>

        {accessToken ? (
          <div className="mt-3 space-y-3">
            <AccessTokenField token={accessToken.token} />
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">발급일</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">
                  {accessToken.createdAt.toLocaleDateString("ko-KR")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">만료일</dt>
                <dd className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                  {accessToken.expiresAt.toLocaleDateString("ko-KR")}
                  {accessToken.expired && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                      만료됨
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            <form action={issueAccessToken}>
              <button
                type="submit"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                재갱신
              </button>
            </form>
          </div>
        ) : (
          <form action={issueAccessToken} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              발급받기
            </button>
          </form>
        )}
      </section>
```

- [ ] **Step 3: 타입 체크로 검증**

Run: `pnpm exec tsc --noEmit`
Expected: `page.tsx` 관련 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(auth)/me/page.tsx"
git commit -m "feat: /me 페이지에 액세스 토큰 발급/재갱신 UI 추가"
```

---

### Task 6: 수동 검증 (dev 서버)

**Files:** (없음 — 동작 확인만)

> dev 서버 기동은 `/dev-server` 스킬을 사용한다. DB(`postgres-common`, 포트 5433)가 떠 있어야 한다.

- [ ] **Step 1: dev 서버 기동 및 로그인**

`pnpm dev` 후 로그인하여 `/me` 진입.
Expected: 토큰이 없으면 "액세스 토큰이 없습니다" 영역 없이 **"발급받기"** 버튼 + 안내 문구(유효기간 7일) 노출.

- [ ] **Step 2: 발급 확인**

"발급받기" 클릭.
Expected: 토큰 평문(`font-mono`), 발급일(오늘), 만료일(오늘+7일) 표시. "복사" 버튼 동작(클릭 시 "복사됨"). 버튼이 **"재갱신"**으로 변경.

- [ ] **Step 3: 재갱신 확인**

"재갱신" 클릭.
Expected: 토큰 문자열이 이전과 다른 값으로 변경. 발급일이 현재로 갱신(만료일도 재계산).

- [ ] **Step 4: DB 확인 (1인 1토큰)**

`access_token` 테이블에서 해당 `user_id`의 row가 **1개만** 존재하는지 확인.
Run(예): `docker exec -i postgres-common psql -U postgres -d coworks -c "SELECT user_id, count(*) FROM access_token GROUP BY user_id;"`
Expected: 각 user_id당 count = 1.

- [ ] **Step 5: 비로그인 접근 확인**

로그아웃 상태에서 `/me` 직접 접근.
Expected: `/signin`으로 redirect (기존 동작 유지).
