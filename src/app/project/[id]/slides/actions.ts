// 참조: docs/superpowers/specs/2026-06-22-slides-design.md
// 슬라이드 기획서: 페이지/섹션/코멘트 CRUD + 본문 수정 + 새 버전 생성 Server Action.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentMemberId } from "@/lib/auth";

export type SlideActionResult =
  | { ok: true; id?: number }
  | { ok: false; error: string };

const TITLE_MAX = 255;
const COMMENT_MAX = 10_000;
const DOCUMENT_MAX = 5_000_000; // 직렬화 문자열 길이 상한(바이트 근사)

/** 로그인 여부만 세션 쿠키로 확인한다(기존 웹 페이지 관례와 동일). */
async function assertAuthenticated(): Promise<void> {
  const memberId = await getCurrentMemberId();
  if (memberId === null) redirect("/signin");
}

function validateTitle(title: string, label: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return `${label}을(를) 입력해 주세요.`;
  if (trimmed.length > TITLE_MAX) return `${label}은(는) ${TITLE_MAX}자 이하여야 합니다.`;
  return null;
}

// ── 페이지 ─────────────────────────────────────────────────────────────────

/**
 * 페이지를 생성한다. position은 프로젝트 내 최대값+1.
 * 초기 버전(Slide v1, 빈 본문)을 함께 만든다.
 */
export async function createSlidePage(
  projectId: number,
  title: string,
): Promise<SlideActionResult> {
  await assertAuthenticated();

  const titleError = validateTitle(title, "페이지 제목");
  if (titleError) return { ok: false, error: titleError };

  const last = await prisma.slidePage.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? 0) + 1;

  try {
    const page = await prisma.slidePage.create({
      data: {
        projectId,
        title: title.trim(),
        position,
        versions: { create: { version: 1 } },
      },
      select: { id: true },
    });
    revalidatePath(`/project/${projectId}/slides`);
    return { ok: true, id: page.id };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2003") {
      return { ok: false, error: "존재하지 않는 프로젝트입니다." };
    }
    throw e;
  }
}

/** 페이지 제목 변경. */
export async function renameSlidePage(
  pageId: number,
  title: string,
): Promise<SlideActionResult> {
  const [, page] = await Promise.all([
    assertAuthenticated(),
    prisma.slidePage.findUnique({
      where: { id: pageId },
      select: { id: true, projectId: true },
    }),
  ]);
  if (!page) return { ok: false, error: "존재하지 않는 페이지입니다." };

  const titleError = validateTitle(title, "페이지 제목");
  if (titleError) return { ok: false, error: titleError };

  await prisma.slidePage.update({
    where: { id: pageId },
    data: { title: title.trim() },
  });
  revalidatePath(`/project/${page.projectId}/slides`);
  revalidatePath(`/project/${page.projectId}/slides/${pageId}`);
  return { ok: true, id: pageId };
}

/** 페이지 삭제(버전·코멘트·섹션 연결은 Cascade로 함께 삭제). */
export async function deleteSlidePage(pageId: number): Promise<SlideActionResult> {
  const [, page] = await Promise.all([
    assertAuthenticated(),
    prisma.slidePage.findUnique({
      where: { id: pageId },
      select: { id: true, projectId: true },
    }),
  ]);
  if (!page) return { ok: false, error: "존재하지 않는 페이지입니다." };

  await prisma.slidePage.delete({ where: { id: pageId } });
  revalidatePath(`/project/${page.projectId}/slides`);
  return { ok: true, id: pageId };
}

// ── 섹션(구역) ──────────────────────────────────────────────────────────────

/** 섹션 생성. position은 프로젝트 내 최대값+1. */
export async function createSlideSection(
  projectId: number,
  name: string,
): Promise<SlideActionResult> {
  await assertAuthenticated();

  const nameError = validateTitle(name, "섹션 이름");
  if (nameError) return { ok: false, error: nameError };

  const last = await prisma.slideSection.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? 0) + 1;

  try {
    const section = await prisma.slideSection.create({
      data: { projectId, name: name.trim(), position },
      select: { id: true },
    });
    revalidatePath(`/project/${projectId}/slides`);
    return { ok: true, id: section.id };
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2003") {
      return { ok: false, error: "존재하지 않는 프로젝트입니다." };
    }
    throw e;
  }
}

