// 참조: docs/components/02-navigation-left.md (v1.1), docs/domain/04-node.md (v1.1)
// 선택된 프로젝트의 NodeMode 작업 화면. 1단계: MODULE 노드 편집기.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { NodeEditor } from "./NodeEditor";

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

  // MODULE → FEATURE → REQUIREMENT 3단계 트리를 조회한다.
  const modules = await prisma.node.findMany({
    where: { projectId, level: "MODULE", parentId: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      children: {
        where: { level: "FEATURE" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          children: {
            where: { level: "REQUIREMENT" },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  return (
    <div className="p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        {project.name} · NodeMode
      </p>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        NodeMode
      </h1>

      <NodeEditor projectId={projectId} modules={modules} />
    </div>
  );
}
