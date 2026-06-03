// 참조: kpopfandom-front/docs/apis/03-task-create-api-design.md (v1.0) — (선택) Task 목록 조회
// 액세스 토큰 기반, 특정 노드의 Task 목록 조회 API.
// POST /api/tasks 등록 후 검증/멱등 처리에 쓴다. 인증·권한은 nodes/[id]와 동일.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authorizeProjectAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/nodes/:id/tasks
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 *
 * - 토큰 검증 → 노드 조회 → 프로젝트 소속 검증(SUPER 우회) → Task 목록 반환.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1) 토큰 추출·검증
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  // 2) id 파싱
  const { id } = await params;
  const nodeId = Number(id);
  if (!Number.isInteger(nodeId)) {
    return NextResponse.json(
      { ok: false, error: "올바르지 않은 노드 id입니다." },
      { status: 400 },
    );
  }

  // 3) 노드 조회
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

  // 4) 프로젝트 소속 검증 (SUPER 등급은 우회)
  const access = await authorizeProjectAccess(auth.memberId, node.projectId);
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  // 5) Task 목록 조회
  const tasks = await prisma.task.findMany({
    where: { nodeId: node.id },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      endpoint: true,
      description: true,
      progress: true,
    },
  });

  return NextResponse.json({ ok: true, nodeId: node.id, tasks });
}
