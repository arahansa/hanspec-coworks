// 참조: docs/domain/02-member.md (v1.0) — 가입/로그인/로그아웃
"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

export type AuthState = { error: string | null };

const USERNAME_MAX = 20;
const PASSWORD_MIN = 8;

/**
 * 가입: username 중복 체크, password 8자 이상 체크, grade는 GENERAL 고정.
 * 성공 시 자동 로그인된 상태로 Home으로 이동한다.
 */
export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  if (!username) {
    return { error: "이름을 입력해 주세요." };
  }
  if (username.length > USERNAME_MAX) {
    return { error: `이름은 최대 ${USERNAME_MAX}자까지 가능합니다.` };
  }
  if (password.length < PASSWORD_MIN) {
    return { error: `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.` };
  }

  const hashed = await hashPassword(password);

  let memberId: number;
  try {
    const member = await prisma.member.create({
      data: { username, password: hashed, grade: "GENERAL" },
      select: { id: true },
    });
    memberId = member.id;
  } catch (error) {
    // unique 제약 위반(P2002) → username 중복
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "이미 사용 중인 이름입니다." };
    }
    throw error;
  }

  await createSession(memberId, remember);
  redirect("/");
}

/** 로그인: 이름·비밀번호 검증. 성공 시 Home으로 이동. */
export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  if (!username || !password) {
    return { error: "이름과 비밀번호를 입력해 주세요." };
  }

  const member = await prisma.member.findUnique({
    where: { username },
    select: { id: true, password: true },
  });

  // 사용자 존재 여부를 노출하지 않도록 동일한 메시지를 반환한다.
  if (!member || !(await verifyPassword(password, member.password))) {
    return { error: "이름 또는 비밀번호가 올바르지 않습니다." };
  }

  await createSession(member.id, remember);
  redirect("/");
}

/** 로그아웃: 세션 제거 후 Home으로 이동. */
export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/");
}
