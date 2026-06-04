// 참조: docs/domain/04-node.md (v1.2) — 노드 편집기 (MODULE + FEATURE)
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMemberId } from "@/lib/auth";

export type NodeActionResult =
  | { ok: true; nodeId: number }
  | { ok: false; error: string };

const NAME_MAX = 255;
const ENDPOINT_MAX = 255;
const TAG_MAX = 50;

/**
 * 로그인 여부만 세션 쿠키로 확인한다(DB 왕복 없음).
 * 프로젝트/노드 존재는 각 액션이 이미 조회한 데이터나 FK 제약으로 보장되므로
 * 여기서 별도 조회하지 않는다(불필요한 왕복 제거).
 */
async function assertAuthenticated(): Promise<void> {
  const memberId = await getCurrentMemberId();
  if (memberId === null) redirect("/signin");
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
  await assertAuthenticated();

  const nameError = validateName(name);
  if (nameError) return { ok: false, error: nameError };

  // 존재하지 않는 projectId면 FK 위반(P2003)으로 실패 → 친절한 에러로 변환.
  let node: { id: number };
  try {
    node = await prisma.node.create({
      data: {
        name: name.trim(),
        description: description.trim() || null,
        level: "MODULE",
        parentId: null,
        projectId,
      },
      select: { id: true },
    });
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2003") {
      return { ok: false, error: "존재하지 않는 프로젝트입니다." };
    }
    throw e;
  }

  revalidatePath(`/project/${projectId}/table-view`);
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
  // 인증(세션, DB 왕복 없음)과 부모 조회는 독립이므로 병렬 실행.
  const [, parent] = await Promise.all([
    assertAuthenticated(),
    prisma.node.findUnique({
      where: { id: parentModuleId },
      select: { id: true, level: true, projectId: true },
    }),
  ]);
  if (!parent) return { ok: false, error: "존재하지 않는 모듈입니다." };
  if (parent.level !== "MODULE") {
    return { ok: false, error: "FEATURE는 MODULE 하위에만 만들 수 있습니다." };
  }

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

  revalidatePath(`/project/${parent.projectId}/table-view`);
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
  // 인증(세션, DB 왕복 없음)과 부모 조회는 독립이므로 병렬 실행.
  const [, parent] = await Promise.all([
    assertAuthenticated(),
    prisma.node.findUnique({
      where: { id: parentFeatureId },
      select: { id: true, level: true, projectId: true },
    }),
  ]);
  if (!parent) return { ok: false, error: "존재하지 않는 기능입니다." };
  if (parent.level !== "FEATURE") {
    return { ok: false, error: "REQUIREMENT는 FEATURE 하위에만 만들 수 있습니다." };
  }

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

  revalidatePath(`/project/${parent.projectId}/table-view`);
  return { ok: true, nodeId: node.id };
}

/**
 * 노드(모든 레벨 공통) 수정. 전달된 필드만 갱신하며 version을 1 증가시킨다.
 * 이름 셀 편집과 설명 편집을 분리하기 위해 부분 수정(patch)을 지원한다.
 */
export async function updateNode(
  nodeId: number,
  patch: { name?: string; description?: string; endpoint?: string },
): Promise<NodeActionResult> {
  const [, node] = await Promise.all([
    assertAuthenticated(),
    prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, projectId: true },
    }),
  ]);
  if (!node) return { ok: false, error: "존재하지 않는 노드입니다." };

  const data: {
    name?: string;
    description?: string | null;
    endpoint?: string | null;
    version: { increment: number };
  } = {
    version: { increment: 1 },
  };

  if (patch.name !== undefined) {
    const nameError = validateName(patch.name);
    if (nameError) return { ok: false, error: nameError };
    data.name = patch.name.trim();
  }
  if (patch.description !== undefined) {
    data.description = patch.description.trim() || null;
  }
  if (patch.endpoint !== undefined) {
    const endpoint = patch.endpoint.trim();
    if (endpoint.length > ENDPOINT_MAX) {
      return { ok: false, error: `ENDPOINT는 ${ENDPOINT_MAX}자 이하여야 합니다.` };
    }
    data.endpoint = endpoint || null;
  }

  await prisma.node.update({ where: { id: nodeId }, data });

  revalidatePath(`/project/${node.projectId}/table-view`);
  return { ok: true, nodeId };
}

