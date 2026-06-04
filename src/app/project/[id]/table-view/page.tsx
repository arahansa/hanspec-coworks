// 참조: docs/components/02-navigation-left.md (v1.1), docs/domain/04-node.md (v1.1)
// 선택된 프로젝트의 TableView 작업 화면. 1단계: MODULE 노드 편집기.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { NodeEditor } from "./NodeEditor";

export const dynamic = "force-dynamic";

// Next.js 16: params는 Promise로 전달된다.
export default async function ProjectTableViewPage({
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
  // 상세 패널용으로 description·version·createdAt도 함께 가져온다.
  const detail = {
    id: true,
    name: true,
    description: true,
    version: true,
    createdAt: true,
  } as const;

  const modules = await prisma.node.findMany({
    where: { projectId, level: "MODULE", parentId: null },
    orderBy: { createdAt: "asc" },
    select: {
      ...detail,
      // MODULE도 ENDPOINT를 가질 수 있다. (09-feature.md)
      endpoint: true,
      children: {
        where: { level: "FEATURE" },
        orderBy: { createdAt: "asc" },
        select: {
          ...detail,
          // FEATURE 전용 필드: ENDPOINT·TAG (09-feature.md)
          endpoint: true,
          tags: {
            orderBy: { tag: { name: "asc" } },
            select: { tag: { select: { name: true } } },
          },
          children: {
            where: { level: "REQUIREMENT" },
            orderBy: { createdAt: "asc" },
            select: {
              ...detail,
              // REQUIREMENT 전용: 상태·담당자 (03-node.md 추가요청1·2)
              status: true,
              // REQUIREMENT도 ENDPOINT를 가질 수 있다. (FEATURE/MODULE과 동일)
              endpoint: true,
              // REQUIREMENT도 TAG를 가질 수 있다. (05-tag.md)
              tags: {
                orderBy: { tag: { name: "asc" } },
                select: { tag: { select: { name: true } } },
              },
              assignees: {
                orderBy: { assignedAt: "asc" },
                select: { member: { select: { id: true, username: true } } },
              },
            },
          },
        },
      },
    },
  });

  // Date → ISO 문자열로 직렬화해 클라이언트 컴포넌트에 전달한다.
  const serialized = modules.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    children: m.children.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
      // NodeTag[] → 태그 이름 문자열 배열로 평탄화
      tags: f.tags.map((nt) => nt.tag.name),
      children: f.children.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        // NodeTag[] → 태그 이름 문자열 배열로 평탄화
        tags: r.tags.map((nt) => nt.tag.name),
        // NodeAssignee[] → 멤버 요약 배열로 평탄화
        assignees: r.assignees.map((a) => a.member),
      })),
    })),
  }));

  return (
    <div className="p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        {project.name} · TableView
      </p>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        TableView
      </h1>

      <NodeEditor projectId={projectId} modules={serialized} />
    </div>
  );
}
