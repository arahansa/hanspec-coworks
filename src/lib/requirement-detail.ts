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
      parent: {
        select: {
          id: true,
          name: true,
          level: true,
          parent: { select: { id: true, name: true, level: true } },
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
      requests: { select: { receiverId: true, groupId: true } },
    },
  });

  if (!node) return { ok: false, reason: "not-found" };
  if (node.level !== "REQUIREMENT") return { ok: false, reason: "not-requirement" };

  const data: RequirementDetailData = {
    id: node.id,
    name: node.name,
    version: node.version,
    description: node.description,
    status: node.status,
    projectName: node.project.name,
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
  };

  return { ok: true, projectId: node.projectId, data };
}
