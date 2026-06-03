---
version: "1.1"
created: "2026-06-04"
updated: "2026-06-04"
author: "arahansa"
---

# coworks 연동 가이드 (호출하는 프로젝트용)

다른 프로젝트에서 `HANSPEC_COWORKS_ACCESSTOKEN`과 `HANSPEC_COWORKS_BASE_URL`을 사용해
coworks 서버의 API를 호출하기 위한 가이드.

> **이 문서의 위치**: coworks 레포 안에 있지만, **내용은 "호출하는 쪽(다른 프로젝트)"** 기준으로 적혀 있다.
> 연동하려는 프로젝트로 이 문서를 복사하거나 참조해서 사용하면 된다.
> coworks **서버 쪽** API 스펙(엔드포인트 구현·동작)은 [`01-node.md`](./01-node.md) 참조.

---

## TL;DR (AI 에이전트용 체크리스트)

연동을 셋업할 때 아래 순서대로 수행한다.

1. coworks `/me` 페이지에서 액세스 토큰을 발급받는다. (사람이 직접 수행 — 아래 [1단계](#1-액세스-토큰-발급-사람이-수행) 참조)
2. 호출하는 프로젝트의 `.env`에 두 변수를 추가한다.
   ```
   HANSPEC_COWORKS_BASE_URL=https://hanspec-coworks.vercel.app
   HANSPEC_COWORKS_ACCESSTOKEN=<1에서 발급한 토큰>
   ```
3. `.env.example`에도 키만(값 없이) 추가하고, `.env`가 `.gitignore`에 있는지 확인한다.
4. 호출 코드는 항상 `Authorization: Bearer <token>` 헤더를 붙인다. ([4단계](#4-호출-코드) 참조)
5. 응답은 `{ ok: boolean, ... }` 형태다. `ok === false`면 `error` 문자열을 확인해 처리한다.
6. **토큰은 발급일로부터 7일 후 만료된다.** `401 유효하지 않거나 만료된 토큰입니다.`가 오면 1단계로 재발급한다.

---

## 1. 액세스 토큰 발급 (사람이 수행)

토큰 발급은 로그인이 필요하므로 사람이 직접 수행한다. AI는 이 단계를 대신할 수 없다.

1. coworks 웹에 로그인한다.
2. `/me` 페이지로 이동한다.
3. 액세스 토큰을 발급(또는 재갱신)한다.
   - 멤버당 토큰은 **1개**다. 재발급하면 이전 토큰은 즉시 무효가 된다.
   - 유효기간은 **발급일로부터 7일**.
4. 발급된 토큰 문자열을 복사한다.

> **권한 주의**: 토큰은 "그 멤버"의 권한으로 동작한다.
> 대상 노드가 속한 **프로젝트에 멤버가 소속**되어 있어야 조회된다(`403` 방지).
> `SUPER` 등급 멤버는 소속 검증을 우회한다.

---

## 2. 환경 변수 설정

호출하는 프로젝트의 `.env`:

```dotenv
# coworks API 베이스 URL (배포 환경)
HANSPEC_COWORKS_BASE_URL=https://hanspec-coworks.vercel.app
# 로컬 coworks 서버를 띄워 테스트할 때
# HANSPEC_COWORKS_BASE_URL=http://localhost:3000

# coworks /me 에서 발급한 액세스 토큰 (7일 유효)
HANSPEC_COWORKS_ACCESSTOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`.env.example` (값 없이 키만, 커밋 대상):

```dotenv
HANSPEC_COWORKS_BASE_URL=
HANSPEC_COWORKS_ACCESSTOKEN=
```

> **보안**: 토큰은 현재 coworks DB에 평문 저장되며 외부로 노출되는 비밀값이다.
> 절대 커밋하지 말고, 클라이언트(브라우저) 번들에 노출되지 않는 **서버 측 환경 변수**로만 사용한다.
> (Next.js라면 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.)

---

## 3. 사용 가능한 엔드포인트

### `GET /api/nodes/:id` — 노드(요구사항/기능/모듈) 조회

요구사항 id 하나로 그 요구사항 + 상위 기능 + 상위 모듈을 한 번에 얻는다.

```
GET {HANSPEC_COWORKS_BASE_URL}/api/nodes/:id
Header: Authorization: Bearer {HANSPEC_COWORKS_ACCESSTOKEN}
```

**노드 레벨에 따른 응답 조립**:

| 대상 노드 level | module | feature | requirement |
|---|---|---|---|
| `REQUIREMENT` | ✅ | ✅ | ✅ |
| `FEATURE` | ✅ | ✅ | `null` |
| `MODULE` | ✅ | `null` | `null` |

**성공 응답** (요구사항 조회 예):

```json
{
  "ok": true,
  "level": "REQUIREMENT",
  "projectId": 6,
  "module":      { "id": 12, "name": "...", "description": "..." },
  "feature":     { "id": 60, "name": "...", "description": "...", "endpoint": "GET /api/..." },
  "requirement": { "id": 75, "name": "...", "description": "...", "status": "IN_PROGRESS", "version": 3 }
}
```

**에러 응답**: `{ "ok": false, "error": "..." }`

| status | 의미 | 대응 |
|---|---|---|
| `400` | 잘못된 노드 id | 호출 코드의 id 확인 |
| `401` | 토큰 없음/무효/만료 | 헤더 확인 → 만료면 토큰 재발급([1단계](#1-액세스-토큰-발급-사람이-수행)) |
| `403` | 프로젝트 접근 권한 없음 | 토큰 멤버를 대상 프로젝트에 소속시켜야 함 |
| `404` | 노드 없음 | id가 존재하는지 확인 |

> 엔드포인트 동작의 상세 구현은 [`01-node.md`](./01-node.md) 및
> `docs/superpowers/specs/2026-06-02-node-api-design.md` 참조.

### `POST /api/tasks` — REQUIREMENT 노드에 Task 생성

```
POST {HANSPEC_COWORKS_BASE_URL}/api/tasks
Header: Authorization: Bearer {HANSPEC_COWORKS_ACCESSTOKEN}
Header: Content-Type: application/json
```

요청 바디:

```json
{
  "nodeId": 21,
  "description": "비로그인 히어로 섹션 컴포넌트",
  "progress": 0,
  "name": "GuestHeroSection",
  "endpoint": "app/intro/_components/GuestHeroSection.tsx"
}
```

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `nodeId` | number | ✅ | 정수, **REQUIREMENT 레벨 노드** |
| `description` | string | ✅ | trim 후 비어있지 않을 것 |
| `progress` | number | ❌ | 정수 0~100, 기본 0 |
| `name` | string | ❌ | trim 후 ≤ 50자, 빈 값은 null |
| `endpoint` | string | ❌ | trim 후 ≤ 255자, 빈 값은 null |

성공 응답(`201`): `{ "ok": true, "taskId": 12 }`

에러: `400`(검증 실패), `401`(토큰), `403`(권한), `404`(노드 없음),
`422`(노드가 REQUIREMENT가 아님).

### `GET /api/nodes/:id/tasks` — 노드의 Task 목록 조회

등록 후 검증/멱등 처리에 사용. 인증/권한은 위와 동일.

```json
{
  "ok": true,
  "nodeId": 21,
  "tasks": [
    { "id": 12, "name": "GuestHeroSection", "endpoint": "app/intro/...", "description": "...", "progress": 0 }
  ]
}
```

---

## 4. 호출 코드

### curl

```bash
# 노드 조회
curl -H "Authorization: Bearer $HANSPEC_COWORKS_ACCESSTOKEN" \
  "$HANSPEC_COWORKS_BASE_URL/api/nodes/75"

# Task 생성
curl -X POST -H "Authorization: Bearer $HANSPEC_COWORKS_ACCESSTOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nodeId":21,"description":"...","name":"Foo","endpoint":"app/foo/Foo.tsx"}' \
  "$HANSPEC_COWORKS_BASE_URL/api/tasks"
```

### fetch (Node / TypeScript)

서버 측에서만 호출한다(토큰 노출 방지). 재사용 가능한 클라이언트 형태 예시:

```ts
// 호출하는 프로젝트의 lib/coworks.ts 등
const BASE = process.env.HANSPEC_COWORKS_BASE_URL;
const TOKEN = process.env.HANSPEC_COWORKS_ACCESSTOKEN;

type NodeSummary = { id: number; name: string; description: string | null };
type NodeResponse = {
  ok: true;
  level: "REQUIREMENT" | "FEATURE" | "MODULE";
  projectId: number;
  module: NodeSummary | null;
  feature: (NodeSummary & { endpoint: string | null }) | null;
  requirement: (NodeSummary & { status: string; version: number }) | null;
};

export async function fetchNode(id: number): Promise<NodeResponse> {
  if (!BASE || !TOKEN) {
    throw new Error("HANSPEC_COWORKS_BASE_URL / HANSPEC_COWORKS_ACCESSTOKEN 환경 변수가 필요합니다.");
  }
  const res = await fetch(`${BASE}/api/nodes/${id}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    // 캐시가 곤란하면 명시: cache: "no-store"
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`coworks ${res.status}: ${data.error}`);
  }
  return data as NodeResponse;
}
```

---

## 5. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `401 Authorization Bearer 토큰이 필요합니다.` | 헤더 누락/형식 오류 | `Authorization: Bearer <token>` 형식 확인 |
| `401 유효하지 않거나 만료된 토큰입니다.` | 토큰 무효 또는 7일 경과 | `/me`에서 재발급 후 `.env` 갱신 |
| `403 이 프로젝트에 접근 권한이 없습니다.` | 멤버가 대상 프로젝트 비소속 | 멤버를 프로젝트에 소속 (또는 SUPER 등급) |
| 연결 실패 / ECONNREFUSED | BASE_URL 오류 또는 로컬 서버 미기동 | URL 확인, 로컬이면 coworks dev 서버 기동 확인 |

---

## 6. 차후 과제 (스킬화)

이 가이드의 패턴이 안정되면 다음을 스킬로 추출한다.

- **연동 셋업 스킬**: `.env`/`.env.example`에 두 변수 주입, `lib/coworks.ts` 클라이언트 스캐폴딩, 헬스 체크 호출까지 자동화.
- **토큰 만료 감지/안내**: `401` 만료 응답 시 재발급 안내 흐름.

> 스킬화 전까지는 이 문서를 기준으로 수동/AI 보조 셋업을 수행한다.

---

## 참조

- coworks 서버 API 스펙: [`01-node.md`](./01-node.md)
- 액세스 토큰 도메인: `docs/domain/08-access_token.md`
- 설계 스펙: `docs/superpowers/specs/2026-06-02-node-api-design.md`
- 산출 코드: `src/app/api/nodes/[id]/route.ts`, `src/lib/access-token.ts`