/** 섹션 이름 변경. */
export async function renameSlideSection(
  sectionId: number,
  name: string,
): Promise<SlideActionResult> {
  const [, section] = await Promise.all([
    assertAuthenticated(),
    prisma.slideSection.findUnique({
      where: { id: sectionId },
      select: { id: true, projectId: true },
    }),
  ]);
  if (!section) return { ok: false, error: "존재하지 않는 섹션입니다." };

  const nameError = validateTitle(name, "섹션 이름");
  if (nameError) return { ok: false, error: nameError };

  await prisma.slideSection.update({
    where: { id: sectionId },
    data: { name: name.trim() },
  });
  revalidatePath(`/project/${section.projectId}/slides`);
  return { ok: true, id: sectionId };
}

/** 섹션 삭제(페이지는 남고 섹션 연결만 Cascade로 끊어진다). */
export async function deleteSlideSection(
  sectionId: number,
): Promise<SlideActionResult> {
  const [, section] = await Promise.all([
    assertAuthenticated(),
    prisma.slideSection.findUnique({
      where: { id: sectionId },
      select: { id: true, projectId: true },
    }),
  ]);
  if (!section) return { ok: false, error: "존재하지 않는 섹션입니다." };

  await prisma.slideSection.delete({ where: { id: sectionId } });
  revalidatePath(`/project/${section.projectId}/slides`);
  return { ok: true, id: sectionId };
}

/** 섹션에 페이지를 배치한다(같은 프로젝트만, 중복은 멱등). */
export async function assignPageToSection(
  sectionId: number,
  pageId: number,
): Promise<SlideActionResult> {
  await assertAuthenticated();

  const [section, page] = await Promise.all([
    prisma.slideSection.findUnique({
      where: { id: sectionId },
      select: { id: true, projectId: true },
    }),
    prisma.slidePage.findUnique({
      where: { id: pageId },
      select: { id: true, projectId: true },
    }),
  ]);
  if (!section) return { ok: false, error: "존재하지 않는 섹션입니다." };
  if (!page) return { ok: false, error: "존재하지 않는 페이지입니다." };
  if (section.projectId !== page.projectId) {
    return { ok: false, error: "같은 프로젝트의 페이지만 배치할 수 있습니다." };
  }

  await prisma.slideSectionPage.upsert({
    where: { sectionId_pageId: { sectionId, pageId } },
    create: { sectionId, pageId },
    update: {},
  });
  revalidatePath(`/project/${section.projectId}/slides`);
  return { ok: true };
}

/** 섹션에서 페이지를 제거한다(연결이 없으면 멱등). */
export async function removePageFromSection(
  sectionId: number,
  pageId: number,
): Promise<SlideActionResult> {
  await assertAuthenticated();

  const section = await prisma.slideSection.findUnique({
    where: { id: sectionId },
    select: { projectId: true },
  });

  try {
    await prisma.slideSectionPage.delete({
      where: { sectionId_pageId: { sectionId, pageId } },
    });
  } catch (e) {
    if (
      !(e instanceof Error && "code" in e && (e as { code?: string }).code === "P2025")
    ) {
      throw e;
    }
  }
  if (section) revalidatePath(`/project/${section.projectId}/slides`);
  return { ok: true };
}

// ── 본문(버전) ──────────────────────────────────────────────────────────────

