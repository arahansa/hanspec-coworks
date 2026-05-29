// 참조: docs/domain/04-node.md (v1.2) — 노드 편집기 (MODULE + FEATURE)
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";

export type NodeActionResult =
  | { ok: true; nodeId: number }
  | { ok: false; error: string };

const NAME_MAX = 255;

/** 로그인 + 프로젝트 존재 확인. */
async function assertAccess(projectId: number): Promise<string | null> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return "존재하지 않는 프로젝트입니다.";
  return null;
}

function validateName(name: string): string | null {
  if (!name.trim()) return "이름을 입력해 주세요.";
  if (name.trim().length > NAME_MAX) return `이름은 ${NAME_MAX}자 이하여야 합니다.`;
  return null;
}

/** MODULE 노드 생성. level=MODULE, parentId=null, version=1. */
export async function createModule(
  projectId: number,
  name: string,
  description: string,
): Promise<NodeActionResult> {
  const accessError = await assertAccess(projectId);
  if (accessError) return { ok: false, error: accessError };

  const nameError = validateName(name);
  if (nameError) return { ok: false, error: nameError };

  const node = await prisma.node.create({
    data: {
      name: name.trim(),
      description: description.trim() || null,
      level: "MODULE",
      parentId: null,
      projectId,
    },
    select: { id: true },
  });

  revalidatePath(`/project/${projectId}/node-mode`);
  return { ok: true, nodeId: node.id };
}

/**
 * FEATURE 노드 생성. 부모는 MODULE이어야 한다.
 * 참조: docs/domain/04-node.md — "노드는 자식노드를 만들 수 있다"
 */
export async function createFeature(
  parentModuleId: number,
  name: string,
  description: string,
): Promise<NodeActionResult> {
  const parent = await prisma.node.findUnique({
    where: { id: parentModuleId },
    select: { id: true, level: true, projectId: true },
  });
  if (!parent) return { ok: false, error: "존재하지 않는 모듈입니다." };
  if (parent.level !== "MODULE") {
    return { ok: false, error: "FEATURE는 MODULE 하위에만 만들 수 있습니다." };
  }

  const accessError = await assertAccess(parent.projectId);
  if (accessError) return { ok: false, error: accessError };

  const nameError = validateName(name);
  if (nameError) return { ok: false, error: nameError };

  const node = await prisma.node.create({
    data: {
      name: name.trim(),
      description: description.trim() || null,
      level: "FEATURE",
      parentId: parent.id,
      projectId: parent.projectId,
    },
    select: { id: true },
  });

  revalidatePath(`/project/${parent.projectId}/node-mode`);
  return { ok: true, nodeId: node.id };
}

/**
 * REQUIREMENT 노드 생성. 부모는 FEATURE이어야 한다.
 * REQUIREMENT는 자식 노드를 만들 수 없다(TASK는 추후).
 * 참조: docs/domain/04-node.md
 */
export async function createRequirement(
  parentFeatureId: number,
  name: string,
  description: string,
): Promise<NodeActionResult> {
  const parent = await prisma.node.findUnique({
    where: { id: parentFeatureId },
    select: { id: true, level: true, projectId: true },
  });
  if (!parent) return { ok: false, error: "존재하지 않는 기능입니다." };
  if (parent.level !== "FEATURE") {
    return { ok: false, error: "REQUIREMENT는 FEATURE 하위에만 만들 수 있습니다." };
  }

  const accessError = await assertAccess(parent.projectId);
  if (accessError) return { ok: false, error: accessError };

  const nameError = validateName(name);
  if (nameError) return { ok: false, error: nameError };

  const node = await prisma.node.create({
    data: {
      name: name.trim(),
      description: description.trim() || null,
      level: "REQUIREMENT",
      parentId: parent.id,
      projectId: parent.projectId,
    },
    select: { id: true },
  });

  revalidatePath(`/project/${parent.projectId}/node-mode`);
  return { ok: true, nodeId: node.id };
}

/** 노드(MODULE/FEATURE 공통) 수정. 수정 시 version을 1 증가시킨다. */
export async function updateNode(
  nodeId: number,
  name: string,
  description: string,
): Promise<NodeActionResult> {
  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { id: true, projectId: true },
  });
  if (!node) return { ok: false, error: "존재하지 않는 노드입니다." };

  const accessError = await assertAccess(node.projectId);
  if (accessError) return { ok: false, error: accessError };

  const nameError = validateName(name);
  if (nameError) return { ok: false, error: nameError };

  await prisma.node.update({
    where: { id: nodeId },
    data: {
      name: name.trim(),
      description: description.trim() || null,
      version: { increment: 1 },
    },
  });

  revalidatePath(`/project/${node.projectId}/node-mode`);
  return { ok: true, nodeId };
}

/** 노드(MODULE/FEATURE 공통) 삭제. 하위 노드는 Cascade로 함께 삭제된다. */
export async function deleteNode(nodeId: number): Promise<NodeActionResult> {
  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { id: true, projectId: true },
  });
  if (!node) return { ok: false, error: "존재하지 않는 노드입니다." };

  const accessError = await assertAccess(node.projectId);
  if (accessError) return { ok: false, error: accessError };

  await prisma.node.delete({ where: { id: nodeId } });

  revalidatePath(`/project/${node.projectId}/node-mode`);
  return { ok: true, nodeId };
}
