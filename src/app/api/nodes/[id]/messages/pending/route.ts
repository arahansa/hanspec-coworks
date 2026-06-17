// 참조: docs/feature/01-talk-ai-user.md (v1.0)
// 액세스 토큰 기반 Claude 폴링 엔드포인트.
// 해당 node에서 Claude가 아직 처리하지 않은 항목만 반환한다:
//  - ANSWERED 상태이고 consumedAt이 null인 QUESTION (= 답이 달렸으나 미픽업)
//  - PENDING 상태인 INSTRUCTION (= 사용자가 던진 미픽업 지시)
// /loop로 깨어난 세션이 이 목록을 받아 작업을 재개하고, 처리 후 consume PATCH를 호출한다.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authorizeProjectAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/nodes/:id/messages/pending
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 *
 * - 성공: 200 { ok: true, answers: [...], instructions: [...] }
 *   answers      — 답이 달린(미픽업) QUESTION. reply(=ANSWER) 포함.
 *   instructions — 미픽업 INSTRUCTION.
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

  const { id } = await params;
  const nodeId = Number(id);
  if (!Number.isInteger(nodeId)) {
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

  // 답이 달렸으나 아직 픽업하지 않은 QUESTION + 그에 달린 답(ANSWER).
  const answers = await prisma.nodeMessage.findMany({
    where: {
      nodeId: node.id,
      kind: "QUESTION",
      status: "ANSWERED",
      consumedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      options: true,
      createdAt: true,
      replies: {
        where: { kind: "ANSWER" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          selectedOption: true,
          createdAt: true,
        },
      },
    },
  });

  // 아직 픽업하지 않은 자유 지시.
  const instructions = await prisma.nodeMessage.findMany({
    where: {
      nodeId: node.id,
      kind: "INSTRUCTION",
      status: "PENDING",
      consumedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, body: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, answers, instructions });
}
