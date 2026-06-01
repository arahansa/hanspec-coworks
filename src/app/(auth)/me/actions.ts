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
  try {
    await prisma.accessToken.upsert({
      where: { userId: member.id },
      create: { userId: member.id, token },
      // 재갱신: 토큰 문자열을 새로 발급하고 발급일을 현재로 갱신.
      // createdAt은 @default(now())가 update에는 적용되지 않으므로 명시한다.
      // 만료 판정(getAccessToken)도 동일하게 앱 시계를 쓰므로 발급·판정이 일관된다.
      update: { token, createdAt: new Date() },
    });
  } catch (error) {
    // DB 쓰기 실패 시 raw 500 대신 의미 있는 에러를 던져 error 바운더리가 처리하게 한다.
    throw new Error("액세스 토큰 발급에 실패했습니다. 잠시 후 다시 시도해 주세요.", {
      cause: error,
    });
  }

  revalidatePath("/me");
}
