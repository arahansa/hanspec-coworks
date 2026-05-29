// 참조: docs/domain/04-node.md (v1.1) — 노드 편집기 (1단계: MODULE)
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";

export type ModuleActionResult =
  | { ok: true; nodeId: number }
  | { ok: false; error: string };

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

/** MODULE 노드 생성. level=MODULE, parentId=null, version=1. */
export async function createModule(
  projectId: number,
  name: string,
  description: string,
): Promise<ModuleActionResult> {
  const accessError = await assertAccess(projectId);
  if (accessError) return { ok: false, error: accessError };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "모듈 이름을 입력해 주세요." };
  if (trimmed.length > 255) {
    return { ok: false, error: "모듈 이름은 255자 이하여야 합니다." };
  }

  const node = await prisma.node.create({
    data: {
      name: trimmed,
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

/** MODULE 노드 수정. 수정 시 version을 1 증가시킨다. */
export async function updateModule(
  nodeId: number,
  name: string,
  description: string,
): Promise<ModuleActionResult> {
  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { id: true, projectId: true, level: true },
  });
  if (!node || node.level !== "MODULE") {
    return { ok: false, error: "존재하지 않는 모듈입니다." };
  }

  const accessError = await assertAccess(node.projectId);
  if (accessError) return { ok: false, error: accessError };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "모듈 이름을 입력해 주세요." };
  if (trimmed.length > 255) {
    return { ok: false, error: "모듈 이름은 255자 이하여야 합니다." };
  }

  await prisma.node.update({
    where: { id: nodeId },
    data: {
      name: trimmed,
      description: description.trim() || null,
      version: { increment: 1 },
    },
  });

  revalidatePath(`/project/${node.projectId}/node-mode`);
  return { ok: true, nodeId };
}

/** MODULE 노드 삭제. 하위 노드는 Cascade로 함께 삭제된다. */
export async function deleteModule(
  nodeId: number,
): Promise<ModuleActionResult> {
  const node = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { id: true, projectId: true, level: true },
  });
  if (!node || node.level !== "MODULE") {
    return { ok: false, error: "존재하지 않는 모듈입니다." };
  }

  const accessError = await assertAccess(node.projectId);
  if (accessError) return { ok: false, error: accessError };

  await prisma.node.delete({ where: { id: nodeId } });

  revalidatePath(`/project/${node.projectId}/node-mode`);
  return { ok: true, nodeId };
}
