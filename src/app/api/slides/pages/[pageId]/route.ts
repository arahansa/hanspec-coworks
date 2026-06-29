// 슬라이드 페이지 조회 토큰 API. coworks-slide-update 스킬이 호출한다.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authorizeProjectAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/slides/pages/:pageId
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 *
 * 응답: { ok: true, page: { id, title, projectId }, versions: [{ id, version, content }] }
 * versions는 version 내림차순(최신 먼저).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { pageId: pageIdStr } = await params;
  const pageId = Number(pageIdStr);
  if (!Number.isInteger(pageId)) {
    return NextResponse.json({ ok: false, error: "올바르지 않은 페이지 id입니다." }, { status: 400 });
  }

  const page = await prisma.slidePage.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      title: true,
      projectId: true,
      versions: {
        orderBy: { version: "desc" },
        select: { id: true, version: true, content: true },
      },
    },
  });
  if (!page) {
    return NextResponse.json({ ok: false, error: "존재하지 않는 페이지입니다." }, { status: 404 });
  }

  const access = await authorizeProjectAccess(auth.memberId, page.projectId);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  const { versions, ...pageInfo } = page;
  return NextResponse.json({ ok: true, page: pageInfo, versions });
}
