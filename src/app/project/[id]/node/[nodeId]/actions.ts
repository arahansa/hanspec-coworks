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
import {
  normalizeTaskFields,
  validateDescription,
  validateProgress,
} from "@/lib/task";

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

export type TaskFields = {
  description: string;
  progress: number;
  name?: string;
  endpoint?: string;
};

/**
 * REQUIREMENT 노드에 Task를 생성한다.
 * - 로그인 검증, 노드 존재·REQUIREMENT 검증.
 * - description 필수, progress는 0~100 범위(기본 0).
 * - name(컴포넌트 이름)·endpoint(경로)는 선택. (06-task.md 추가요청)
 */
export async function createTask(
  nodeId: number,
  fields: TaskFields,
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

  const descCheck = validateDescription(fields.description);
  if (!descCheck.ok) return { ok: false, error: descCheck.error };

  const progressCheck = validateProgress(fields.progress);
  if (!progressCheck.ok) return { ok: false, error: progressCheck.error };

  const norm = normalizeTaskFields(fields.name, fields.endpoint);
  if (!norm.ok) return { ok: false, error: norm.error };

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

  revalidatePath(`/project/${node.projectId}/node/${node.id}`);
  return { ok: true, taskId: task.id };
}

/**
 * 기존 Task를 수정한다(description·progress·name·endpoint).
 * - 로그인 검증, Task 존재 검증.
 */
export async function updateTask(
  taskId: number,
  fields: TaskFields,
): Promise<TaskActionResult> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, node: { select: { id: true, projectId: true } } },
  });
  if (!task) return { ok: false, error: "존재하지 않는 Task입니다." };

  const descCheck = validateDescription(fields.description);
  if (!descCheck.ok) return { ok: false, error: descCheck.error };

  const progressCheck = validateProgress(fields.progress);
  if (!progressCheck.ok) return { ok: false, error: progressCheck.error };

  const norm = normalizeTaskFields(fields.name, fields.endpoint);
  if (!norm.ok) return { ok: false, error: norm.error };

  await prisma.task.update({
    where: { id: taskId },
    data: {
      description: descCheck.value,
      progress: progressCheck.value,
      name: norm.name,
      endpoint: norm.endpoint,
    },
  });

  revalidatePath(`/project/${task.node.projectId}/node/${task.node.id}`);
  return { ok: true, taskId };
}

/**
 * REQUIREMENT 노드의 상태를 변경한다. (03-node.md 추가요청1)
 * - 상태 변경은 도메인상 version 증가 대상이 아니다(이름/설명 수정만 version+1).
 */
export async function updateNodeStatus(
  nodeId: number,
  status: NodeStatus,
): Promise<NodeActionResult> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const check = await requireRequirementNode(nodeId);
  if (!check.ok) return check.result;

  if (!Object.values(NodeStatus).includes(status)) {
    return { ok: false, error: "알 수 없는 상태입니다." };
  }

  const current = await prisma.node.findUnique({
    where: { id: check.node.id },
    select: { status: true },
  });

  await prisma.node.update({
    where: { id: check.node.id },
    data: { status },
  });

  // 비DONE→DONE 전환 시 예약된 완료 알림을 발송한다. (12-complete-notification.md)
  if (status === "DONE" && current?.status !== "DONE") {
    await fireCompleteNotifications(check.node.id, member.id);
  }

  revalidatePath(`/project/${check.node.projectId}/node/${check.node.id}`);
  return { ok: true };
}

/**
 * triggerNode가 DONE이 될 때, 예약된 완료 알림을 실제 확인 요청으로 발송한다.
 * 각 예약마다 targetNode(다음 요구사항)에 대한 RequestNotification을 생성한다.
 * 참조: docs/domain/12-complete-notification.md
 */
