// 슬라이드 장면 수정 토큰 API. coworks-slide-update 스킬이 호출한다.
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authorizeProjectAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const DOCUMENT_MAX = 5_000_000; // 직렬화 문자열 길이 상한(바이트 근사)

/**
 * PATCH /api/slides/:slideId
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 * Body: { document: object }  // Excalidraw 장면 { elements, appState, files }
 *
 * 슬라이드(버전)의 캔버스 장면을 in-place로 수정한다.
 * 응답: { ok: true, slide: { id, version, document } }
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

  let body: { document?: unknown };
  try {
    body = (await request.json()) as { document?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "요청 본문(JSON)을 해석할 수 없습니다." }, { status: 400 });
  }

  if (body.document === null || typeof body.document !== "object") {
    return NextResponse.json({ ok: false, error: "document는 객체여야 합니다." }, { status: 400 });
  }
  if (JSON.stringify(body.document).length > DOCUMENT_MAX) {
    return NextResponse.json(
      { ok: false, error: "장면이 너무 큽니다. 이미지 크기를 줄여 주세요." },
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
    data: { document: body.document as Prisma.InputJsonValue },
    select: { id: true, version: true, document: true },
  });

  return NextResponse.json({ ok: true, slide: updated });
}
