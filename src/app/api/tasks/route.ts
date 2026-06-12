// 참조: docs/apis/01-node.md
// 액세스 토큰 기반 Task 생성 API.
// REQUIREMENT 노드에 Task(컴포넌트 등)를 등록한다.
// 다른 프로젝트가 .env의 HANSPEC_COWORKS_ACCESSTOKEN으로 호출한다.
//
// 인증은 액세스 토큰(헤더) 기반이며, Server Action(actions.ts의 createTask)이 쓰는
// 세션 쿠키(getCurrentMember)와는 별개다. 여기서는 절대 getCurrentMember를 쓰지 않는다.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authorizeProjectAccess } from "@/lib/api-auth";
import {
  normalizeTaskFields,
  validateDescription,
  validateProgress,
} from "@/lib/task";

export const dynamic = "force-dynamic";

type TaskCreateBody = {
  nodeId?: unknown;
  description?: unknown;
  progress?: unknown;
  name?: unknown;
  endpoint?: unknown;
};

/**
 * POST /api/tasks
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 * Body: { nodeId, description, progress?, name?, endpoint? }
 *
 * - 토큰 검증(만료 7일) → 노드 조회 → 프로젝트 소속 검증(SUPER 우회)
 *   → REQUIREMENT 검증 → 필드 검증 → Task 생성.
 * - 성공: 201 { ok: true, taskId }
 */
export async function POST(request: Request) {
  // 1) 토큰 추출·검증
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }
  const memberId = auth.memberId;

  // 2) 바디 파싱
  let body: TaskCreateBody;
  try {
    body = (await request.json()) as TaskCreateBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 본문(JSON)을 해석할 수 없습니다." },
      { status: 400 },
    );
  }

  const nodeId = Number(body.nodeId);
  if (!Number.isInteger(nodeId)) {
    return NextResponse.json(
      { ok: false, error: "올바르지 않은 노드 id입니다." },
      { status: 400 },
    );
  }

  // 3) 노드 조회
  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { id: true, level: true, projectId: true },
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

  // 5) REQUIREMENT 레벨 검증
  if (node.level !== "REQUIREMENT") {
    return NextResponse.json(
      {
        ok: false,
        error: "Task는 요구사항(REQUIREMENT) 하위에만 만들 수 있습니다.",
      },
      { status: 422 },
    );
  }

  // 6) 필드 검증 (Server Action createTask와 동일한 규칙)
  if (typeof body.description !== "string") {
    return NextResponse.json(
      { ok: false, error: "작업 설명을 입력해 주세요." },
      { status: 400 },
    );
  }
  const descCheck = validateDescription(body.description);
  if (!descCheck.ok) {
    return NextResponse.json(
      { ok: false, error: descCheck.error },
      { status: 400 },
    );
  }

  // progress 미지정 시 기본 0.
  const progressCheck = validateProgress(
    body.progress === undefined ? 0 : Number(body.progress),
  );
  if (!progressCheck.ok) {
    return NextResponse.json(
      { ok: false, error: progressCheck.error },
      { status: 400 },
    );
  }

  const norm = normalizeTaskFields(
    typeof body.name === "string" ? body.name : undefined,
    typeof body.endpoint === "string" ? body.endpoint : undefined,
  );
  if (!norm.ok) {
    return NextResponse.json(
      { ok: false, error: norm.error },
      { status: 400 },
    );
  }

  // 7) 생성
  const task = await prisma.task.create({
    data: {
      nodeId: node.id,
      description: descCheck.value,
      progress: progressCheck.value,
      name: norm.name,
      endpoint: norm.endpoint,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, taskId: task.id }, { status: 201 });
}
