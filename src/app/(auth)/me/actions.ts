// 참조: docs/domain/08-access_token.md (v1.0) — 액세스 토큰 발급/재갱신
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { generateTokenString } from "@/lib/access-token";

/**
 * 현재 로그인한 멤버의 액세스 토큰을 발급(없으면 생성, 있으면 교체)한다.
 * 멤버당 1개(userId unique)이므로 upsert로 발급/재갱신을 함께 처리한다.
 */
export async function issueAccessToken(): Promise<void> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const token = generateTokenString();
  await prisma.accessToken.upsert({
    where: { userId: member.id },
    create: { userId: member.id, token },
    // 재갱신: 토큰 문자열을 새로 발급하고 발급일을 현재로 갱신.
    update: { token, createdAt: new Date() },
  });

  revalidatePath("/me");
}
