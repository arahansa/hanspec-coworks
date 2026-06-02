// 참조: docs/domain/07-environment.md — 프로젝트별 환경변수 CRUD
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMemberId } from "@/lib/auth";

export type EnvActionResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

const NAME_MAX = 50;
const VALUE_MAX = 255;

/** 로그인 여부만 세션 쿠키로 확인한다(DB 왕복 없음). */
async function assertAuthenticated(): Promise<void> {
  const memberId = await getCurrentMemberId();
  if (memberId === null) redirect("/signin");
}

/** 필드명을 검증한다. 영문/숫자/언더스코어만 허용(.env 호환). */
function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "필드명을 입력해 주세요.";
  if (trimmed.length > NAME_MAX) return `필드명은 ${NAME_MAX}자 이하여야 합니다.`;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    return "필드명은 영문/숫자/언더스코어만 사용할 수 있고 숫자로 시작할 수 없습니다.";
  }
  return null;
}

function validateValue(value: string): string | null {
  if (value.length > VALUE_MAX) return `변수값은 ${VALUE_MAX}자 이하여야 합니다.`;
  return null;
}

/** 환경변수 생성. 같은 프로젝트 내 필드명은 유일하다. */
export async function createEnvironment(
  projectId: number,
  name: string,
  value: string,
): Promise<EnvActionResult> {
  await assertAuthenticated();

  const nameError = validateName(name);
  if (nameError) return { ok: false, error: nameError };
  const valueError = validateValue(value);
  if (valueError) return { ok: false, error: valueError };

  try {
    const env = await prisma.environment.create({
      data: { projectId, name: name.trim(), value },
      select: { id: true },
    });
    revalidatePath(`/project/${projectId}/environment`);
    return { ok: true, id: env.id };
  } catch (e) {
    if (e instanceof Error && "code" in e) {
      const code = (e as { code?: string }).code;
      if (code === "P2002") return { ok: false, error: "이미 존재하는 필드명입니다." };
      if (code === "P2003") return { ok: false, error: "존재하지 않는 프로젝트입니다." };
    }
    throw e;
  }
}

/** 환경변수 수정(필드명·변수값). */
export async function updateEnvironment(
  id: number,
  name: string,
  value: string,
): Promise<EnvActionResult> {
  const [, env] = await Promise.all([
    assertAuthenticated(),
    prisma.environment.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    }),
  ]);
  if (!env) return { ok: false, error: "존재하지 않는 환경변수입니다." };

  const nameError = validateName(name);
  if (nameError) return { ok: false, error: nameError };
  const valueError = validateValue(value);
  if (valueError) return { ok: false, error: valueError };

  try {
    await prisma.environment.update({
      where: { id },
      data: { name: name.trim(), value },
    });
    revalidatePath(`/project/${env.projectId}/environment`);
    return { ok: true, id };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, error: "이미 존재하는 필드명입니다." };
    }
    throw e;
  }
}

/** 환경변수 삭제. */
export async function deleteEnvironment(id: number): Promise<EnvActionResult> {
  const [, env] = await Promise.all([
    assertAuthenticated(),
    prisma.environment.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    }),
  ]);
  if (!env) return { ok: false, error: "존재하지 않는 환경변수입니다." };

  await prisma.environment.delete({ where: { id } });
  revalidatePath(`/project/${env.projectId}/environment`);
  return { ok: true, id };
}
