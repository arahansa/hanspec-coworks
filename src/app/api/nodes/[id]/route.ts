// 참조: docs/apis/01-node.md,
//       docs/superpowers/specs/2026-06-02-node-api-design.md (v1.0)
// 액세스 토큰 기반 Node 조회 API.
// 요구사항(REQUIREMENT) id로 그 요구사항 + 상위 기능(FEATURE) + 상위 모듈(MODULE)을
// 한 번에 반환한다. 다른 프로젝트가 .env의 HANSPEC_COWORKS_ACCESSTOKEN으로 호출.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authorizeProjectAccess } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type NodeSummary = {
  id: number;
  name: string;
  description: string | null;
};

/**
 * GET /api/nodes/:id
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 *
 * - 토큰 유효성(만료 7일) 검증 → 노드 조회 → 프로젝트 소속 검증(SUPER는 우회).
 * - REQUIREMENT: requirement + feature + module
 *   FEATURE: feature + module (requirement=null)
 *   MODULE: module (feature/requirement=null)
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
  const memberId = auth.memberId;

  // 2) id 파싱
  const { id } = await params;
  const nodeId = Number(id);
  if (!Number.isInteger(nodeId)) {
    return NextResponse.json(
      { ok: false, error: "올바르지 않은 노드 id입니다." },
      { status: 400 },
    );
  }

  // 3) 노드 + 상위 2단계(parent.parent까지) 조회
  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: {
      id: true,
      name: true,
      level: true,
      description: true,
      status: true,
      endpoint: true,
      version: true,
      projectId: true,
      parent: {
        select: {
          id: true,
          name: true,
          level: true,
          description: true,
          endpoint: true,
          parent: {
            select: { id: true, name: true, level: true, description: true },
          },
        },
      },
    },
  });
  if (!node) {
    return NextResponse.json(
      { ok: false, error: "존재하지 않는 노드입니다." },
      { status: 404 },
    );
  }

  // 4) 프로젝트 소속 검증 (SUPER 등급은 우회)
  const access = await authorizeProjectAccess(memberId, node.projectId);
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  // 5) level에 따라 module/feature/requirement 조립
  let module: NodeSummary | null = null;
  let feature: (NodeSummary & { endpoint: string | null }) | null = null;
  let requirement:
    | (NodeSummary & { status: string; version: number })
    | null = null;

  if (node.level === "REQUIREMENT") {
    requirement = {
      id: node.id,
      name: node.name,
      description: node.description,
      status: node.status,
      version: node.version,
    };
    if (node.parent) {
      feature = {
        id: node.parent.id,
        name: node.parent.name,
        description: node.parent.description,
        endpoint: node.parent.endpoint,
      };
      if (node.parent.parent) {
        module = {
          id: node.parent.parent.id,
          name: node.parent.parent.name,
          description: node.parent.parent.description,
        };
      }
    }
  } else if (node.level === "FEATURE") {
    feature = {
      id: node.id,
      name: node.name,
      description: node.description,
      endpoint: node.endpoint,
    };
    if (node.parent) {
      module = {
        id: node.parent.id,
        name: node.parent.name,
        description: node.parent.description,
      };
    }
  } else {
    // MODULE
    module = { id: node.id, name: node.name, description: node.description };
  }

  return NextResponse.json({
    ok: true,
    level: node.level,
    projectId: node.projectId,
    module,
    feature,
    requirement,
  });
}
