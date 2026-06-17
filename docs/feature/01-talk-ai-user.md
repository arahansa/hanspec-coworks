---
version: "1.0"
created: "2026-06-17"
updated: "2026-06-17"
author: "arahansa"
---

# 01. coworks ↔ Claude 양방향 대화 (Node Message 스레드)

> 웹 UI(사람)와 터미널 세션(Claude)이 한 요구사항(Node) 아래 **시간순 메시지 스레드**로
> 비동기 대화한다. Claude는 블로킹 대기하지 않고, `/loop`로 주기적으로 깨어나
> "내가 던진 질문에 답이 달렸나 / 새 지시가 있나"를 폴링해 작업을 이어간다.

## 1. 배경·문제

기존 `coworks-node-id` 스킬의 흐름은 **단방향**이다.

```
웹 UI에서 요구사항(node) 작성 → Claude 터미널이 API로 조회 → 끝까지 자동 처리 → DONE
```

스킬은 "되돌리기 어려운 외부 영향 외에는 사용자 확인 없이 끝까지 진행"하도록 되어 있다.
하지만 사람이 터미널에서 직접 Claude와 개발할 때는 다음과 같은 **결정/판단이 필요한 대화**가
자주 오간다.

- **구현 중 막힘 질문** — 요구사항이 모호하거나 선택지가 갈릴 때
  (예: "비로그인 사용자가 `/ranking`(백엔드 403)에 오면? 1. 로그인 유도, 2. mock 폴백, 3. 직접 입력")
- **완료 후 리뷰/승인** — 작업 결과를 보여주고 승인·수정 요청을 받음
- **자유 추가 지시** — 작업 도중 사용자가 "아 그리고 이것도" 같은 요청을 자유롭게 끼워 넣음

이 대화 채널을 **웹 UI ↔ 터미널 세션** 환경에서 성립시키는 것이 이 기능의 목표다.
(터미널 ↔ 터미널이 아니므로, 표준입출력으로 주고받을 수 없다.)

## 2. 핵심 설계 결정 (브레인스토밍 기록)

| # | 결정 사항 | 선택 | 비고 |
|---|-----------|------|------|
| 1 | 대화가 필요한 시점 | 구현 중 막힘 질문 + 완료 후 리뷰/승인 + 자유 추가 지시 | 중간 진행 보고는 제외 — **판단이 필요한 지점**만 |
| 2 | 터미널이 응답을 받는 방식 | **폴링**. 단 `/loop`로 세션을 시작해 주기적으로 깨어나 픽업 | 블로킹 대기·long-poll·MCP 대신, `/loop` 누적 처리 |
| 3 | 대화 데이터 위치 | **Node에 Message 스레드** | 한 요구사항(node) 아래 question·answer·instruction이 시간순으로 쌓임 |
| 4 | 웹 UI 응답 UX | **선택지 + 자유입력 하이브리드** | question이 options를 동반, 사용자는 버튼 또는 자유 텍스트로 답 |
| 5 | 작성 주체·인증 | **role 필드 + 기존 토큰 재사용** | `HANSPEC_COWORKS_ACCESSTOKEN` 그대로, role(CLAUDE/USER)로 구분 |
| 6 | Claude의 "읽음" 추적 | **상태 전이 + `consumedAt`** | ANSWERED question을 픽업 후 consume 처리해 중복 픽업 방지 |

## 3. 동작 흐름

```
[웹 UI: 사용자]                  [coworks 서버 / DB]               [터미널: Claude (/loop)]
      │                                 │                                 │
      │ 1. 요구사항(node) 작성 ────────▶│                                 │
      │                                 │◀── 2. node 조회, 작업 시작 ─────│
      │                                 │◀── 3. 막힘: QUESTION POST ──────│ (role=CLAUDE,
      │                                 │       (options 동반 가능)          status=PENDING)
      │                                 │                                 │ ── 턴 종료, 잠듦
      │ 4. 스레드에 질문 표시 ◀─────────│                                 │
      │    (선택지 버튼 + 자유입력)     │                                 │
      │ 5. 답변 제출 ──────────────────▶│ (ANSWER 생성,                   │
      │                                 │  부모 QUESTION → ANSWERED)      │
      │                                 │                                 │ ── /loop 깨어남
      │                                 │◀── 6. pending 폴링 GET ─────────│
      │                                 │ ── 7. 답변·지시 반환 ──────────▶│ 작업 재개
      │                                 │◀── 8. consume PATCH ────────────│ (consumedAt 기록)
```

3종 메시지가 한 스레드에 흐른다.

- **QUESTION** (role=CLAUDE): Claude가 막혀 던지는 질문. `options` 동반 가능. `PENDING`으로 시작.
- **ANSWER** (role=USER): 사용자가 QUESTION에 단 답. 생성 시 부모 QUESTION을 `ANSWERED`로 전환.
  버튼 클릭이면 `selectedOption`(인덱스), 자유 텍스트면 `body`.
- **INSTRUCTION** (role=USER): 사용자가 자발적으로 던지는 추가 지시. `PENDING`으로 시작,
  Claude가 픽업하면 `ACKNOWLEDGED` + `consumedAt`.

한 `/loop` 세션이 여러 node를 순회하며 "답 달린 질문 처리 + 새 지시 픽업"을 누적 수행한다.

### Claude의 폴링 로직 (`/loop` 1회)

```
1. GET /api/nodes/:id/messages/pending  (또는 내 작업 대상 전체)
   → ANSWERED·미consume QUESTION + PENDING INSTRUCTION 목록
2. 있으면: 답/지시를 받아 작업 재개 → 끝나면 PATCH로 consume
   없으면: 다음 node 확인 후 잠듦 (다음 /loop 주기 대기)
```