async function fireCompleteNotifications(
  triggerNodeId: number,
  senderId: number,
): Promise<void> {
  const reservations = await prisma.completeNotification.findMany({
    where: { triggerNodeId },
    select: { targetNodeId: true, receiverId: true, groupId: true },
  });
  if (reservations.length === 0) return;

  await prisma.requestNotification.createMany({
    data: reservations.map((r) => ({
      senderId,
      receiverId: r.receiverId,
      groupId: r.groupId,
      nodeId: r.targetNodeId,
    })),
  });
  // 수신자의 요청 알림 목록을 최신화.
  revalidatePath("/notifications");
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

/**
 * REQUIREMENT 노드에서 개인 또는 그룹에게 확인 요청을 보낸다.
 * 참조: docs/domain/11-request-notification.md
 * - target은 개인({ receiverId }) 또는 그룹({ groupId }) 중 하나.
 * - 그룹은 노드가 속한 프로젝트의 그룹이어야 한다.
 */
export async function sendRequest(
  nodeId: number,
  target: { receiverId: number } | { groupId: number },
): Promise<NodeActionResult> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const check = await requireRequirementNode(nodeId);
  if (!check.ok) return check.result;

  if ("receiverId" in target) {
    const receiver = await prisma.member.findUnique({
      where: { id: target.receiverId },
      select: { id: true },
    });
    if (!receiver) return { ok: false, error: "존재하지 않는 멤버입니다." };

    await prisma.requestNotification.create({
      data: {
        senderId: member.id,
        receiverId: receiver.id,
        nodeId: check.node.id,
      },
    });
  } else {
    const group = await prisma.memberGroup.findUnique({
      where: { id: target.groupId },
      select: { id: true, projectId: true },
    });
    if (!group || group.projectId !== check.node.projectId) {
      return { ok: false, error: "존재하지 않는 그룹입니다." };
    }

    await prisma.requestNotification.create({
      data: {
        senderId: member.id,
        groupId: group.id,
        nodeId: check.node.id,
      },
    });
  }

  revalidatePath(`/project/${check.node.projectId}/node/${check.node.id}`);
  return { ok: true };
}

/**
 * 완료 알림 예약을 생성한다. 참조: docs/domain/12-complete-notification.md
 * - triggerNode(현재 요구사항)가 DONE이 되면 targetNode에 대한 확인 요청을 발송.
 * - targetNode는 같은 기능(부모) 내의 다른 REQUIREMENT여야 한다.
 * - target은 개인({ receiverId }) 또는 그룹({ groupId }) 중 하나.
 */
export async function createCompleteNotification(
  triggerNodeId: number,
  targetNodeId: number,
  target: { receiverId: number } | { groupId: number },
): Promise<NodeActionResult> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const check = await requireRequirementNode(triggerNodeId);
  if (!check.ok) return check.result;

  if (targetNodeId === triggerNodeId) {
    return { ok: false, error: "자기 자신은 대상으로 선택할 수 없습니다." };
  }

  const [trigger, targetNode] = await Promise.all([
    prisma.node.findUnique({
      where: { id: triggerNodeId },
      select: { parentId: true },
    }),
    prisma.node.findUnique({
      where: { id: targetNodeId },
      select: { level: true, parentId: true },
    }),
  ]);
  if (
    !targetNode ||
    targetNode.level !== "REQUIREMENT" ||
    targetNode.parentId !== trigger?.parentId
  ) {
    return { ok: false, error: "같은 기능 내의 요구사항만 선택할 수 있습니다." };
  }

  if ("receiverId" in target) {
    const receiver = await prisma.member.findUnique({
      where: { id: target.receiverId },
      select: { id: true },
    });
    if (!receiver) return { ok: false, error: "존재하지 않는 멤버입니다." };
    await prisma.completeNotification.create({
      data: { triggerNodeId, targetNodeId, receiverId: receiver.id },
    });
  } else {
    const group = await prisma.memberGroup.findUnique({
      where: { id: target.groupId },
      select: { id: true, projectId: true },
    });
    if (!group || group.projectId !== check.node.projectId) {
      return { ok: false, error: "존재하지 않는 그룹입니다." };
    }
    await prisma.completeNotification.create({
      data: { triggerNodeId, targetNodeId, groupId: group.id },
    });
  }

  revalidatePath(`/project/${check.node.projectId}/node/${triggerNodeId}`);
  return { ok: true };
}

/** 완료 알림 예약을 삭제한다. 참조: docs/domain/12-complete-notification.md */
export async function deleteCompleteNotification(
  id: number,
): Promise<NodeActionResult> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const reservation = await prisma.completeNotification.findUnique({
    where: { id },
    select: { triggerNode: { select: { id: true, projectId: true } } },
  });
  if (!reservation) return { ok: true }; // 이미 삭제됨

  await prisma.completeNotification.delete({ where: { id } });
  revalidatePath(
    `/project/${reservation.triggerNode.projectId}/node/${reservation.triggerNode.id}`,
  );
  return { ok: true };
}

export type EnvNamesResult =
  | { ok: true; names: string[] }
  | { ok: false; error: string };

/**
 * 노드가 속한 프로젝트의 환경변수 이름 목록을 반환한다.
 * Task의 endpoint 입력에서 `{{` 자동완성에 사용한다. (06-task.md)
 */
export async function listNodeEnvNames(nodeId: number): Promise<EnvNamesResult> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { projectId: true },
  });
  if (!node) return { ok: false, error: "존재하지 않는 노드입니다." };

  const envs = await prisma.environment.findMany({
    where: { projectId: node.projectId },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return { ok: true, names: envs.map((e) => e.name) };
}
