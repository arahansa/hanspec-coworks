// 슬라이드 본문 수정 토큰 API. coworks-slide-update 스킬이 호출한다.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authorizeProjectAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const CONTENT_MAX = 100_000;

/**
 * PATCH /api/slides/:slideId
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 * Body: { content: string }
 *
 * 슬라이드(버전)의 본문을 in-place로 수정한다.
 * 응답: { ok: true, slide: { id, version, content } }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slideId: string }> },
) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { slideId: slideIdStr } = await params;
  const slideId = Number(slideIdStr);
  if (!Number.isInteger(slideId)) {
    return NextResponse.json({ ok: false, error: "올바르지 않은 슬라이드 id입니다." }, { status: 400 });
  }

  let body: { content?: unknown };
  try {
    body = (await request.json()) as { content?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "요청 본문(JSON)을 해석할 수 없습니다." }, { status: 400 });
  }

  if (typeof body.content !== "string") {
    return NextResponse.json({ ok: false, error: "content는 문자열이어야 합니다." }, { status: 400 });
  }
  if (body.content.length > CONTENT_MAX) {
    return NextResponse.json(
      { ok: false, error: `본문은 ${CONTENT_MAX}자 이하여야 합니다.` },
      { status: 400 },
    );
  }

  const slide = await prisma.slide.findUnique({
    where: { id: slideId },
    select: { id: true, version: true, page: { select: { projectId: true } } },
  });
  if (!slide) {
    return NextResponse.json({ ok: false, error: "존재하지 않는 슬라이드입니다." }, { status: 404 });
  }

  const access = await authorizeProjectAccess(auth.memberId, slide.page.projectId);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  const updated = await prisma.slide.update({
    where: { id: slideId },
    data: { content: body.content },
    select: { id: true, version: true, content: true },
  });

  return NextResponse.json({ ok: true, slide: updated });
}
