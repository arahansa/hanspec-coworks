// 참조: docs/superpowers/specs/2026-06-01-requirement-detail-task-design.md (v1.0)
// 요구사항(REQUIREMENT) 상세 페이지. 요구사항 정보 + Task 목록/생성.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { TaskSection, type TaskItem } from "./TaskSection";
import { StatusSection } from "./StatusSection";
import { AssigneeSection, type AssigneeItem } from "./AssigneeSection";

export const dynamic = "force-dynamic";

// Next.js 16: params는 Promise로 전달된다.
export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string; nodeId: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const { id, nodeId } = await params;
  const projectId = Number(id);
  const reqId = Number(nodeId);
  if (!Number.isInteger(projectId) || !Number.isInteger(reqId)) notFound();

  const node = await prisma.node.findUnique({
    where: { id: reqId },
    select: {
      id: true,
      name: true,
      level: true,
      description: true,
      version: true,
      status: true,
      projectId: true,
      project: { select: { name: true } },
      tasks: {
        orderBy: { createdAt: "asc" },
        select: { id: true, description: true, progress: true, createdAt: true },
      },
      assignees: {
        orderBy: { assignedAt: "asc" },
        select: { member: { select: { id: true, username: true } } },
      },
    },
  });

  if (!node || node.projectId !== projectId) notFound();

  const backHref = `/project/${projectId}/table-view`;

  if (node.level !== "REQUIREMENT") {
    return (
      <div className="p-8">
        <Link href={backHref} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← TableView로 돌아가기
        </Link>
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          이 노드는 요구사항이 아니어서 상세 페이지를 제공하지 않습니다.
        </p>
      </div>
    );
  }

  const tasks: TaskItem[] = node.tasks.map((t) => ({
    id: t.id,
    description: t.description,
    progress: t.progress,
    createdAt: t.createdAt.toISOString(),
  }));

  const assignees: AssigneeItem[] = node.assignees.map((a) => ({
    id: a.member.id,
    username: a.member.username,
  }));

  return (
    <div className="p-8">
      <Link href={backHref} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← TableView로 돌아가기
      </Link>

      <p className="mt-4 font-mono text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        {node.project.name} · 요구사항
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        {node.name}
      </h1>
      <p className="mt-1 font-mono text-xs text-zinc-400">
        #{node.id} · v{node.version}
      </p>

      {node.description && (
        <p className="mt-4 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
          {node.description}
        </p>
      )}

      <StatusSection nodeId={node.id} status={node.status} />
      <AssigneeSection nodeId={node.id} assignees={assignees} />
      <TaskSection nodeId={node.id} tasks={tasks} />
    </div>
  );
}
