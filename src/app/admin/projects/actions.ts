// 참조: docs/domain/01-project.md (v1.0), docs/domain/03-admin.md (v1.0)
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";

export type ProjectFormState = { error: string | null };

/** name에서 URL-safe slug를 생성한다. */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** SUPER 멤버만 허용. 아니면 차단. */
async function assertSuper(): Promise<void> {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");
  if (member.grade !== "SUPER") redirect("/");
}

function parseForm(formData: FormData): {
  name: string;
  slug: string;
  description: string | null;
} {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  // slug 미입력 시 name에서 자동 생성.
  const slug = slugify(rawSlug || name);
  return { name, slug, description: description || null };
}

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await assertSuper();
  const { name, slug, description } = parseForm(formData);

  if (!name) return { error: "프로젝트 이름을 입력해 주세요." };
  if (!slug) return { error: "슬러그를 생성할 수 없습니다. 이름이나 슬러그를 확인해 주세요." };

  try {
    await prisma.project.create({ data: { name, slug, description } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "이미 사용 중인 슬러그입니다." };
    }
    throw error;
  }

  revalidatePath("/admin/projects");
  redirect("/admin/projects");
}

export async function updateProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await assertSuper();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "잘못된 프로젝트입니다." };

  const { name, slug, description } = parseForm(formData);
  if (!name) return { error: "프로젝트 이름을 입력해 주세요." };
  if (!slug) return { error: "슬러그를 생성할 수 없습니다. 이름이나 슬러그를 확인해 주세요." };

  try {
    await prisma.project.update({
      where: { id },
      data: { name, slug, description },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return { error: "이미 사용 중인 슬러그입니다." };
      if (error.code === "P2025") return { error: "존재하지 않는 프로젝트입니다." };
    }
    throw error;
  }

  revalidatePath("/admin/projects");
  redirect("/admin/projects");
}

export async function deleteProject(formData: FormData): Promise<void> {
  await assertSuper();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  try {
    await prisma.project.delete({ where: { id } });
  } catch (error) {
    // 이미 삭제된 경우(P2025)는 무시한다.
    if (
      !(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      )
    ) {
      throw error;
    }
  }

  revalidatePath("/admin/projects");
}
