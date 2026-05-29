// 참조: docs/components/02-navigation-left.md (v1.1) — 프로젝트 내 작업: NodeMode
// 선택된 프로젝트의 NodeMode 작업 화면. 노드 도메인(docs/domain/04-node.md) 본구현은 추후.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Next.js 16: params는 Promise로 전달된다.
export default async function ProjectNodeModePage({
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

  return (
    <div className="p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        {project.name} · NodeMode
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        NodeMode
      </h1>

      <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
        노드 작업 영역 (준비 중)
      </div>
    </div>
  );
}
