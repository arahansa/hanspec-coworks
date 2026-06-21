// 참조: docs/apis/01-node.md (나의 작업 v1.6)
// 액세스 토큰 기반 "나의 작업" 목록 API.
// 토큰 멤버가 담당자로 할당된 REQUIREMENT 목록을 반환한다.
// 기본은 초안(DRAFT) — "내가 해야 할 작업"을 외부 도구(에이전트 루프 등)가
// 한 세션당 하나씩 집어 진행하는 용도를 염두에 둔다. (요구사항 #195)
//
// 자기 자신에게 할당된 노드만 반환하므로 별도 프로젝트 권한 검증(403)은 없다.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import type { NodeStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUS_VALUES = ["DRAFT", "IN_PROGRESS", "DONE"] as const;

/**
 * GET /api/my-works
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 * Query:
 *   - status: DRAFT(기본) | IN_PROGRESS | DONE | ALL
 *   - projectId: 특정 프로젝트로 한정(선택)
 *
 * - 성공: 200 { ok: true, works: [{ nodeId, projectId, name, description, status }] }
 * - 에러: 400(잘못된 쿼리), 401(토큰)
 */
export async function GET(request: Request) {
  // 1) 토큰 추출·검증
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  // 2) 쿼리 파싱
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "DRAFT";
  let status: NodeStatus | undefined;
  if (statusParam !== "ALL") {
    if (!(STATUS_VALUES as readonly string[]).includes(statusParam)) {
      return NextResponse.json(
        {
          ok: false,
          error: "status 는 DRAFT, IN_PROGRESS, DONE, ALL 중 하나여야 합니다.",
        },
        { status: 400 },
      );
    }
    status = statusParam as NodeStatus;
  }

  const projectIdParam = url.searchParams.get("projectId");
  let projectId: number | undefined;
  if (projectIdParam !== null) {
    projectId = Number(projectIdParam);
    if (!Number.isInteger(projectId)) {
      return NextResponse.json(
        { ok: false, error: "올바르지 않은 projectId입니다." },
        { status: 400 },
      );
    }
  }

  // 3) 내가 담당자인 REQUIREMENT 조회. 상태(초안→진행중→완료) 순, 같은 상태는 id 순.
  const nodes = await prisma.node.findMany({
    where: {
      level: "REQUIREMENT",
      assignees: { some: { memberId: auth.memberId } },
      ...(status ? { status } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
    },
    orderBy: [{ status: "asc" }, { id: "asc" }],
    select: {
      id: true,
      projectId: true,
      name: true,
      description: true,
      status: true,
    },
  });

  return NextResponse.json({
    ok: true,
    works: nodes.map((n) => ({
      nodeId: n.id,
      projectId: n.projectId,
      name: n.name,
      description: n.description,
      status: n.status,
    })),
  });
}