/** 노드(MODULE/FEATURE 공통) 삭제. 하위 노드는 Cascade로 함께 삭제된다. */
export async function deleteNode(nodeId: number): Promise<NodeActionResult> {
  const [, node] = await Promise.all([
    assertAuthenticated(),
    prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, projectId: true },
    }),
  ]);
  if (!node) return { ok: false, error: "존재하지 않는 노드입니다." };

  await prisma.node.delete({ where: { id: nodeId } });

  revalidatePath(`/project/${node.projectId}/table-view`);
  return { ok: true, nodeId };
}

// ── 태그 (09-feature.md) ──────────────────────────────────────────

export type TagListResult =
  | { ok: true; tags: string[] }
  | { ok: false; error: string };

export type SetTagsResult =
  | { ok: true; tags: string[] }
  | { ok: false; error: string };

/** 자동완성용. 프로젝트에 등록된 태그 이름 목록을 반환한다. */
export async function listProjectTags(projectId: number): Promise<TagListResult> {
  await assertAuthenticated();

  const tags = await prisma.tag.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return { ok: true, tags: tags.map((t) => t.name) };
}

/** 태그 이름을 정규화한다(앞뒤 공백·선행 @ 제거). */
function normalizeTagName(raw: string): string {
  return raw.trim().replace(/^@+/, "").trim();
}

/**
 * FEATURE·REQUIREMENT 노드의 태그를 주어진 목록으로 동기화한다. (05-tag.md)
 * 없는 태그는 프로젝트에 새로 만들고, 빠진 태그 연결은 끊는다.
 * 태그 마스터(Tag) 자체는 다른 노드가 참조할 수 있으므로 삭제하지 않는다.
 */
export async function setNodeTags(
  nodeId: number,
  tagNames: string[],
): Promise<SetTagsResult> {
  const [, node] = await Promise.all([
    assertAuthenticated(),
    prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, level: true, projectId: true },
    }),
  ]);
  if (!node) return { ok: false, error: "존재하지 않는 노드입니다." };
  if (node.level !== "FEATURE" && node.level !== "REQUIREMENT") {
    return {
      ok: false,
      error: "태그는 기능(FEATURE)·요구사항(REQUIREMENT)에만 부여할 수 있습니다.",
    };
  }

  // 정규화 + 중복 제거(대소문자 무시). 표시는 처음 입력된 형태를 유지한다.
  const seen = new Map<string, string>();
  for (const raw of tagNames) {
    const name = normalizeTagName(raw);
    if (!name) continue;
    if (name.length > TAG_MAX) {
      return { ok: false, error: `태그는 ${TAG_MAX}자 이하여야 합니다.` };
    }
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  const names = [...seen.values()];

  await prisma.$transaction(async (tx) => {
    // 없는 태그는 프로젝트 스코프로 생성(있으면 무시)하고 id를 모은다.
    const tagIds: number[] = [];
    for (const name of names) {
      const tag = await tx.tag.upsert({
        where: { projectId_name: { projectId: node.projectId, name } },
        update: {},
        create: { projectId: node.projectId, name },
        select: { id: true },
      });
      tagIds.push(tag.id);
    }
    // 노드-태그 연결을 목록에 맞춰 재설정한다.
    await tx.nodeTag.deleteMany({
      where: { nodeId, tagId: { notIn: tagIds.length ? tagIds : [-1] } },
    });
    if (tagIds.length) {
      await tx.nodeTag.createMany({
        data: tagIds.map((tagId) => ({ nodeId, tagId })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath(`/project/${node.projectId}/table-view`);
  return { ok: true, tags: names };
}