## 4. 데이터 모델 (Prisma)

```prisma
enum MessageRole {
  CLAUDE   // 터미널 세션이 작성
  USER     // 사람이 웹 UI에서 작성
}

enum MessageKind {
  QUESTION     // CLAUDE가 막혀 던지는 질문 (options 동반 가능)
  ANSWER       // USER가 QUESTION에 단 답
  INSTRUCTION  // USER가 자발적으로 던지는 추가 지시
}

enum MessageStatus {
  PENDING       // QUESTION: 답 대기 / INSTRUCTION: 픽업 대기
  ANSWERED      // QUESTION: 답이 달림
  ACKNOWLEDGED  // INSTRUCTION: Claude가 픽업함
}

model NodeMessage {
  id             Int            @id @default(autoincrement())
  nodeId         Int
  role           MessageRole
  kind           MessageKind
  status         MessageStatus?              // ANSWER는 상태 전이 없음(null)
  body           String         @db.Text      // 질문/답/지시 본문
  options        Json?                         // QUESTION의 선택지 배열
  selectedOption Int?                          // ANSWER가 고른 옵션 인덱스(자유입력이면 null)
  consumedAt     DateTime?                     // Claude가 픽업·처리한 시각 (중복 픽업 방지)
  parentId       Int?                          // ANSWER → 부모 QUESTION
  authorMemberId Int                           // 토큰 소유자(=작성 멤버)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  node    Node          @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  parent  NodeMessage?  @relation("MessageReply", fields: [parentId], references: [id])
  replies NodeMessage[] @relation("MessageReply")
  author  Member        @relation(fields: [authorMemberId], references: [id])

  @@index([nodeId, createdAt])
  @@index([status])     // 폴링 시 PENDING/ANSWERED 빠른 조회
}
```

`Node`, `Member`에는 역방향 관계(`messages NodeMessage[]`)가 추가된다.

### consume(읽음) 추적

- ANSWERED QUESTION을 `/loop`가 매번 다시 픽업하면 안 되므로, 픽업 후 `consumedAt`을 기록한다.
- 폴링 쿼리는 "QUESTION이고 status=ANSWERED이고 consumedAt=null" + "INSTRUCTION이고 status=PENDING"만 반환.
- INSTRUCTION은 consume 시 status를 `ACKNOWLEDGED`로 함께 전이한다.

## 5. API 엔드포인트

기존 토큰 인증(`authenticateRequest` + `authorizeProjectAccess`)과 `force-dynamic` 패턴을 따른다.

| 메서드·경로 | 주체 | 설명 |
|------------|------|------|
| `POST /api/nodes/:id/messages` | CLAUDE | QUESTION 또는 INSTRUCTION 생성. body·kind·options? |
| `GET /api/nodes/:id/messages` | 양쪽 | 해당 node의 전체 스레드 조회(시간순). 웹 UI 표시용 |
| `GET /api/nodes/:id/messages/pending` | CLAUDE | 미consume ANSWERED QUESTION + PENDING INSTRUCTION만 |
| `POST /api/messages/:id/answer` | USER | QUESTION에 ANSWER 생성. `{ selectedOption? , body? }`. 부모 → ANSWERED |
| `PATCH /api/messages/:id/consume` | CLAUDE | 픽업 완료 표시. `consumedAt` 기록, INSTRUCTION이면 `ACKNOWLEDGED` |

### 상태·검증 규칙

- `POST /api/messages/:id/answer`: 대상이 QUESTION이 아니거나 이미 ANSWERED면 `422`.
  `selectedOption`·`body` 중 최소 하나 필요.
- `PATCH /api/messages/:id/consume`: 이미 consume된 메시지면 멱등 처리(`ok:true`, 변경 없음).
- 권한: 모든 엔드포인트는 토큰 소유 멤버가 해당 node의 프로젝트 소속이어야 한다(SUPER 우회).
- 인증 실패 `401`, 프로젝트 권한 없음 `403`, 잘못된 상태/입력 `422`.

## 6. 산출 코드 (예정)

| 파일 | 역할 |
|------|------|
| `prisma/schema.prisma` | `MessageRole`/`MessageKind`/`MessageStatus` enum, `NodeMessage` 모델 |
| `src/app/api/nodes/[id]/messages/route.ts` | POST(생성)·GET(스레드 조회) |
| `src/app/api/nodes/[id]/messages/pending/route.ts` | GET(폴링 대상) |
| `src/app/api/messages/[id]/answer/route.ts` | POST(답변) |
| `src/app/api/messages/[id]/consume/route.ts` | PATCH(consume) |
| `src/lib/message.ts` | 메시지 검증·상태 전이 헬퍼 |

## 7. 향후 과제 (YAGNI 차단 — 이번 범위 밖)

- 웹 UI 컴포넌트(스레드 표시·답변 폼)는 별도 작업으로 분리.
- `coworks-node-id` 스킬에 폴링·질문 단계 추가는 본 API 완성 후 반영.
- node 없는 자유 대화, 다중 node를 묶는 세션 단위 대화는 현재 범위에 포함하지 않는다.

## 참조

- `../apis/01-node.md` — 토큰 인증·Node API 패턴
- `../../CLAUDE.md` — coworks 프로젝트 개요
- `../../../coworks-skill/coworks/skills/coworks-node-id/SKILL.md` — 단방향 자동화 스킬(대체·확장 대상)
