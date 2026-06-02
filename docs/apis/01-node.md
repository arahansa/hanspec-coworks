---
version: "1.1"
created: "2026-06-02"
updated: "2026-06-02"
author: "arahansa"
---

# 개요
특정 요구사항 id 를 가지고 오면 해당 요구사항의 모듈, 기능, 요구사항에 대한 정보까지 한번에 얻어오고 싶음.
이거를 .env 의 HANSPEC_COWORKS_ACCESSTOKEN 를 통해서 COWORKS의 API 를 호출해서 하고 싶어. 
이것을 위해서는 두 가지가 필요함 
1) coworks 에서는 api 가 지원되어야함. API 를 지원하려면 액세스토큰과 서버 주소를 알아야함.
2) 그리고 다른 프로젝트에서 이 API를 호출해야하며 어떻게 호출해야하는지 알아야함.

이거 어떻게 구현해야할까?

---

# 구현 (2026-06-02)

설계: `docs/superpowers/specs/2026-06-02-node-api-design.md`

## 엔드포인트

```
GET /api/nodes/:id
Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
```

- **인증**: 액세스 토큰(발급 7일 유효). coworks `/me` 페이지에서 발급.
- **권한**: 토큰 멤버가 대상 노드의 프로젝트에 소속되어 있어야 한다(SUPER 등급은 우회).
- **동작**: 노드 레벨에 따라 상위까지 한 번에 조립해서 반환.
  - REQUIREMENT → `requirement` + `feature` + `module`
  - FEATURE → `feature` + `module` (requirement=null)
  - MODULE → `module` (feature/requirement=null)

## 응답

성공(요구사항 조회 예):
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

에러: `{ "ok": false, "error": "..." }`
- `401` 토큰 없음/무효/만료
- `403` 프로젝트 접근 권한 없음
- `404` 노드 없음
- `400` 잘못된 id

## 호출 측(다른 프로젝트) 사용법

호출 측 `.env`:
```
HANSPEC_COWORKS_BASE_URL=https://hanspec-coworks.vercel.app
HANSPEC_COWORKS_ACCESSTOKEN=<coworks /me에서 발급한 토큰>
```

curl:
```bash
curl -H "Authorization: Bearer $HANSPEC_COWORKS_ACCESSTOKEN" \
  "$HANSPEC_COWORKS_BASE_URL/api/nodes/75"
```

fetch(Node/브라우저):
```ts
const base = process.env.HANSPEC_COWORKS_BASE_URL;
const token = process.env.HANSPEC_COWORKS_ACCESSTOKEN;
const res = await fetch(`${base}/api/nodes/${reqId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
if (!data.ok) throw new Error(data.error);
// data.requirement / data.feature / data.module
```

## 한계 / 차후 과제

- 토큰은 현재 평문 저장. 외부 노출되므로 향후 해시 저장 권장.
- 멤버-프로젝트 소속 관리 UI(admin)는 미구현. 현재는 전체 멤버를 백필해 둠.

## 산출 코드
- `src/app/api/nodes/[id]/route.ts` — GET 라우트
- `src/lib/access-token.ts` — `authenticateByToken`
- `prisma/schema.prisma` — `ProjectMember` 소속 모델

