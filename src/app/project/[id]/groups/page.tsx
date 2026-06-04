// 참조: docs/domain/10-user-group.md — 프로젝트 멤버 그룹 관리 페이지
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { GroupManager, type GroupItem, type MemberItem } from "./GroupManager";

export const dynamic = "force-dynamic";

// Next.js 16: params는 Promise로 전달된다.
export default async function ProjectGroupsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) notFound();

  const isSuper = member.grade === "SUPER";

  const [project, allMembers] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        memberGroups: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            participants: {
              orderBy: { id: "asc" },
              select: {
                memberId: true,
                member: { select: { username: true } },
              },
            },
          },
        },
      },
    }),
    // 임의 배치는 SUPER만 하므로 SUPER일 때만 전체 멤버를 조회한다.
    isSuper
      ? prisma.member.findMany({
          orderBy: { username: "asc" },
          select: { id: true, username: true },
        })
      : Promise.resolve([] as MemberItem[]),
  ]);

  if (!project) notFound();

  const groups: GroupItem[] = project.memberGroups.map((g) => ({
    id: g.id,
    name: g.name,
    participants: g.participants.map((p) => ({
      memberId: p.memberId,
      username: p.member.username,
    })),
  }));

  return (
    <div className="p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        {project.name} · 그룹관리
      </p>
      <h1 className="mt-2 mb-8 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        그룹관리
      </h1>

      <GroupManager
        projectId={projectId}
        groups={groups}
        allMembers={allMembers}
        currentMemberId={member.id}
        isSuper={isSuper}
      />
    </div>
  );
}
