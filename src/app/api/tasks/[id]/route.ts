// 참조: docs/apis/01-node.md (v1.5)
// 액세스 토큰 기반 Task 단건 조회·수정 API.
// 이미 만들어진 Task의 진행도(progress)·설명·이름·endpoint를 부분 수정(PATCH)한다.
// 다른 프로젝트가 .env의 HANSPEC_COWORKS_ACCESSTOKEN으로 호출한다.
//
// 인증은 액세스 토큰(헤더) 기반이며, Server Action의 세션 쿠키(getCurrentMember)는
// 절대 쓰지 않는다. (생성 API와 동일 원칙)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, authorizeProjectAccess } from "@/lib/api-auth";
import {
  normalizeTaskFields,
  validateDescription,
  validateProgress,
} from "@/lib/task";

export const dynamic = "force-dynamic";

/** 응답으로 돌려줄 Task 형태 (GET /api/nodes/:id/tasks 아이템 + nodeId). */
const TASK_SELECT = {
  id: true,
  nodeId: true,
  name: true,
  endpoint: true,
  description: true,
  progress: true,
} as const;

/**
 * 공통 전처리: 토큰 인증 → id 파싱 → Task 조회(소속 projectId 포함) → 프로젝트 권한 검증.
 * 실패 시 그대로 반환할 NextResponse를, 성공 시 taskId를 돌려준다.
 */
async function resolveTask(
  request: Request,
  params: Promise<{ id: string }>,
): Promise<{ ok: true; taskId: number } | { ok: false; res: NextResponse }> {
  // 1) 토큰 추출·검증
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status },
      ),
    };
  }

  // 2) id 파싱
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isInteger(taskId)) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "올바르지 않은 task id입니다." },
        { status: 400 },
      ),
    };
  }

  // 3) Task 조회 — Node 조인으로 소속 projectId를 얻는다(권한 검증 기준).
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, node: { select: { projectId: true } } },
  });
  if (!task) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "존재하지 않는 task입니다." },
        { status: 404 },
      ),
    };
  }

  // 4) 프로젝트 소속 검증 (SUPER 등급은 우회)
  const access = await authorizeProjectAccess(
    auth.memberId,
    task.node.projectId,
  );
  if (!access.ok) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status },
      ),
    };
  }

  return { ok: true, taskId };
}

/**
 * GET /api/tasks/:id — Task 단건 조회
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 *
 * - 수정 전 현재 상태 확인·멱등 처리에 사용.
 * - 성공: 200 { ok: true, task: { id, nodeId, name, endpoint, description, progress } }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await resolveTask(request, params);
  if (!resolved.ok) return resolved.res;

  const task = await prisma.task.findUnique({
    where: { id: resolved.taskId },
    select: TASK_SELECT,
  });

  return NextResponse.json({ ok: true, task });
}

type TaskPatchBody = {
  progress?: unknown;
  description?: unknown;
  name?: unknown;
  endpoint?: unknown;
};

/**
 * PATCH /api/tasks/:id — Task 부분 수정 (진행도/설명/이름/endpoint)
 * Header: Authorization: Bearer <HANSPEC_COWORKS_ACCESSTOKEN>
 * Body: { progress?, description?, name?, endpoint? } — 포함된 키만 갱신
 *
 * - 필드 규칙은 생성 API(POST /api/tasks)와 동일(src/lib/task.ts 공유).
 *   - progress: 정수 0~100
 *   - description: trim 후 비어있지 않을 것 (필수 필드라 null/빈 문자열 불가)
 *   - name/endpoint: trim·길이 검증, 빈 값·null은 null(값 제거)
 * - 수정 대상 키가 0개면 400("수정할 필드가 없습니다.")
 * - 성공: 200 { ok: true, task: <수정 후 전체> }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await resolveTask(request, params);
  if (!resolved.ok) return resolved.res;

  // 바디 파싱
  let body: TaskPatchBody;
  try {
    body = (await request.json()) as TaskPatchBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 본문(JSON)을 해석할 수 없습니다." },
      { status: 400 },
    );
  }

  // 수정 대상 필드 추림 — 바디에 포함된 키만 검증·갱신한다(PATCH semantics).
  const data: {
    progress?: number;
    description?: string;
    name?: string | null;
    endpoint?: string | null;
  } = {};

  if ("progress" in body) {
    if (typeof body.progress !== "number") {
      return NextResponse.json(
        { ok: false, error: "진행도는 0~100 사이여야 합니다." },
        { status: 400 },
      );
    }
    const check = validateProgress(body.progress);
    if (!check.ok) {
      return NextResponse.json(
        { ok: false, error: check.error },
        { status: 400 },
      );
    }
    data.progress = check.value;
  }

  if ("description" in body) {
    if (typeof body.description !== "string") {
      return NextResponse.json(
        { ok: false, error: "작업 설명을 입력해 주세요." },
        { status: 400 },
      );
    }
    const check = validateDescription(body.description);
    if (!check.ok) {
      return NextResponse.json(
        { ok: false, error: check.error },
        { status: 400 },
      );
    }
    data.description = check.value;
  }

  if ("name" in body) {
    if (body.name !== null && typeof body.name !== "string") {
      return NextResponse.json(
        { ok: false, error: "name 은 문자열 또는 null 이어야 합니다." },
        { status: 400 },
      );
    }
    const norm = normalizeTaskFields(body.name ?? undefined, undefined);
    if (!norm.ok) {
      return NextResponse.json(
        { ok: false, error: norm.error },
        { status: 400 },
      );
    }
    data.name = norm.name;
  }

  if ("endpoint" in body) {
    if (body.endpoint !== null && typeof body.endpoint !== "string") {
      return NextResponse.json(
        { ok: false, error: "endpoint 는 문자열 또는 null 이어야 합니다." },
        { status: 400 },
      );
    }
    const norm = normalizeTaskFields(undefined, body.endpoint ?? undefined);
    if (!norm.ok) {
      return NextResponse.json(
        { ok: false, error: norm.error },
        { status: 400 },
      );
    }
    data.endpoint = norm.endpoint;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { ok: false, error: "수정할 필드가 없습니다." },
      { status: 400 },
    );
  }

  const task = await prisma.task.update({
    where: { id: resolved.taskId },
    data,
    select: TASK_SELECT,
  });

  return NextResponse.json({ ok: true, task });
}