/** 슬라이드(버전)의 Excalidraw 장면(document)을 in-place로 저장한다. */
export async function updateSlideDocument(
  slideId: number,
  document: unknown,
): Promise<SlideActionResult> {
  const [, slide] = await Promise.all([
    assertAuthenticated(),
    prisma.slide.findUnique({
      where: { id: slideId },
      select: { id: true, pageId: true, page: { select: { projectId: true } } },
    }),
  ]);
  if (!slide) return { ok: false, error: "존재하지 않는 슬라이드입니다." };

  if (document === null || typeof document !== "object") {
    return { ok: false, error: "장면 데이터가 올바르지 않습니다." };
  }
  if (JSON.stringify(document).length > DOCUMENT_MAX) {
    return { ok: false, error: "장면이 너무 큽니다. 이미지 크기를 줄여 주세요." };
  }

  await prisma.slide.update({
    where: { id: slideId },
    data: { document: document as Prisma.InputJsonValue },
  });
  revalidatePath(`/project/${slide.page.projectId}/slides/${slide.pageId}`);
  return { ok: true, id: slideId };
}

/**
 * 페이지에 새 버전을 만든다. version = 현재 최대+1, 본문은 최신 버전 내용을 복사.
 * 코멘트는 복사하지 않는다(새 버전에서 다시 작성).
 */
export async function createSlideVersion(
  pageId: number,
): Promise<SlideActionResult> {
  const [, page] = await Promise.all([
    assertAuthenticated(),
    prisma.slidePage.findUnique({
      where: { id: pageId },
      select: { id: true, projectId: true },
    }),
  ]);
  if (!page) return { ok: false, error: "존재하지 않는 페이지입니다." };

  const latest = await prisma.slide.findFirst({
    where: { pageId },
    orderBy: { version: "desc" },
    select: { version: true, document: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await prisma.slide.create({
    data: {
      pageId,
      version: nextVersion,
      document:
        latest?.document == null
          ? Prisma.DbNull
          : (latest.document as Prisma.InputJsonValue),
    },
    select: { id: true },
  });
  revalidatePath(`/project/${page.projectId}/slides/${pageId}`);
  return { ok: true, id: created.id };
}

// ── 코멘트 ─────────────────────────────────────────────────────────────────

/**
 * 슬라이드(버전)의 (n)번 코멘트를 추가/수정한다. (slideId, commentNum) 유니크로 upsert.
 */
export async function upsertSlideComment(
  slideId: number,
  commentNum: number,
  comment: string,
): Promise<SlideActionResult> {
  const [, slide] = await Promise.all([
    assertAuthenticated(),
    prisma.slide.findUnique({
      where: { id: slideId },
      select: { id: true, pageId: true, page: { select: { projectId: true } } },
    }),
  ]);
  if (!slide) return { ok: false, error: "존재하지 않는 슬라이드입니다." };

  if (!Number.isInteger(commentNum) || commentNum < 1) {
    return { ok: false, error: "코멘트 번호는 1 이상의 정수여야 합니다." };
  }
  const text = typeof comment === "string" ? comment.trim() : "";
  if (!text) return { ok: false, error: "코멘트 내용을 입력해 주세요." };
  if (text.length > COMMENT_MAX) {
    return { ok: false, error: `코멘트는 ${COMMENT_MAX}자 이하여야 합니다.` };
  }

  const saved = await prisma.slideComment.upsert({
    where: { slideId_commentNum: { slideId, commentNum } },
    create: { slideId, commentNum, comment: text },
    update: { comment: text },
    select: { id: true },
  });
  revalidatePath(`/project/${slide.page.projectId}/slides/${slide.pageId}`);
  return { ok: true, id: saved.id };
}

/** 코멘트 삭제. */
export async function deleteSlideComment(
  commentId: number,
): Promise<SlideActionResult> {
  const [, comment] = await Promise.all([
    assertAuthenticated(),
    prisma.slideComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        slide: { select: { pageId: true, page: { select: { projectId: true } } } },
      },
    }),
  ]);
  if (!comment) return { ok: true, id: commentId }; // 이미 삭제됨 — 멱등

  await prisma.slideComment.delete({ where: { id: commentId } });
  revalidatePath(
    `/project/${comment.slide.page.projectId}/slides/${comment.slide.pageId}`,
  );
  return { ok: true, id: commentId };
}
