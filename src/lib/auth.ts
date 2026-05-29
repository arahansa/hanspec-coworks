// 참조: docs/domain/02-member.md (v1.0) — 멤버 인증/세션
//
// 자체 쿠키 세션. NextAuth(차후 과제) 도입 전까지 사용한다.
// 세션 쿠키 값은 `memberId.issuedAt.signature` 형식이며,
// signature는 SESSION_SECRET 기반 HMAC-SHA256으로 위변조를 막는다.
// 비밀번호는 bcrypt 해시로 저장한다.
import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Member } from "@/generated/prisma/client";

export const SESSION_COOKIE = "coworks_session";

// 자동로그인 체크 시 쿠키 수명(초). 미체크 시에는 maxAge 없는 세션 쿠키.
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // 30일
const BCRYPT_ROUNDS = 10;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET 환경 변수가 설정되지 않았습니다.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/** 평문 비밀번호를 bcrypt 해시로 변환한다. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** 평문 비밀번호와 저장된 해시를 비교한다. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * 멤버 세션 쿠키를 설정한다. Server Action / Route Handler에서만 호출 가능.
 * @param remember 자동로그인 여부 (true면 30일 유지 쿠키, false면 세션 쿠키)
 */
export async function createSession(
  memberId: number,
  remember: boolean,
): Promise<void> {
  const issuedAt = Date.now();
  const payload = `${memberId}.${issuedAt}`;
  const value = `${payload}.${sign(payload)}`;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: REMEMBER_MAX_AGE } : {}),
  });
}

/** 세션 쿠키를 제거한다 (로그아웃). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** 세션 쿠키 값을 검증하고 유효하면 memberId를 반환한다. */
function parseSession(value: string | undefined): number | null {
  if (!value) return null;
  const lastDot = value.lastIndexOf(".");
  if (lastDot < 0) return null;

  const payload = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);
  const expected = sign(payload);

  // 타이밍 공격을 피하기 위해 길이를 맞춘 뒤 timingSafeEqual로 비교.
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  const memberId = Number(payload.split(".")[0]);
  return Number.isInteger(memberId) ? memberId : null;
}

/**
 * 현재 로그인한 멤버를 반환한다. 비로그인이거나 세션이 유효하지 않으면 null.
 * 비밀번호 필드는 제외하고 반환한다.
 */
export async function getCurrentMember(): Promise<Omit<
  Member,
  "password"
> | null> {
  const cookieStore = await cookies();
  const memberId = parseSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (memberId === null) return null;

  return prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      username: true,
      grade: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
