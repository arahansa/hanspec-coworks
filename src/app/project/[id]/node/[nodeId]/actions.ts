// 참조: docs/domain/06-task.md,
//       docs/superpowers/specs/2026-06-01-requirement-detail-task-design.md (v1.0),
//       docs/superpowers/specs/2026-06-02-node-status-assignee-design.md (v1.0)
// REQUIREMENT 노드 하위 Task 생성 + 노드 상태 변경 + 담당자 지정 server action.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { NodeStatus } from "@/generated/prisma/enums";

export type TaskActionResult =
  | { ok: true; taskId: number }
  | { ok: false; error: string };

export type NodeActionResult = { ok: true } | { ok: false; error: string };

/**
 * 로그인 + 노드 존재 + REQUIREMENT 레벨을 검증하는 공통 헬퍼.
 * 통과 시 노드의 id/projectId를, 실패 시 에러 결과를 반환한다.
 */
async function requireRequirementNode(
  nodeId: number,
): Promise<
  | { ok: true; node: { id: number; projectId: number } }
  | { ok: false; result: NodeActionResult }
> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { id: true, level: true, projectId: true },
  });
  if (!node) {
    return { ok: false, result: { ok: false, error: "존재하지 않는 노드입니다." } };
  }
  if (node.level !== "REQUIREMENT") {
    return {
      ok: false,
      result: {
        ok: false,
        error: "요구사항(REQUIREMENT) 노드에서만 가능한 작업입니다.",
      },
    };
  }
  return { ok: true, node: { id: node.id, projectId: node.projectId } };
}

/**
 * REQUIREMENT 노드에 Task를 생성한다.
 * - 로그인 검증, 노드 존재·REQUIREMENT 검증.
 * - description 필수, progress는 0~100 범위(기본 0).
 */
export async function createTask(
  nodeId: number,
  description: string,
  progress: number,
): Promise<TaskActionResult> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { id: true, level: true, projectId: true },
  });
  if (!node) return { ok: false, error: "존재하지 않는 노드입니다." };
  if (node.level !== "REQUIREMENT") {
    return { ok: false, error: "Task는 요구사항(REQUIREMENT) 하위에만 만들 수 있습니다." };
  }

  const desc = description.trim();
  if (!desc) return { ok: false, error: "작업 설명을 입력해 주세요." };

  const p = Number.isFinite(progress) ? Math.trunc(progress) : 0;
  if (p < 0 || p > 100) return { ok: false, error: "진행도는 0~100 사이여야 합니다." };

  const task = await prisma.task.create({
    data: { nodeId: node.id, description: desc, progress: p },
    select: { id: true },
  });

  revalidatePath(`/project/${node.projectId}/node/${node.id}`);
  return { ok: true, taskId: task.id };
}

/**
 * REQUIREMENT 노드의 상태를 변경한다. (03-node.md 추가요청1)
 * - 상태 변경은 도메인상 version 증가 대상이 아니다(이름/설명 수정만 version+1).
 */
export async function updateNodeStatus(
  nodeId: number,
  status: NodeStatus,
): Promise<NodeActionResult> {
  const check = await requireRequirementNode(nodeId);
  if (!check.ok) return check.result;

  if (!Object.values(NodeStatus).includes(status)) {
    return { ok: false, error: "알 수 없는 상태입니다." };
  }

  await prisma.node.update({
    where: { id: check.node.id },
    data: { status },
  });

  revalidatePath(`/project/${check.node.projectId}/node/${check.node.id}`);
  return { ok: true };
}

/**
 * REQUIREMENT 노드의 설명(description)을 변경한다.
 * - 설명 수정은 도메인상 version+1 대상이다.
 * - 빈 문자열은 null로 저장한다.
 */
export async function updateNodeDescription(
  nodeId: number,
  description: string,
): Promise<NodeActionResult> {
  const check = await requireRequirementNode(nodeId);
  if (!check.ok) return check.result;

  await prisma.node.update({
    where: { id: check.node.id },
    data: {
      description: description.trim() || null,
      version: { increment: 1 },
    },
  });

  revalidatePath(`/project/${check.node.projectId}/node/${check.node.id}`);
  // 테이블뷰의 설명/표시도 최신화되도록 함께 무효화.
  revalidatePath(`/project/${check.node.projectId}/table-view`);
  return { ok: true };
}

/**
 * REQUIREMENT 노드에 담당자를 추가한다. (03-node.md 추가요청2)
 * - 멤버 존재 검증. 복합키 upsert로 중복 지정을 멱등 처리한다.
 */
export async function addAssignee(
  nodeId: number,
  memberId: number,
): Promise<NodeActionResult> {
  const check = await requireRequirementNode(nodeId);
  if (!check.ok) return check.result;

  const target = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true },
  });
  if (!target) return { ok: false, error: "존재하지 않는 멤버입니다." };

  await prisma.nodeAssignee.upsert({
    where: { nodeId_memberId: { nodeId: check.node.id, memberId } },
    create: { nodeId: check.node.id, memberId },
    update: {},
  });

  revalidatePath(`/project/${check.node.projectId}/node/${check.node.id}`);
  return { ok: true };
}

/**
 * REQUIREMENT 노드에서 담당자를 제거한다. (03-node.md 추가요청2)
 * - 매핑이 없으면(P2025) 무시한다.
 */
export async function removeAssignee(
  nodeId: number,
  memberId: number,
): Promise<NodeActionResult> {
  const check = await requireRequirementNode(nodeId);
  if (!check.ok) return check.result;

  try {
    await prisma.nodeAssignee.delete({
      where: { nodeId_memberId: { nodeId: check.node.id, memberId } },
    });
  } catch (e) {
    // 이미 제거된 경우(P2025)는 정상 처리. 그 외는 전파.
    if (
      !(e instanceof Error && "code" in e && (e as { code?: string }).code === "P2025")
    ) {
      throw e;
    }
  }

  revalidatePath(`/project/${check.node.projectId}/node/${check.node.id}`);
  return { ok: true };
}
