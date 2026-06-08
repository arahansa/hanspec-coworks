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

/** 관련 요구사항 요약. 외부 프로젝트가 연결된 요구사항의 API 정보까지 바로 쓰도록 endpoint·status 포함. */
type RelatedNode = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  endpoint: string | null;
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
      // 관련 요구사항(무방향). nodeA/nodeB 양쪽 행을 모은다. (관련 요구사항 v1.0)
      relationsA: {
        orderBy: { nodeBId: "asc" },
        select: {
          nodeB: {
            select: {
              id: true,
              name: true,
              description: true,
              status: true,
              endpoint: true,
            },
          },
        },
      },
      relationsB: {
        orderBy: { nodeAId: "asc" },
        select: {
          nodeA: {
            select: {
              id: true,
              name: true,
              description: true,
              status: true,
              endpoint: true,
            },
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

  // 관련 요구사항(무방향)을 상대 노드 목록으로 평탄화하고 id 기준 정렬.
  // 관계는 REQUIREMENT끼리만 존재하므로 다른 레벨에선 빈 배열이 된다. (관련 요구사항 v1.0)
  const related: RelatedNode[] = [
    ...node.relationsA.map((r) => r.nodeB),
    ...node.relationsB.map((r) => r.nodeA),
  ].sort((a, b) => a.id - b.id);

  return NextResponse.json({
    ok: true,
    level: node.level,
    projectId: node.projectId,
    module,
    feature,
    requirement,
    related,
  });
}

type NodePatchBody = { description?: unknown };

/**
 * PATCH /api/nodes/:id — 노드 설명(description) 업데이트
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 * Body: { description: string | null }
 *
 * - 인증·권한은 GET과 동일(토큰 7일, SUPER 우회 + projectMember).
 * - 노드 레벨 제약 없음(MODULE/FEATURE/REQUIREMENT 모두 설명 가능).
 * - description: 문자열이면 trim(빈 문자열은 null), null이면 설명 제거.
 *   설명 수정은 도메인상 version+1 대상이다(웹 UI updateNode와 동일).
 * - 성공: 200 { ok: true, node: { id, level, description, version } }
 */
export async function PATCH(
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

  // 3) 바디 파싱 + description 검증 (string | null 만 허용)
  let body: NodePatchBody;
  try {
    body = (await request.json()) as NodePatchBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 본문(JSON)을 해석할 수 없습니다." },
      { status: 400 },
    );
  }
  if (
    body.description !== null &&
    typeof body.description !== "string"
  ) {
    return NextResponse.json(
      { ok: false, error: "description 은 문자열이어야 합니다." },
      { status: 400 },
    );
  }
  // 문자열이면 trim, 빈 문자열·null은 설명 제거(null 저장).
  const description =
    typeof body.description === "string"
      ? body.description.trim() || null
      : null;

  // 4) 노드 조회
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

  // 5) 프로젝트 소속 검증 (SUPER 등급은 우회)
  const access = await authorizeProjectAccess(auth.memberId, node.projectId);
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  }

  // 6) 갱신 (설명 수정은 version+1)
  const updated = await prisma.node.update({
    where: { id: nodeId },
    data: { description, version: { increment: 1 } },
    select: { id: true, level: true, description: true, version: true },
  });

  return NextResponse.json({ ok: true, node: updated });
}
