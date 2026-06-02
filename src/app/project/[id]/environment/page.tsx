// 참조: docs/domain/07-environment.md — 프로젝트별 환경변수 관리 페이지
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { EnvironmentEditor, type EnvItem } from "./EnvironmentEditor";

export const dynamic = "force-dynamic";

// Next.js 16: params는 Promise로 전달된다.
export default async function ProjectEnvironmentPage({
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
    select: {
      id: true,
      name: true,
      environments: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, value: true },
      },
    },
  });
  if (!project) notFound();

  const items: EnvItem[] = project.environments;

  return (
    <div className="p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        {project.name} · 환경변수 관리
      </p>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        환경변수 관리
      </h1>

      <EnvironmentEditor projectId={projectId} items={items} />
    </div>
  );
}
