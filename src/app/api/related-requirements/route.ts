// 참조: docs/superpowers/specs/2026-06-08-related-requirement-design.md (v1.0)
// 관련 요구사항 연결 시 후보 검색 API. RelatedRequirementSection 자동완성에 사용한다.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LIMIT = 10;

/**
 * GET /api/related-requirements?nodeId=<id>&q=<prefix>
 * - 로그인 검증 후, nodeId가 속한 프로젝트의 REQUIREMENT 중 name이 q를 포함(대소문자 무시)하는
 *   노드를 최대 10개 반환한다. 자기 자신은 제외(이미 연결된 노드는 호출 측에서 제외).
 * - q가 비면 상위 10개.
 */
export async function GET(request: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const nodeId = Number(url.searchParams.get("nodeId"));
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!Number.isInteger(nodeId)) {
    return NextResponse.json({ ok: false, error: "잘못된 nodeId입니다." }, { status: 400 });
  }

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { projectId: true },
  });
  if (!node) {
    return NextResponse.json({ ok: false, error: "존재하지 않는 노드입니다." }, { status: 404 });
  }

  const candidates = await prisma.node.findMany({
    where: {
      projectId: node.projectId,
      level: "REQUIREMENT",
      id: { not: nodeId },
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: LIMIT,
  });

  return NextResponse.json({ ok: true, candidates });
}
