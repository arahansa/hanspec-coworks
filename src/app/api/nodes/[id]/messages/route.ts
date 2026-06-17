// 참조: docs/feature/01-talk-ai-user.md (v1.0)
// 액세스 토큰 기반 Node 메시지 스레드 API.
// - POST: CLAUDE가 QUESTION/INSTRUCTION을 등록한다.
// - GET : 해당 node의 전체 메시지 스레드(시간순)를 조회한다(웹 UI 표시용).
//
// 인증은 액세스 토큰(헤더) 기반이며 세션 쿠키(getCurrentMember)와는 별개다.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authorizeProjectAccess } from "@/lib/api-auth";
import { validateBody, validateCreateKind, validateOptions } from "@/lib/message";

export const dynamic = "force-dynamic";

type MessageCreateBody = {
  kind?: unknown;
  body?: unknown;
  options?: unknown;
};

/** 경로 파라미터에서 node id를 파싱한다. */
async function parseNodeId(
  params: Promise<{ id: string }>,
): Promise<number | null> {
  const { id } = await params;
  const nodeId = Number(id);
  return Number.isInteger(nodeId) ? nodeId : null;
}

/**
 * POST /api/nodes/:id/messages
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 * Body: { kind: "QUESTION" | "INSTRUCTION", body, options? }
 *
 * - 토큰 검증 → 노드 조회 → 프로젝트 소속 검증(SUPER 우회) → 생성.
 * - role은 CLAUDE 고정(이 엔드포인트는 터미널 세션이 질문/지시를 남기는 용도).
 * - 성공: 201 { ok: true, messageId }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  const nodeId = await parseNodeId(params);
  if (nodeId === null) {
    return NextResponse.json(
      { ok: false, error: "올바르지 않은 노드 id입니다." },
      { status: 400 },
    );
  }

  let payload: MessageCreateBody;
  try {
    payload = (await request.json()) as MessageCreateBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 본문(JSON)을 해석할 수 없습니다." },
      { status: 400 },
    );
  }

  const kindCheck = validateCreateKind(payload.kind);
  if (!kindCheck.ok) {
    return NextResponse.json(
      { ok: false, error: kindCheck.error },
      { status: 400 },
    );
  }
  const bodyCheck = validateBody(payload.body);
  if (!bodyCheck.ok) {
    return NextResponse.json(
      { ok: false, error: bodyCheck.error },
      { status: 400 },
    );
  }
  const optionsCheck = validateOptions(payload.options);
  if (!optionsCheck.ok) {
    return NextResponse.json(
      { ok: false, error: optionsCheck.error },
      { status: 400 },
    );
  }
  // options는 QUESTION에서만 의미가 있다.
  if (kindCheck.value === "INSTRUCTION" && optionsCheck.value !== null) {
    return NextResponse.json(
      { ok: false, error: "INSTRUCTION에는 options를 지정할 수 없습니다." },
      { status: 400 },
    );
  }

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { id: true, projectId: true },
  });
  if (!node) {
    return NextResponse.json(
      { ok: false, error: "존재하지 않는 노드입니다." },
      { status: 404 },
    );
  }

  const access = await authorizeProjectAccess(auth.memberId, node.projectId);
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  const message = await prisma.nodeMessage.create({
    data: {
      nodeId: node.id,
      role: "CLAUDE",
      kind: kindCheck.value,
      status: "PENDING",
      body: bodyCheck.value,
      options: optionsCheck.value ?? undefined,
      authorMemberId: auth.memberId,
    },
    select: { id: true },
  });

  return NextResponse.json(
    { ok: true, messageId: message.id },
    { status: 201 },
  );
}

/**
 * GET /api/nodes/:id/messages
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 *
 * - 해당 node의 전체 메시지 스레드를 시간순으로 반환한다.
 * - 성공: 200 { ok: true, messages: [...] }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  const nodeId = await parseNodeId(params);
  if (nodeId === null) {
    return NextResponse.json(
      { ok: false, error: "올바르지 않은 노드 id입니다." },
      { status: 400 },
    );
  }

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { id: true, projectId: true },
  });
  if (!node) {
    return NextResponse.json(
      { ok: false, error: "존재하지 않는 노드입니다." },
      { status: 404 },
    );
  }

  const access = await authorizeProjectAccess(auth.memberId, node.projectId);
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  const messages = await prisma.nodeMessage.findMany({
    where: { nodeId: node.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      kind: true,
      status: true,
      body: true,
      options: true,
      selectedOption: true,
      parentId: true,
      consumedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, messages });
}
