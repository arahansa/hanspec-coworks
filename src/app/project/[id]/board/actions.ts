// 참조: docs/domain/03-node.md, docs/domain/12-complete-notification.md,
//       docs/superpowers/specs/2026-06-02-node-status-assignee-design.md (v1.0)
// 보드(칸반) 화면 전용 server action. 카드를 다른 컬럼으로 드롭하면 상태를 전환한다.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { NodeStatus } from "@/generated/prisma/enums";
import { applyNodeStatus } from "@/lib/node-status";

export type BoardActionResult = { ok: true } | { ok: false; error: string };

/**
 * 보드에서 카드(REQUIREMENT)를 다른 상태 컬럼으로 옮긴다.
 * 상태 전환·completedAt 처리·완료 알림 발송은 applyNodeStatus가 공통으로 담당한다.
 * (테이블뷰/상세 화면의 상태 변경과 완전히 동일한 규칙)
 */
export async function moveCardStatus(
  nodeId: number,
  status: NodeStatus,
): Promise<BoardActionResult> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  if (!Object.values(NodeStatus).includes(status)) {
    return { ok: false, error: "알 수 없는 상태입니다." };
  }

  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { id: true, level: true, projectId: true, status: true },
  });
  if (!node) return { ok: false, error: "존재하지 않는 노드입니다." };
  if (node.level !== "REQUIREMENT") {
    return { ok: false, error: "요구사항만 보드에서 옮길 수 있습니다." };
  }
  // 같은 컬럼으로의 드롭은 변경 없음.
  if (node.status === status) return { ok: true };

  await applyNodeStatus(node.id, status, member.id);

  revalidatePath(`/project/${node.projectId}/board`);
  revalidatePath(`/project/${node.projectId}/table-view`);
  revalidatePath(`/project/${node.projectId}/node/${node.id}`);
  // 완료 알림이 발송됐을 수 있으니 수신자의 요청 알림 목록도 최신화.
  revalidatePath("/notifications");
  return { ok: true };
}
