// 참조: docs/domain/02-member.md,
//       docs/superpowers/specs/2026-06-02-node-status-assignee-design.md (v1.0)
// 멤버 목록 검색 API. 담당자 지정(@) 자동완성에 사용한다.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LIMIT = 10;

/**
 * GET /api/members?q=<prefix>
 * - 로그인 검증 후, username이 q로 시작(대소문자 무시)하는 멤버를 최대 10명 반환.
 * - q가 비면 상위 10명. 비밀번호 등 민감 필드는 절대 반환하지 않는다.
 */
export async function GET(request: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  const members = await prisma.member.findMany({
    where: q ? { username: { startsWith: q, mode: "insensitive" } } : undefined,
    select: { id: true, username: true },
    orderBy: { username: "asc" },
    take: LIMIT,
  });

  return NextResponse.json({ ok: true, members });
}
