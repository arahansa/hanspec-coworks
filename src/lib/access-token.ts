// 참조: docs/domain/08-access_token.md (v1.0) — 액세스 토큰 발급/조회
//
// 멤버당 1개의 액세스 토큰. 유효기간은 발급일(createdAt)로부터 7일이며,
// 만료 컬럼 없이 애플리케이션에서 파생 계산한다.
import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** 액세스 토큰 유효기간(일). */
export const TOKEN_TTL_DAYS = 7;

const TOKEN_TTL_MS = TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

/** 임의의 액세스 토큰 문자열을 생성한다. */
export function generateTokenString(): string {
  return randomBytes(32).toString("base64url");
}

/** 발급일 기준 만료 시각을 계산한다. */
export function computeExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + TOKEN_TTL_MS);
}

/** 발급일 기준 현재 만료 여부를 반환한다. */
export function isExpired(createdAt: Date): boolean {
  return Date.now() > computeExpiresAt(createdAt).getTime();
}

export type AccessTokenView = {
  token: string;
  createdAt: Date;
  expiresAt: Date;
  expired: boolean;
};

/**
 * 멤버의 현재 액세스 토큰을 조회한다. 없으면 null.
 * 만료 시각·만료 여부를 파생 계산해 함께 반환한다.
 */
export async function getAccessToken(
  userId: number,
): Promise<AccessTokenView | null> {
  const row = await prisma.accessToken.findUnique({
    where: { userId },
    select: { token: true, createdAt: true },
  });
  if (!row) return null;

  return {
    token: row.token,
    createdAt: row.createdAt,
    expiresAt: computeExpiresAt(row.createdAt),
    expired: isExpired(row.createdAt),
  };
}
