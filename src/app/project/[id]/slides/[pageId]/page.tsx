// 참조: docs/superpowers/specs/2026-06-22-slides-design.md
// 슬라이드 페이지 뷰: 좌측 wiremd 렌더(선택 버전) + 우측 코멘트 패널 + 버전 셀렉터 + 편집.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { renderWiremd } from "@/lib/wiremd";
import { SlideFrame } from "../SlideFrame";
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
      content: true,
      comments: {
        orderBy: { commentNum: "asc" },
        select: { id: true, commentNum: true, comment: true },
      },
    },
  });
  if (!slide) notFound();

  const html = renderWiremd(slide.content);

  return (
    <div className="p-8">
      {/* 빵부스러기 */}
      <nav className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href={`/project/${projectId}/slides`}
          className="hover:underline"
        >
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

      {/* 뷰: 좌측 와이어프레임 + 우측 코멘트 */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <SlideFrame html={html} />
        </div>
        <aside className="w-full shrink-0 lg:w-72">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            코멘트
          </h2>
          {slide.comments.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              아직 코멘트가 없습니다. 아래 편집에서 본문의 (1)(2) 마커에 설명을 답니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {slide.comments.map((c) => (
                <li
                  key={c.id}
                  className="flex gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <span className="shrink-0 font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                    ({c.commentNum})
                  </span>
                  <span className="min-w-0 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                    {c.comment}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {/* 편집 */}
      <SlideEditor
        projectId={projectId}
        slideId={slide.id}
        pageId={pageId}
        version={slide.version}
        initialContent={slide.content}
        comments={slide.comments}
      />
    </div>
  );
}
