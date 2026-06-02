---
version: "1.0"
created: "2026-06-02"
updated: "2026-06-02"
author: "arahansa"
---

# 액세스 토큰 기반 Node 조회 API 설계

## 배경

다른 프로젝트(서버/프론트 레포 등)에서 요구사항 id 하나로 그 요구사항과 상위
기능(FEATURE)·모듈(MODULE) 정보까지 한 번에 가져오고 싶다. 호출 측은 자신의
`.env`에 `HANSPEC_COWORKS_ACCESSTOKEN`과 coworks 서버 주소를 두고 HTTP로
coworks API를 호출한다.

참조:
- `docs/apis/01-node.md` — 요구사항
- `docs/domain/08-access_token.md` — 액세스 토큰 도메인
- `docs/domain/04-node.md` / `03-node.md` — Node(MODULE→FEATURE→REQUIREMENT) 구조

## 목표 (문서가 요구한 두 축)

1. **coworks가 API를 제공한다.** 액세스 토큰으로 인증하고, 노드 id로 MFR 정보를 반환.
2. **다른 프로젝트가 호출한다.** 호출 방법(서버 주소·토큰 헤더·응답 스키마)을 문서화.

## 결정 사항

| 항목 | 결정 |
|------|------|
| API 경로 | `GET /api/nodes/[id]` (노드 일반 경로. REQUIREMENT면 상위까지 조립) |
| 인증 | `Authorization: Bearer <token>` — 토큰 유효성(만료 7일) + **프로젝트 소속** 검증 |
| 소속 모델 | `ProjectMember` 조인 테이블 신규 추가 |
| 산출물 | API 구현 + 호출 방법 문서 |

## 설계

### 1. 멤버-프로젝트 소속 (`ProjectMember`)

현재 도메인엔 멤버-프로젝트 소속 관계가 없다. 토큰 소유 멤버가 조회 대상 노드의
프로젝트에 소속됐는지 검증하려면 조인이 필요하다.

```prisma
model ProjectMember {
  projectId Int
  memberId  Int
  joinedAt  DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  member  Member  @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@id([projectId, memberId])
  @@map("project_member")
}
```

- `Project.members ProjectMember[]`, `Member.projects ProjectMember[]` 역참조 추가.
- 마이그레이션으로 빈 테이블 생성.
- **주의**: 기존 데이터엔 소속 행이 없으므로, 검증을 켜면 모든 호출이 막힌다.
  → 마이그레이션과 함께 **기존 멤버를 모든 프로젝트에 백필**하는 시드 또는,
    SUPER 멤버는 소속 검증을 우회하는 규칙을 둔다(아래 "소속 백필" 참고).
- 소속을 관리하는 UI는 이번 범위 밖(추후 admin에서). 우선 백필로 동작 보장.

### 2. 토큰 인증 헬퍼 (`src/lib/access-token.ts`에 추가)

기존 헬퍼는 `userId`로 조회한다. API는 반대로 **토큰 문자열로 멤버를 찾는다.**

```ts
// 토큰 문자열로 유효한 멤버 id를 반환. 없거나 만료면 null.
export async function authenticateByToken(token: string): Promise<number | null>
```

- `prisma.accessToken.findFirst({ where: { token }, select: { userId, createdAt } })`
- `isExpired(createdAt)`이면 null.
- **보안 노트**: 현재 토큰은 평문 저장. API로 외부 노출되므로 향후 해시 저장(SHA-256)
  전환을 권장한다. 이번 범위에선 평문 유지하되 본 문서에 한계로 명시.

### 3. 조회 로직 — REQUIREMENT에서 상위로

```ts
const node = await prisma.node.findUnique({
  where: { id },
  select: {
    id, name, level, description, status, endpoint, version, projectId,
    parent: { select: { id, name, level, description, endpoint,
      parent: { select: { id, name, level, description } } } },
  },
});
```

- `level`에 따라 응답을 조립한다.
  - REQUIREMENT: 자신 + `parent`(FEATURE) + `parent.parent`(MODULE)
  - FEATURE: 자신 + `parent`(MODULE) (requirement는 null)
  - MODULE: 자신만
- 노드 없음 → 404. 토큰 멤버가 `node.projectId`에 소속 아님 → 403.

### 4. API 라우트 (`src/app/api/nodes/[id]/route.ts`)

```
GET /api/nodes/:id
Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
```

처리 순서:
1. `Authorization` 헤더에서 Bearer 토큰 추출 → 없으면 401.
2. `authenticateByToken` → null이면 401(만료/무효).
3. 노드 조회 → 없으면 404.
4. `ProjectMember`로 (memberId, node.projectId) 소속 확인 → 아니면 403.
   (SUPER 멤버는 우회.)
5. level에 맞게 module/feature/requirement 조립 후 200.

응답 예시(요구사항 조회 시):
```json
{
  "ok": true,
  "requirement": { "id": 75, "name": "...", "description": "...", "status": "IN_PROGRESS", "version": 3 },
  "feature":     { "id": 60, "name": "...", "endpoint": "GET /api/...", "description": "..." },
  "module":      { "id": 12, "name": "...", "description": "..." },
  "projectId": 6
}
```
에러: `{ "ok": false, "error": "..." }` + 상태코드(401/403/404).

### 5. 소속 백필

마이그레이션 직후 기존 멤버가 막히지 않도록, 둘 중 하나:
- (A) SUPER 멤버는 소속 검증 우회 + 일반 멤버는 admin에서 소속 부여(추후).
- (B) 마이그레이션과 함께 "모든 멤버 × 모든 프로젝트" 백필(개발 단계 한정).

→ 우선 **(A)**: 라우트에서 토큰 멤버 grade가 SUPER면 소속 검사 생략. 일반 멤버
소속 UI는 추후. (현재 단일/소수 사용자 환경에 적합.)

## 호출 측 문서 (`docs/apis/01-node.md`에 보강)

- 서버 주소: `https://hanspec-coworks.vercel.app` (배포 기준). 호출 측 `.env`에
  `HANSPEC_COWORKS_BASE_URL`로 두는 것을 권장.
- 토큰: 호출 측 `.env`의 `HANSPEC_COWORKS_ACCESSTOKEN` (coworks `/me`에서 발급).
- 예시:
```bash
curl -H "Authorization: Bearer $HANSPEC_COWORKS_ACCESSTOKEN" \
  "$HANSPEC_COWORKS_BASE_URL/api/nodes/75"
```
```ts
const res = await fetch(`${base}/api/nodes/${reqId}`, {
  headers: { Authorization: `Bearer ${process.env.HANSPEC_COWORKS_ACCESSTOKEN}` },
});
const data = await res.json();
```

## 범위 밖(차후 과제)

- 멤버-프로젝트 소속 관리 UI(admin).
- 토큰 해시 저장 전환.
- 노드 설명의 `{{환경변수명}}` 치환(07-environment.md 연계).

## 산출 예정 코드

- `prisma/schema.prisma` — `ProjectMember` 모델 + 역참조
- `prisma/migrations/...` — 마이그레이션
- `src/lib/access-token.ts` — `authenticateByToken` 추가
- `src/app/api/nodes/[id]/route.ts` — GET 라우트
- `docs/apis/01-node.md` — 호출 방법 보강
