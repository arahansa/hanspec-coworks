// 참조: docs/components/02-navigation-left.md (v1.1), docs/domain/04-node.md (v1.1),
//       docs/domain/03-node.md (상태 DRAFT/IN_PROGRESS/DONE)
// 선택된 프로젝트의 Board(칸반) 화면.
// 요구사항(REQUIREMENT)을 상태별 컬럼으로 나눠 보여주고, 드래그&드롭으로 상태를 바꾼다.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { Board } from "./Board";
import type { BoardCard, BoardFilterOptions } from "./types";

export const dynamic = "force-dynamic";

// Next.js 16: params는 Promise로 전달된다.
export default async function ProjectBoardPage({
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

  // 보드는 REQUIREMENT만 카드로 다룬다. 상위 기능(FEATURE)·모듈(MODULE)은
  // 카드에 표시하고 필터링하기 위해 parent를 두 단계 따라 올라가 함께 가져온다.
  const requirements = await prisma.node.findMany({
    where: { projectId, level: "REQUIREMENT" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      completedAt: true,
      parent: {
        select: {
          id: true,
          name: true,
          parent: { select: { id: true, name: true } },
        },
      },
      tags: {
        orderBy: { tag: { name: "asc" } },
        select: { tag: { select: { name: true } } },
      },
      assignees: {
        orderBy: { assignedAt: "asc" },
        select: { member: { select: { id: true, username: true } } },
      },
    },
  });

  // 클라이언트 컴포넌트에 넘기기 위해 평탄화 + Date 직렬화.
  const cards: BoardCard[] = requirements.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    featureId: r.parent?.id ?? null,
    featureName: r.parent?.name ?? null,
    moduleId: r.parent?.parent?.id ?? null,
    moduleName: r.parent?.parent?.name ?? null,
    tags: r.tags.map((nt) => nt.tag.name),
    assignees: r.assignees.map((a) => a.member),
  }));

  // 필터 선택지는 보드에 실제로 존재하는 값들에서만 뽑는다(빈 선택지 방지).
  const options: BoardFilterOptions = {
    modules: dedupeById(
      cards.flatMap((c) =>
        c.moduleId !== null && c.moduleName !== null
          ? [{ id: c.moduleId, name: c.moduleName }]
          : [],
      ),
    ),
    features: dedupeById(
      cards.flatMap((c) =>
        c.featureId !== null && c.featureName !== null
          ? [{ id: c.featureId, name: c.featureName }]
          : [],
      ),
    ),
    assignees: dedupeById(
      cards.flatMap((c) =>
        c.assignees.map((a) => ({ id: a.id, name: a.username })),
      ),
    ),
    tags: [...new Set(cards.flatMap((c) => c.tags))].sort((a, b) =>
      a.localeCompare(b, "ko"),
    ),
  };

  return (
    <div className="p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        {project.name} · Board
      </p>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Board
      </h1>

      <Board
        projectId={projectId}
        cards={cards}
        options={options}
        currentMemberId={member.id}
      />
    </div>
  );
}

/** id 기준 중복 제거 후 이름 가나다순 정렬. 필터 선택지 생성에 쓴다. */
function dedupeById(
  items: { id: number; name: string }[],
): { id: number; name: string }[] {
  const map = new Map<number, string>();
  for (const item of items) {
    if (!map.has(item.id)) map.set(item.id, item.name);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
