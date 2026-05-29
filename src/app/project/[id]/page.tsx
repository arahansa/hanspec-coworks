// 참조: docs/components/02-navigation-left.md (v1.0), docs/domain/01-project.md (v1.0)
// 프로젝트 작업 영역. 좌측 네비에서 프로젝트를 선택하면 이곳으로 이동한다.
// 프로젝트 내 작업 메뉴는 문서 확정 후 추가 예정.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Next.js 16: params는 Promise로 전달된다.
export default async function ProjectPage({
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
  });
  if (!project) notFound();

  return (
    <div className="p-8">
      <p className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
        {project.slug}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        {project.name}
      </h1>
      {project.description && (
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          {project.description}
        </p>
      )}

      <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
        프로젝트 작업 영역 (준비 중)
      </div>
    </div>
  );
}
