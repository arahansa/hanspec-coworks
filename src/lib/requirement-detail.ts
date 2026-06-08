// 참조: docs/domain/04-node.md, 11-request-notification.md
// 요구사항 상세 본문 데이터를 한 곳에서 조립한다.
// 상세 페이지(서버 컴포넌트)와 모달용 API가 동일한 데이터를 쓰도록 공유한다.
import "server-only";

import { prisma } from "@/lib/prisma";
import type { RequirementDetailData } from "@/app/project/[id]/node/[nodeId]/RequirementDetailBody";

export type LoadRequirementResult =
  | { ok: true; projectId: number; data: RequirementDetailData }
  | { ok: false; reason: "not-found" | "not-requirement" };

/** 요구사항(REQUIREMENT) 노드 id로 상세 본문 데이터를 조립한다. */
export async function loadRequirementDetail(
  reqId: number,
): Promise<LoadRequirementResult> {
  const node = await prisma.node.findUnique({
    where: { id: reqId },
    select: {
      id: true,
      name: true,
      level: true,
      description: true,
      version: true,
      status: true,
      projectId: true,
      // 상위 트리(기능→모듈)를 따라 올라가 빵부스러기를 만든다.
      // children: 같은 기능 내 형제 요구사항(완료 알림 예약 SELECT용). (12)
      parent: {
        select: {
          id: true,
          name: true,
          level: true,
          parent: { select: { id: true, name: true, level: true } },
          children: {
            where: { level: "REQUIREMENT" },
            orderBy: { id: "asc" },
            select: { id: true, name: true },
          },
        },
      },
      project: {
        select: {
          name: true,
          environments: { orderBy: { name: "asc" }, select: { name: true } },
          memberGroups: {
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          },
        },
      },
      tasks: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          progress: true,
          name: true,
          endpoint: true,
          createdAt: true,
        },
      },
      assignees: {
        orderBy: { assignedAt: "asc" },
        select: { member: { select: { id: true, username: true } } },
      },
      // 관련 요구사항(무방향). 이 노드가 nodeA인 행과 nodeB인 행 양쪽을 모은다. (관련 요구사항 v1.0)
      relationsA: {
        orderBy: { nodeBId: "asc" },
        select: { nodeB: { select: { id: true, name: true } } },
      },
      relationsB: {
        orderBy: { nodeAId: "asc" },
        select: { nodeA: { select: { id: true, name: true } } },
      },
      requests: { select: { receiverId: true, groupId: true } },
      // 완료 알림 예약(이 노드가 DONE이 되면 발송). (12)
      completeTriggers: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          targetNodeId: true,
          targetNode: { select: { name: true } },
          receiverId: true,
          receiver: { select: { username: true } },
          groupId: true,
          group: { select: { name: true } },
        },
      },
    },
  });

  if (!node) return { ok: false, reason: "not-found" };
  if (node.level !== "REQUIREMENT") return { ok: false, reason: "not-requirement" };

  const data: RequirementDetailData = {
    id: node.id,
    projectId: node.projectId,
    name: node.name,
    version: node.version,
    description: node.description,
    status: node.status,
    projectName: node.project.name,
    // 양방향 관계를 상대 노드 목록으로 평탄화하고 id 기준 정렬. (관련 요구사항 v1.0)
    related: [
      ...node.relationsA.map((r) => r.nodeB),
      ...node.relationsB.map((r) => r.nodeA),
    ].sort((a, b) => a.id - b.id),
    // 위(모듈)→아래(기능) 순.
    ancestors: [node.parent?.parent, node.parent]
      .filter((a) => a != null)
      .map((a) => ({ id: a!.id, name: a!.name, level: a!.level })),
    assignees: node.assignees.map((a) => ({
      id: a.member.id,
      username: a.member.username,
    })),
    tasks: node.tasks.map((t) => ({
      id: t.id,
      description: t.description,
      progress: t.progress,
      name: t.name,
      endpoint: t.endpoint,
      createdAt: t.createdAt.toISOString(),
    })),
    envNames: node.project.environments.map((e) => e.name),
    groups: node.project.memberGroups,
    requestedMemberIds: node.requests
      .map((r) => r.receiverId)
      .filter((x): x is number => x != null),
    requestedGroupIds: node.requests
      .map((r) => r.groupId)
      .filter((x): x is number => x != null),
    // 같은 기능 내 형제 요구사항(자기 자신 제외). (12)
    siblings: (node.parent?.children ?? []).filter((c) => c.id !== node.id),
    reservations: node.completeTriggers.map((r) => ({
      id: r.id,
      targetNodeId: r.targetNodeId,
      targetNodeName: r.targetNode.name,
      receiverId: r.receiverId,
      receiverName: r.receiver?.username ?? null,
      groupId: r.groupId,
      groupName: r.group?.name ?? null,
    })),
  };

  return { ok: true, projectId: node.projectId, data };
}
