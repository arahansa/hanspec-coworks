// 슬라이드 새 버전 생성 토큰 API. coworks-slide-update 스킬이 호출한다.
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authorizeProjectAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/slides/pages/:pageId/versions
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 *
 * 페이지에 새 버전을 만든다. version = 현재 최대+1, 장면(document)은 최신 버전을 복사.
 * 응답: { ok: true, slide: { id, version, document } }
 */
export async function POST(
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
    select: { id: true, projectId: true },
  });
  if (!page) {
    return NextResponse.json({ ok: false, error: "존재하지 않는 페이지입니다." }, { status: 404 });
  }

  const access = await authorizeProjectAccess(auth.memberId, page.projectId);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  const latest = await prisma.slide.findFirst({
    where: { pageId },
    orderBy: { version: "desc" },
    select: { version: true, document: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await prisma.slide.create({
    data: {
      pageId,
      version: nextVersion,
      document:
        latest?.document == null
          ? Prisma.DbNull
          : (latest.document as Prisma.InputJsonValue),
    },
    select: { id: true, version: true, document: true },
  });

  return NextResponse.json({ ok: true, slide: created });
}
