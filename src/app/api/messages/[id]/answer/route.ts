// 참조: docs/feature/01-talk-ai-user.md (v1.0)
// 액세스 토큰 기반 답변 API.
// 사용자(USER)가 CLAUDE의 QUESTION에 답한다. ANSWER 메시지를 생성하고
// 부모 QUESTION을 ANSWERED로 전환한다(한 트랜잭션).
//  - selectedOption: 선택지 버튼 클릭 시 옵션 인덱스
//  - body          : 자유 텍스트 답변
// 최소 하나는 있어야 한다. selectedOption만 있으면 body는 해당 옵션 문구로 채운다.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authorizeProjectAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type AnswerBody = {
  selectedOption?: unknown;
  body?: unknown;
};

/**
 * POST /api/messages/:id/answer
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 * Body: { selectedOption?: number, body?: string }
 *
 * - 대상이 QUESTION이 아니거나 이미 ANSWERED면 422.
 * - 성공: 201 { ok: true, messageId }  (생성된 ANSWER의 id)
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

  const { id } = await params;
  const questionId = Number(id);
  if (!Number.isInteger(questionId)) {
    return NextResponse.json(
      { ok: false, error: "올바르지 않은 메시지 id입니다." },
      { status: 400 },
    );
  }

  let payload: AnswerBody;
  try {
    payload = (await request.json()) as AnswerBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 본문(JSON)을 해석할 수 없습니다." },
      { status: 400 },
    );
  }

  const question = await prisma.nodeMessage.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      nodeId: true,
      kind: true,
      status: true,
      options: true,
      node: { select: { projectId: true } },
    },
  });
  if (!question) {
    return NextResponse.json(
      { ok: false, error: "존재하지 않는 메시지입니다." },
      { status: 404 },
    );
  }

  const access = await authorizeProjectAccess(
    auth.memberId,
    question.node.projectId,
  );
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  if (question.kind !== "QUESTION") {
    return NextResponse.json(
      { ok: false, error: "질문(QUESTION)에만 답할 수 있습니다." },
      { status: 422 },
    );
  }
  if (question.status === "ANSWERED") {
    return NextResponse.json(
      { ok: false, error: "이미 답변된 질문입니다." },
      { status: 422 },
    );
  }

  // 입력 정규화: selectedOption(있으면) → 옵션 인덱스 검증, body는 자유 텍스트.
  const options = Array.isArray(question.options)
    ? (question.options as unknown[]).map((o) => String(o))
    : [];
  let selectedOption: number | null = null;
  if (payload.selectedOption !== undefined && payload.selectedOption !== null) {
    const idx = Number(payload.selectedOption);
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      return NextResponse.json(
        { ok: false, error: "selectedOption이 옵션 범위를 벗어났습니다." },
        { status: 400 },
      );
    }
    selectedOption = idx;
  }

  const freeText =
    typeof payload.body === "string" ? payload.body.trim() : "";

  if (selectedOption === null && freeText.length === 0) {
    return NextResponse.json(
      { ok: false, error: "selectedOption 또는 body 중 하나는 필요합니다." },
      { status: 400 },
    );
  }

  // body는 표시·기록용. 자유 텍스트 우선, 없으면 선택한 옵션 문구.
  const answerBody =
    freeText.length > 0 ? freeText : options[selectedOption as number];

  // ANSWER 생성 + 부모 QUESTION → ANSWERED 를 한 트랜잭션으로.
  const answer = await prisma.$transaction(async (tx) => {
    const created = await tx.nodeMessage.create({
      data: {
        nodeId: question.nodeId,
        role: "USER",
        kind: "ANSWER",
        status: null,
        body: answerBody,
        selectedOption,
        parentId: question.id,
        authorMemberId: auth.memberId,
      },
      select: { id: true },
    });
    await tx.nodeMessage.update({
      where: { id: question.id },
      data: { status: "ANSWERED" },
    });
    return created;
  });

  return NextResponse.json(
    { ok: true, messageId: answer.id },
    { status: 201 },
  );
}
