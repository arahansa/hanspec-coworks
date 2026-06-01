---
version: "1.0"
created: "2026-06-02"
updated: "2026-06-02"
author: "arahansa"
---

# 액세스 토큰 발급/재갱신 설계

## 배경

사용자가 로컬 개발 환경(CLI/MCP)에서 coworks의 요구사항을 조회하거나 Task를
생성하는 등 로그인 상태에서 가능한 작업을 수행하려면, 화면 로그인 대신 사용할
인증 수단이 필요하다. 이를 위해 멤버가 `/me`(내 정보) 페이지에서 **액세스 토큰**을
발급받을 수 있게 한다.

참조:
- `docs/domain/08-access_token.md` — 액세스 토큰 도메인 정의
- `docs/domain/02-member.md` — 멤버 인증/세션

## 범위

이번 작업의 범위는 **발급/재갱신 UI + DB**까지로 한정한다.

1. **`AccessToken` 모델** — Prisma schema에 추가 + 마이그레이션. 테이블명은 문서
   요구대로 `access_token`.
2. **토큰 생성·조회 유틸** — `src/lib/access-token.ts` (server-only).
3. **Server Action** — `/me`에서 발급/재갱신을 처리.
4. **UI** — `/me` 페이지에 액세스 토큰 섹션 추가.

CLI/MCP의 토큰 검증·실제 스크립트는 **이번 범위에서 제외**한다(차후 과제).

## 정책

- **1인 1토큰**: 멤버당 최대 1개의 토큰만 보유한다. 재갱신 시 기존 토큰을 교체한다.
  (`userId @unique` 로 DB 레벨에서 보장)
- **유효기간 7일**: 발급일(`createdAt`)로부터 7일. 만료 컬럼을 두지 않고
  `createdAt + 7일`로 파생 계산한다.
- **평문 노출**: 토큰은 CLI에 복사해 쓰는 용도이므로 `/me` 화면에 평문 그대로
  노출한다(별도 해싱·마스킹 없음).

## 데이터 모델

`docs/domain/08-access_token.md` 테이블 스펙을 따른다.

```prisma
/// 멤버가 로컬(CLI/MCP) 환경에서 사용할 액세스 토큰. 멤버당 1개.
/// 참조: docs/domain/08-access_token.md
model AccessToken {
  id        Int      @id @default(autoincrement())
  token     String                    // 액세스 토큰 문자열 (제약 없음)
  createdAt DateTime @default(now())   // 발급일
  userId    Int      @unique           // member.id FK, 1인 1토큰

  member Member @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("access_token")
}
```

`Member` 모델에 역참조를 추가한다.

```prisma
model Member {
  // ...기존 필드
  accessToken AccessToken?
}
```

- 유효기간(7일)은 컬럼이 아니라 애플리케이션에서 파생 계산한다.
- `onDelete: Cascade` — 멤버 삭제 시 토큰도 삭제.

## 토큰 생성·조회 유틸 (`src/lib/access-token.ts`)

server-only 모듈. `node:crypto` 사용.

- `TOKEN_TTL_DAYS = 7` — 유효기간 상수.
- `generateTokenString(): string` — `randomBytes(32).toString("base64url")`로
  임의 토큰 생성.
- `expiresAt(createdAt: Date): Date` — `createdAt + 7일`.
- `isExpired(createdAt: Date): boolean` — 현재 시각 기준 만료 여부.
- `getAccessToken(userId): Promise<{ token, createdAt, expiresAt, expired } | null>` —
  현재 토큰 조회 + 파생 값 계산. 없으면 null.

## Server Action (`src/app/(auth)/me/actions.ts`)

```ts
"use server";
export async function issueAccessToken(): Promise<void>
```

- `getCurrentMember()`로 로그인 멤버 확인. 비로그인 시 `/signin` redirect.
- `prisma.accessToken.upsert({ where: { userId }, ... })`로 발급/재갱신을 한
  액션으로 처리. 발급 시 `token`·`createdAt` 모두 새 값으로 갱신.
- `revalidatePath("/me")`.

발급과 재갱신은 동일 액션(upsert)으로 처리한다 — 버튼 라벨만 토큰 존재 여부에
따라 다르게 표시한다.

## UI (`/me` 페이지 확장)

기존 `me/page.tsx`(Server Component)에 **액세스 토큰 섹션**을 추가한다. 기존
`AuthCard`/Tailwind 톤을 유지한다.

- **토큰 없음**: "액세스 토큰이 없습니다." 안내 + **"발급받기"** 버튼.
- **토큰 있음**: 토큰 문자열(`font-mono`, 줄바꿈/복사 가능), 발급일, 만료일,
  만료 여부 배지 + **"재갱신"** 버튼.
- 발급/재갱신 버튼은 `issueAccessToken` Server Action을 호출하는 `<form>`.
  (기존 `signOut` 폼 패턴과 동일)
- 복사 편의를 위해 토큰을 `<code>`/`readonly input` 형태로 선택 가능하게 표시한다.

복사 버튼은 클라이언트 인터랙션이 필요하므로, 토큰 표시 영역만 작은 Client
Component(`AccessTokenField`)로 분리한다. 나머지 페이지는 Server Component 유지.

## 마이그레이션

```bash
pnpm exec prisma migrate dev --name add_access_token
```

`access_token` 테이블 생성 + `userId` unique 인덱스 + member FK.

## 테스트·검증

- 마이그레이션 적용 후 Prisma client 재생성 확인.
- `/me`에서: 발급 → 토큰 표시 → 재갱신 시 토큰 문자열/발급일 변경 → 만료일 표시
  확인.
- 비로그인 상태에서 action 호출 시 `/signin`으로 redirect 되는지 확인.

## 산출 코드 (예정)

- `prisma/schema.prisma` — `AccessToken` 모델, `Member.accessToken`
- `prisma/migrations/*_add_access_token/migration.sql`
- `src/lib/access-token.ts`
- `src/app/(auth)/me/actions.ts`
- `src/app/(auth)/me/AccessTokenField.tsx`
- `src/app/(auth)/me/page.tsx` (수정)
