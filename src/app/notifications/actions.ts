// 참조: docs/domain/11-request-notification.md — 받은 요청 확인(checked) 처리
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMemberId } from "@/lib/auth";

export type CheckResult = { ok: true } | { ok: false; error: string };

/**
 * 받은 요청을 확인(checked) 처리한다.
 * - 개인 요청은 수신자 본인만, 그룹 요청은 그룹 참여자만 확인할 수 있다.
 * - 확인 시 checked=true, checkedAt=현재 시각으로 갱신한다(멱등).
 */
export async function checkRequest(requestId: number): Promise<CheckResult> {
  const memberId = await getCurrentMemberId();
  if (memberId === null) redirect("/signin");

  const req = await prisma.requestNotification.findUnique({
    where: { id: requestId },
    select: { id: true, receiverId: true, groupId: true },
  });
  if (!req) return { ok: false, error: "존재하지 않는 요청입니다." };

  // 수신 권한 확인: 개인 수신자이거나, 그룹 요청이면 그룹 참여자여야 한다.
  let allowed = req.receiverId === memberId;
  if (!allowed && req.groupId !== null) {
    const participant = await prisma.memberGroupParticipant.findFirst({
      where: { groupId: req.groupId, memberId },
      select: { id: true },
    });
    allowed = participant !== null;
  }
  if (!allowed) return { ok: false, error: "확인 권한이 없는 요청입니다." };

  await prisma.requestNotification.update({
    where: { id: req.id },
    data: { checked: true, checkedAt: new Date() },
  });

  revalidatePath("/notifications");
  return { ok: true };
}

/**
 * 보낸 확인 요청을 철회(삭제)한다.
 * - 보낸 본인(senderId)만 삭제할 수 있다.
 * - 아직 확인되지 않은(checked=false) 요청만 삭제할 수 있다. 확인된 요청은 기록으로 보존.
 * - 이미 삭제된 경우는 멱등 처리한다.
 */
export async function deleteRequest(requestId: number): Promise<CheckResult> {
  const memberId = await getCurrentMemberId();
  if (memberId === null) redirect("/signin");

  const req = await prisma.requestNotification.findUnique({
    where: { id: requestId },
    select: { id: true, senderId: true, checked: true },
  });
  if (!req) return { ok: true }; // 이미 삭제됨 — 멱등

  if (req.senderId !== memberId) {
    return { ok: false, error: "본인이 보낸 요청만 취소할 수 있습니다." };
  }
  if (req.checked) {
    return { ok: false, error: "이미 확인된 요청은 취소할 수 없습니다." };
  }

  await prisma.requestNotification.delete({ where: { id: req.id } });

  revalidatePath("/notifications");
  return { ok: true };
}
