// 참조: docs/superpowers/specs/2026-07-02-slides-canvas-excalidraw-design.md
// 슬라이드 페이지: 단일 Excalidraw 캔버스(선택 버전) + 우측 코멘트 + 버전 셀렉터 + 자동저장.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import type { SceneDocument } from "@/components/ExcalidrawCanvas";
import { SlideEditor } from "./SlideEditor";

export const dynamic = "force-dynamic";

export default async function SlidePageView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pageId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const { id, pageId: pageIdStr } = await params;
  const projectId = Number(id);
  const pageId = Number(pageIdStr);
  if (!Number.isInteger(projectId) || !Number.isInteger(pageId)) notFound();

  const page = await prisma.slidePage.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      title: true,
      projectId: true,
      project: { select: { name: true } },
      versions: { orderBy: { version: "desc" }, select: { version: true } },
    },
  });
  if (!page || page.projectId !== projectId) notFound();

  // 선택 버전: ?v=N (없거나 유효하지 않으면 최신).
  const versionNumbers = page.versions.map((v) => v.version);
  const latest = versionNumbers[0] ?? 1;
  const sp = await searchParams;
  const requested = Number(sp.v);
  const selectedVersion = versionNumbers.includes(requested) ? requested : latest;

  const slide = await prisma.slide.findFirst({
    where: { pageId, version: selectedVersion },
    select: {
      id: true,
      version: true,
      document: true,
      comments: {
        orderBy: { commentNum: "asc" },
        select: { id: true, commentNum: true, comment: true },
      },
    },
  });
  if (!slide) notFound();

  const initialDocument = (slide.document as SceneDocument | null) ?? null;

  return (
    <div className="p-8">
      {/* 빵부스러기 */}
      <nav className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href={`/project/${projectId}/slides`} className="hover:underline">
          {page.project.name} · 슬라이드 기획서
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">›</span>
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {page.title}
        </span>
      </nav>

      <div className="mt-2 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {page.title}
        </h1>
        <span className="font-mono text-xs text-zinc-400">#{page.id}</span>

        {/* 버전 셀렉터 */}
        <div className="flex items-center gap-1">
          {versionNumbers.map((v) => {
            const active = v === selectedVersion;
            return (
              <Link
                key={v}
                href={`/project/${projectId}/slides/${pageId}?v=${v}`}
                aria-current={active ? "page" : undefined}
                className={`rounded px-2 py-0.5 font-mono text-xs transition ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                v{v}
              </Link>
            );
          })}
        </div>
      </div>

      {/* key={slide.id}로 버전 전환 시 캔버스를 새 initialData로 재마운트한다. */}
      <SlideEditor
        key={slide.id}
        projectId={projectId}
        slideId={slide.id}
        pageId={pageId}
        version={slide.version}
        initialDocument={initialDocument}
        comments={slide.comments}
      />
    </div>
  );
}
