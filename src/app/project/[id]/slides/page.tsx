// 참조: docs/superpowers/specs/2026-06-22-slides-design.md
// 슬라이드 기획서 인덱스. 섹션별 페이지 목록 + 미분류 페이지, 인라인 CRUD.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { SlidesManager, type PageSummary, type SectionSummary } from "./SlidesManager";

export const dynamic = "force-dynamic";

export default async function ProjectSlidesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  const [sections, pages] = await Promise.all([
    prisma.slideSection.findMany({
      where: { projectId },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    prisma.slidePage.findMany({
      where: { projectId },
      orderBy: { position: "asc" },
      select: {
        id: true,
        title: true,
        // 최신 버전·버전 수 계산용. 최신이 먼저 오도록 내림차순.
        versions: { orderBy: { version: "desc" }, select: { version: true } },
        sections: { select: { sectionId: true } },
      },
    }),
  ]);

  const sectionSummaries: SectionSummary[] = sections.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  const pageSummaries: PageSummary[] = pages.map((p) => ({
    id: p.id,
    title: p.title,
    latestVersion: p.versions[0]?.version ?? 1,
    versionCount: p.versions.length,
    sectionIds: p.sections.map((sp) => sp.sectionId),
  }));

  return (
    <div className="p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        {project.name} · 슬라이드 기획서
      </p>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        슬라이드 기획서
      </h1>

      <SlidesManager
        projectId={projectId}
        sections={sectionSummaries}
        pages={pageSummaries}
      />
    </div>
  );
}
