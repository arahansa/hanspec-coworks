// 참조: docs/apis/01-node.md (나의 작업 v1.6)
// 프로젝트별 "나의 작업" 목록. 담당자가 현재 멤버로 할당된 REQUIREMENT를 상태별로 보여준다.
// 같은 목록을 토큰 API(GET /api/my-works)로도 제공한다.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import {
  NODE_STATUS_BADGE_CLASS,
  NODE_STATUS_LABEL,
} from "@/app/project/[id]/node/[nodeId]/node-status";

export const dynamic = "force-dynamic";

export default async function MyWorksPage({
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

  // 내가 담당자인 요구사항. 상태(초안→진행중→완료) 순, 같은 상태는 id 순.
  const nodes = await prisma.node.findMany({
    where: {
      projectId,
      level: "REQUIREMENT",
      assignees: { some: { memberId: member.id } },
    },
    orderBy: [{ status: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      parent: {
        select: { name: true, parent: { select: { name: true } } },
      },
    },
  });

  return (
    <div className="p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        {project.name} · 나의 작업
      </p>
      <h1 className="mt-2 mb-2 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        나의 작업
      </h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        담당자가 나(@{member.username})로 할당된 요구사항 · {nodes.length}건
      </p>

      {nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
          나에게 할당된 요구사항이 없습니다.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {nodes.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {(n.parent?.parent?.name || n.parent?.name) && (
                    <p className="mb-1 truncate font-mono text-xs text-zinc-400 dark:text-zinc-500">
                      {[n.parent?.parent?.name, n.parent?.name]
                        .filter(Boolean)
                        .join(" › ")}
                    </p>
                  )}
                  <Link
                    href={`/project/${projectId}/node/${n.id}`}
                    className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                  >
                    <span className="mr-2 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                      #{n.id}
                    </span>
                    {n.name}
                  </Link>
                  {n.description && (
                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-zinc-500 dark:text-zinc-400">
                      {n.description}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${NODE_STATUS_BADGE_CLASS[n.status]}`}
                >
                  {NODE_STATUS_LABEL[n.status]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
