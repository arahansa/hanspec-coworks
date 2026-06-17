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
import { applyNodeStatus } from "@/lib/node-status";
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

  // 상태 전환 + completedAt 처리 + 완료 알림 발송(공통 로직). HTTP API와 공유한다.
  await applyNodeStatus(check.node.id, status, member.id);

  revalidatePath(`/project/${check.node.projectId}/node/${check.node.id}`);
  // 완료 알림이 발송됐을 수 있으니 수신자의 요청 알림 목록도 최신화.
  revalidatePath("/notifications");
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

/**
 * 두 요구사항을 "관련"으로 연결한다. (관련 요구사항 설계 v1.0)
 * - 무방향: 항상 작은 id가 nodeAId가 되도록 정규화해 한 행으로 저장한다.
 * - 둘 다 REQUIREMENT, 같은 프로젝트, 자기 자신 아님을 검증.
 * - 복합키 upsert로 중복 연결을 멱등 처리한다.
 * 참조: docs/superpowers/specs/2026-06-08-related-requirement-design.md
 */
export async function addRelation(
  nodeId: number,
  otherId: number,
): Promise<NodeActionResult> {
  const check = await requireRequirementNode(nodeId);
  if (!check.ok) return check.result;

  if (otherId === nodeId) {
    return { ok: false, error: "자기 자신은 연결할 수 없습니다." };
  }

  const other = await prisma.node.findUnique({
    where: { id: otherId },
    select: { id: true, level: true, projectId: true },
  });
  if (!other) return { ok: false, error: "존재하지 않는 노드입니다." };
  if (other.level !== "REQUIREMENT") {
    return { ok: false, error: "요구사항(REQUIREMENT)끼리만 연결할 수 있습니다." };
  }
  if (other.projectId !== check.node.projectId) {
    return { ok: false, error: "같은 프로젝트의 요구사항만 연결할 수 있습니다." };
  }

  const [a, b] = nodeId < otherId ? [nodeId, otherId] : [otherId, nodeId];
  await prisma.nodeRelation.upsert({
    where: { nodeAId_nodeBId: { nodeAId: a, nodeBId: b } },
    create: { nodeAId: a, nodeBId: b },
    update: {},
  });

  // 무방향이므로 양쪽 상세를 모두 최신화한다.
  revalidatePath(`/project/${check.node.projectId}/node/${nodeId}`);
  revalidatePath(`/project/${check.node.projectId}/node/${otherId}`);
  return { ok: true };
}

/**
 * 두 요구사항의 "관련" 연결을 해제한다. (관련 요구사항 설계 v1.0)
 * - 정규화 후 delete. 연결이 없으면(P2025) 무시한다.
 */
export async function removeRelation(
  nodeId: number,
  otherId: number,
): Promise<NodeActionResult> {
  const check = await requireRequirementNode(nodeId);
  if (!check.ok) return check.result;

  const [a, b] = nodeId < otherId ? [nodeId, otherId] : [otherId, nodeId];
  try {
    await prisma.nodeRelation.delete({
      where: { nodeAId_nodeBId: { nodeAId: a, nodeBId: b } },
    });
  } catch (e) {
    // 이미 해제된 경우(P2025)는 정상 처리. 그 외는 전파.
    if (
      !(e instanceof Error && "code" in e && (e as { code?: string }).code === "P2025")
    ) {
      throw e;
    }
  }

  revalidatePath(`/project/${check.node.projectId}/node/${nodeId}`);
  revalidatePath(`/project/${check.node.projectId}/node/${otherId}`);
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

// ── coworks ↔ Claude 양방향 대화 (01-talk-ai-user.md) ──────────────────────

export type MessageActionResult =
  | { ok: true; messageId: number }
  | { ok: false; error: string };

/**
 * 사용자(USER)가 Claude의 QUESTION에 답한다(웹 UI).
 * - 세션 로그인 검증, 대상이 QUESTION·미답변인지 검증.
 * - selectedOption(버튼) 또는 body(자유 텍스트) 중 최소 하나 필요.
 * - ANSWER 생성 + 부모 QUESTION을 ANSWERED로 전환(한 트랜잭션).
 */
export async function answerMessage(
  questionId: number,
  input: { selectedOption?: number; body?: string },
): Promise<MessageActionResult> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const question = await prisma.nodeMessage.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      nodeId: true,
      kind: true,
      status: true,
      options: true,
      node: { select: { projectId: true } },
    },
  });
  if (!question) return { ok: false, error: "존재하지 않는 메시지입니다." };
  if (question.kind !== "QUESTION") {
    return { ok: false, error: "질문에만 답할 수 있습니다." };
  }
  if (question.status === "ANSWERED") {
    return { ok: false, error: "이미 답변된 질문입니다." };
  }

  const options = Array.isArray(question.options)
    ? question.options.map((o) => String(o))
    : [];
  let selectedOption: number | null = null;
  if (input.selectedOption !== undefined && input.selectedOption !== null) {
    const idx = input.selectedOption;
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      return { ok: false, error: "선택한 옵션이 올바르지 않습니다." };
    }
    selectedOption = idx;
  }
  const freeText = typeof input.body === "string" ? input.body.trim() : "";
  if (selectedOption === null && freeText.length === 0) {
    return { ok: false, error: "답변을 입력하거나 선택지를 골라 주세요." };
  }
  const answerBody =
    freeText.length > 0 ? freeText : options[selectedOption as number];

  const answer = await prisma.$transaction(async (tx) => {
    const created = await tx.nodeMessage.create({
      data: {
        nodeId: question.nodeId,
        role: "USER",
        kind: "ANSWER",
        status: null,
        body: answerBody,
        selectedOption,
        parentId: question.id,
        authorMemberId: member.id,
      },
      select: { id: true },
    });
    await tx.nodeMessage.update({
      where: { id: question.id },
      data: { status: "ANSWERED" },
    });
    return created;
  });

  revalidatePath(
    `/project/${question.node.projectId}/node/${question.nodeId}`,
  );
  return { ok: true, messageId: answer.id };
}

/**
 * 사용자(USER)가 자유 추가 지시(INSTRUCTION)를 남긴다(웹 UI).
 * - 세션 로그인 + 노드 존재·REQUIREMENT 검증.
 * - PENDING으로 생성되어 Claude가 /loop 폴링으로 픽업한다.
 */
export async function addInstruction(
  nodeId: number,
  body: string,
): Promise<MessageActionResult> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const guard = await requireRequirementNode(nodeId);
  if (!guard.ok) {
    const r = guard.result;
    return { ok: false, error: r.ok ? "잘못된 요청입니다." : r.error };
  }

  const text = typeof body === "string" ? body.trim() : "";
  if (text.length === 0) return { ok: false, error: "지시 내용을 입력해 주세요." };
  if (text.length > 8000) {
    return { ok: false, error: "지시는 8000자 이내여야 합니다." };
  }

  const created = await prisma.nodeMessage.create({
    data: {
      nodeId: guard.node.id,
      role: "USER",
      kind: "INSTRUCTION",
      status: "PENDING",
      body: text,
      authorMemberId: member.id,
    },
    select: { id: true },
  });

  revalidatePath(`/project/${guard.node.projectId}/node/${guard.node.id}`);
  return { ok: true, messageId: created.id };
}
