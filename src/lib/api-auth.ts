// 참조: docs/superpowers/specs/2026-06-02-node-api-design.md (v1.0)
// 액세스 토큰 기반 HTTP API의 공통 인증·권한 헬퍼.
//
// /api/nodes/[id], /api/tasks 등 토큰 인증 API가 공유한다.
// (Server Action의 세션 쿠키 인증 getCurrentMember와는 별개다.)
import "server-only";

import { prisma } from "@/lib/prisma";
import { authenticateByToken } from "@/lib/access-token";

/** Authorization: Bearer <token> 헤더에서 토큰을 추출한다. */
export function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * 토큰 인증 실패(401)를 표현하는 결과. status/error를 그대로 응답에 쓴다.
 */
export type ApiAuthFailure = { ok: false; status: number; error: string };

/**
 * 요청 헤더의 Bearer 토큰을 검증해 멤버 id를 반환한다.
 * - 토큰 없음 → 401 "Authorization Bearer 토큰이 필요합니다."
 * - 무효/만료(7일) → 401 "유효하지 않거나 만료된 토큰입니다."
 */
export async function authenticateRequest(
  request: Request,
): Promise<{ ok: true; memberId: number } | ApiAuthFailure> {
  const token = extractBearer(request);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Authorization Bearer 토큰이 필요합니다.",
    };
  }
  const memberId = await authenticateByToken(token);
  if (memberId === null) {
    return {
      ok: false,
      status: 401,
      error: "유효하지 않거나 만료된 토큰입니다.",
    };
  }
  return { ok: true, memberId };
}

/**
 * 멤버가 프로젝트에 접근할 수 있는지 검증한다.
 * - SUPER 등급은 우회.
 * - 그 외에는 projectMember 소속이 있어야 한다.
 * 실패 시 403 결과를 반환한다.
 */
export async function authorizeProjectAccess(
  memberId: number,
  projectId: number,
): Promise<{ ok: true } | ApiAuthFailure> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { grade: true },
  });
  if (member?.grade === "SUPER") return { ok: true };

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_memberId: { projectId, memberId } },
    select: { memberId: true },
  });
  if (!membership) {
    return {
      ok: false,
      status: 403,
      error: "이 프로젝트에 접근 권한이 없습니다.",
    };
  }
  return { ok: true };
}
