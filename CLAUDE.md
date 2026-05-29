@AGENTS.md

# coworks — HanSpec 협업 워크스페이스

## 프로젝트 개요

`standalone`(단일 사용자 로컬 MFR 뷰어)을 대체하는 **다중 사용자 협업 웹 앱**.
여러 명이 동시에 접속해 MFR(Module→Feature→Requirement) 데이터를 조회·편집한다.

- **DB가 단일 진실 공급원(SSOT)**: standalone과 달리 MD 파일이 아닌 DB에 데이터를 저장한다.
- **차후 과제**: 기존 MD 파일에서 DB로 동기화(import)하는 기능, NextAuth(Auth.js) 기반 앱 자체 인증.

## 기술 스택

- **Framework**: Next.js 16 (App Router, Turbopack) + TypeScript
- **Styling**: Tailwind CSS v4
- **DB**: PostgreSQL (로컬 개발은 Docker 컨테이너, 차후 Supabase 이전)
- **ORM**: Prisma 7 (driver adapter `@prisma/adapter-pg`)
- **Node**: 24 LTS (`.nvmrc`) — Prisma 7이 20.19+/22.12+/24+ 요구
- **패키지 매니저**: pnpm

## 로컬 개발

```bash
nvm use            # .nvmrc → Node 24
pnpm install
pnpm dev           # http://localhost:3000
```

- 첫 페이지(`/`)가 DB 연결 상태를 표시하고, `/api/health`가 `SELECT NOW()`로 연결을 검증한다.
- 로컬 PostgreSQL: Docker 컨테이너 `postgres-common`(postgres:15-alpine), 호스트 포트 **5433**, DB명 `coworks`.
- 접속 정보는 `.env`의 `DATABASE_URL`. 예시는 `.env.example` 참고.

## Prisma (v7 주의사항)

- 연결 URL은 schema.prisma의 `datasource.url`이 아니라 **`prisma.config.ts`(CLI) + PrismaClient 어댑터(런타임)**에서 관리.
- 클라이언트 출력 위치: `src/generated/prisma/` (git ignore 대상).
- 런타임 클라이언트 싱글턴: `src/lib/prisma.ts`.
- 마이그레이션: `pnpm exec prisma migrate dev --name <name>`.

## 디렉터리

| 경로 | 설명 |
|------|------|
| `src/app/page.tsx` | 첫 페이지 (DB 연결 상태 표시) |
| `src/app/api/health/route.ts` | DB 연결 검증 엔드포인트 |
| `src/lib/prisma.ts` | PrismaClient 싱글턴 (pg 어댑터) |
| `prisma/schema.prisma` | 스키마 (현재 검증용 `HealthCheck` 모델만 존재) |

## 참조

- **루트 워크스페이스**: `../CLAUDE.md`
- **HanSpec 설계 철학·MFR 도메인**: `../website-docs/CLAUDE.md`
