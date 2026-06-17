// 참조: docs/feature/01-talk-ai-user.md (v1.0)
// 액세스 토큰 기반 consume(픽업 완료) API.
// Claude가 ANSWERED QUESTION 또는 PENDING INSTRUCTION을 처리한 뒤 호출한다.
//  - consumedAt을 기록해 다음 /loop 폴링에서 중복 픽업되지 않게 한다.
//  - INSTRUCTION이면 status를 ACKNOWLEDGED로 함께 전이한다.
//  - 이미 consume된 메시지면 멱등 처리(변경 없이 ok).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authorizeProjectAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/messages/:id/consume
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 *
 * - 대상은 QUESTION(ANSWERED) 또는 INSTRUCTION이어야 한다. ANSWER는 422.
 * - 성공: 200 { ok: true, message: { id, status, consumedAt } }
 */
export async function PATCH(
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
  const messageId = Number(id);
  if (!Number.isInteger(messageId)) {
    return NextResponse.json(
      { ok: false, error: "올바르지 않은 메시지 id입니다." },
      { status: 400 },
    );
  }

  const message = await prisma.nodeMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      kind: true,
      status: true,
      consumedAt: true,
      node: { select: { projectId: true } },
    },
  });
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "존재하지 않는 메시지입니다." },
      { status: 404 },
    );
  }

  const access = await authorizeProjectAccess(
    auth.memberId,
    message.node.projectId,
  );
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  if (message.kind === "ANSWER") {
    return NextResponse.json(
      { ok: false, error: "답변(ANSWER)은 consume 대상이 아닙니다." },
      { status: 422 },
    );
  }

  // 이미 consume됨 → 멱등 처리.
  if (message.consumedAt !== null) {
    return NextResponse.json({
      ok: true,
      message: {
        id: message.id,
        status: message.status,
        consumedAt: message.consumedAt,
      },
    });
  }

  const updated = await prisma.nodeMessage.update({
    where: { id: message.id },
    data: {
      consumedAt: new Date(),
      // INSTRUCTION은 픽업 시 ACKNOWLEDGED로 전이. QUESTION은 ANSWERED 유지.
      ...(message.kind === "INSTRUCTION" ? { status: "ACKNOWLEDGED" } : {}),
    },
    select: { id: true, status: true, consumedAt: true },
  });

  return NextResponse.json({ ok: true, message: updated });
}
