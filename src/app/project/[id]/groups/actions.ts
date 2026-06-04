// 참조: docs/domain/10-user-group.md — 프로젝트 멤버 그룹 CRUD + 참여 관리
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember, getCurrentMemberId } from "@/lib/auth";

export type GroupActionResult =
  | { ok: true; id?: number }
  | { ok: false; error: string };

const NAME_MAX = 255;

/** 로그인 여부만 세션 쿠키로 확인하고 memberId를 반환한다. */
async function requireMemberId(): Promise<number> {
  const memberId = await getCurrentMemberId();
  if (memberId === null) redirect("/signin");
  return memberId;
}

/** SUPER 멤버만 허용. 아니면 차단. */
async function assertSuper(): Promise<void> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");
  if (member.grade !== "SUPER") redirect("/");
}

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "그룹 이름을 입력해 주세요.";
  if (trimmed.length > NAME_MAX) return `그룹 이름은 ${NAME_MAX}자 이하여야 합니다.`;
  return null;
}

function prismaCode(e: unknown): string | undefined {
  if (e instanceof Error && "code" in e) {
    return (e as { code?: string }).code;
  }
  return undefined;
}

/** 그룹의 projectId를 조회한다(revalidate 경로 계산용). */
async function groupProjectId(groupId: number): Promise<number | null> {
  const group = await prisma.memberGroup.findUnique({
    where: { id: groupId },
    select: { projectId: true },
  });
  return group?.projectId ?? null;
}

// ── 관리자(SUPER) 전용: 그룹 CRUD ───────────────────────────────

/** 그룹 생성. SUPER 전용. */
export async function createGroup(
  projectId: number,
  name: string,
): Promise<GroupActionResult> {
  await assertSuper();

  const nameError = validateName(name);
  if (nameError) return { ok: false, error: nameError };

  try {
    const group = await prisma.memberGroup.create({
      data: { projectId, name: name.trim() },
      select: { id: true },
    });
    revalidatePath(`/project/${projectId}/groups`);
    return { ok: true, id: group.id };
  } catch (e) {
    if (prismaCode(e) === "P2003") {
      return { ok: false, error: "존재하지 않는 프로젝트입니다." };
    }
    throw e;
  }
}

/** 그룹명 수정. SUPER 전용. */
export async function renameGroup(
  groupId: number,
  name: string,
): Promise<GroupActionResult> {
  await assertSuper();

  const nameError = validateName(name);
  if (nameError) return { ok: false, error: nameError };

  const projectId = await groupProjectId(groupId);
  if (projectId === null) return { ok: false, error: "존재하지 않는 그룹입니다." };

  await prisma.memberGroup.update({
    where: { id: groupId },
    data: { name: name.trim() },
  });
  revalidatePath(`/project/${projectId}/groups`);
  return { ok: true, id: groupId };
}

/** 그룹 삭제. SUPER 전용. 참여 정보(member_group_participant)는 cascade 삭제된다. */
export async function deleteGroup(
  groupId: number,
): Promise<GroupActionResult> {
  await assertSuper();

  const projectId = await groupProjectId(groupId);
  if (projectId === null) return { ok: false, error: "존재하지 않는 그룹입니다." };

  await prisma.memberGroup.delete({ where: { id: groupId } });
  revalidatePath(`/project/${projectId}/groups`);
  return { ok: true, id: groupId };
}

// ── 관리자(SUPER) 전용: 임의 멤버 배치/해제 ──────────────────────

/** 임의의 멤버를 그룹에 배치한다. SUPER 전용. */
export async function assignMember(
  groupId: number,
  memberId: number,
): Promise<GroupActionResult> {
  await assertSuper();

  const projectId = await groupProjectId(groupId);
  if (projectId === null) return { ok: false, error: "존재하지 않는 그룹입니다." };

  try {
    await prisma.memberGroupParticipant.create({
      data: { groupId, memberId },
    });
  } catch (e) {
    // 이미 참여 중(P2002)이면 무시한다.
    if (prismaCode(e) === "P2003") {
      return { ok: false, error: "존재하지 않는 멤버 또는 그룹입니다." };
    }
    if (prismaCode(e) !== "P2002") throw e;
  }
  revalidatePath(`/project/${projectId}/groups`);
  return { ok: true };
}

/** 임의의 멤버를 그룹에서 해제한다. SUPER 전용. */
export async function unassignMember(
  groupId: number,
  memberId: number,
): Promise<GroupActionResult> {
  await assertSuper();

  const projectId = await groupProjectId(groupId);
  if (projectId === null) return { ok: false, error: "존재하지 않는 그룹입니다." };

  await prisma.memberGroupParticipant.deleteMany({
    where: { groupId, memberId },
  });
  revalidatePath(`/project/${projectId}/groups`);
  return { ok: true };
}

// ── 일반 사용자: 본인 참여/해제 ─────────────────────────────────

/** 현재 로그인 멤버가 그룹에 참여한다. */
export async function joinGroup(
  groupId: number,
): Promise<GroupActionResult> {
  const memberId = await requireMemberId();

  const projectId = await groupProjectId(groupId);
  if (projectId === null) return { ok: false, error: "존재하지 않는 그룹입니다." };

  try {
    await prisma.memberGroupParticipant.create({
      data: { groupId, memberId },
    });
  } catch (e) {
    // 이미 참여 중(P2002)이면 무시한다.
    if (prismaCode(e) !== "P2002") throw e;
  }
  revalidatePath(`/project/${projectId}/groups`);
  return { ok: true };
}

/** 현재 로그인 멤버가 그룹에서 나간다. */
export async function leaveGroup(
  groupId: number,
): Promise<GroupActionResult> {
  const memberId = await requireMemberId();

  const projectId = await groupProjectId(groupId);
  if (projectId === null) return { ok: false, error: "존재하지 않는 그룹입니다." };

  await prisma.memberGroupParticipant.deleteMany({
    where: { groupId, memberId },
  });
  revalidatePath(`/project/${projectId}/groups`);
  return { ok: true };
}
