// 참조: docs/domain/03-node.md, docs/domain/12-complete-notification.md
// REQUIREMENT 노드 상태 전환의 도메인 로직.
//
// Server Action(node/[nodeId]/actions.ts의 updateNodeStatus)과 HTTP API
// (api/nodes/[id]/route.ts의 PATCH)가 공유한다. actions.ts는 "use server"라
// 그 안의 헬퍼를 API에서 import할 수 없으므로 순수 로직을 여기로 추출했다.
import "server-only";
import { prisma } from "@/lib/prisma";
import { NodeStatus } from "@/generated/prisma/enums";

/** 유효한 NodeStatus 값인지 검증. */
export function isNodeStatus(value: unknown): value is NodeStatus {
  return (
    typeof value === "string" &&
    (Object.values(NodeStatus) as string[]).includes(value)
  );
}

/**
 * triggerNode가 DONE이 될 때, 예약된 완료 알림을 실제 확인 요청으로 발송한다.
 * 각 예약마다 targetNode(다음 요구사항)에 대한 RequestNotification을 생성한다.
 * 참조: docs/domain/12-complete-notification.md
 */
export async function fireCompleteNotifications(
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
}

/**
 * REQUIREMENT 노드의 상태를 변경한다. (웹 updateNodeStatus와 동일 규칙)
 * - 상태 변경은 version 증가 대상이 아니다(이름/설명 수정만 version+1).
 * - 비DONE→DONE: completedAt 기록 + 예약된 완료 알림 발송.
 *   DONE→다른 상태: completedAt 해제(null). 변화 없으면 유지.
 * @param senderId 완료 알림 발송 시 sender로 기록할 멤버 id(토큰 멤버).
 */
export async function applyNodeStatus(
  nodeId: number,
  status: NodeStatus,
  senderId: number,
): Promise<{ id: number; status: NodeStatus; completedAt: Date | null }> {
  const current = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { status: true },
  });

  const toDone = status === "DONE" && current?.status !== "DONE";
  const fromDone = status !== "DONE" && current?.status === "DONE";
  const data = toDone
    ? { status, completedAt: new Date() }
    : fromDone
      ? { status, completedAt: null }
      : { status };

  const updated = await prisma.node.update({
    where: { id: nodeId },
    data,
    select: { id: true, status: true, completedAt: true },
  });

  // 비DONE→DONE 전환 시 예약된 완료 알림을 발송한다. (12-complete-notification.md)
  if (toDone) {
    await fireCompleteNotifications(nodeId, senderId);
  }

  return updated;
}
