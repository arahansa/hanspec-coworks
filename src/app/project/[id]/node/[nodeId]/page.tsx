// 참조: docs/superpowers/specs/2026-06-01-requirement-detail-task-design.md (v1.0)
// 요구사항(REQUIREMENT) 상세 페이지. 요구사항 정보 + Task 목록/생성.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { TaskSection, type TaskItem } from "./TaskSection";
import { StatusSection } from "./StatusSection";
import { AssigneeSection, type AssigneeItem } from "./AssigneeSection";
import { DescriptionSection } from "./DescriptionSection";
import { RequestSection, type GroupOption } from "./RequestSection";
import { IdCopyButtons } from "./IdCopyButtons";

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
      // 상위 트리(기능→모듈)를 따라 올라가 빵부스러기를 만든다.
      // REQUIREMENT의 부모는 FEATURE, 그 부모는 MODULE.
      parent: {
        select: {
          id: true,
          name: true,
          level: true,
          parent: { select: { id: true, name: true, level: true } },
        },
      },
      project: {
        select: {
          name: true,
          // Task endpoint {{}} 자동완성용 환경변수 이름. (06-task.md)
          environments: { orderBy: { name: "asc" }, select: { name: true } },
          // 확인 요청을 보낼 그룹 목록. (11-request-notification.md)
          memberGroups: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        },
      },
      tasks: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          progress: true,
          name: true,
          endpoint: true,
          createdAt: true,
        },
      },
      assignees: {
        orderBy: { assignedAt: "asc" },
        select: { member: { select: { id: true, username: true } } },
      },
      // 이미 보낸 확인 요청의 대상(개인/그룹). 중복 전송 표시·재요청에 사용. (11)
      requests: {
        select: { receiverId: true, groupId: true },
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
    name: t.name,
    endpoint: t.endpoint,
    createdAt: t.createdAt.toISOString(),
  }));

  const envNames = node.project.environments.map((e) => e.name);

  const assignees: AssigneeItem[] = node.assignees.map((a) => ({
    id: a.member.id,
    username: a.member.username,
  }));

  const groups: GroupOption[] = node.project.memberGroups;

  // 이미 확인 요청을 보낸 대상 id 집합(개인/그룹).
  const requestedMemberIds = node.requests
    .map((r) => r.receiverId)
    .filter((x): x is number => x != null);
  const requestedGroupIds = node.requests
    .map((r) => r.groupId)
    .filter((x): x is number => x != null);

  // 상위 노드를 위(모듈)→아래(기능) 순으로 모아 빵부스러기로 쓴다.
  const LEVEL_LABEL: Record<string, string> = {
    MODULE: "모듈",
    FEATURE: "기능",
    REQUIREMENT: "요구사항",
  };
  const ancestors = [node.parent?.parent, node.parent].filter(
    (a) => a != null,
  );

  return (
    <div className="p-8">
      <Link href={backHref} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← TableView로 돌아가기
      </Link>

      {/* 빵부스러기: 프로젝트 › 모듈 › 기능 — 어떤 기능의 요구사항인지 한눈에. */}
      <nav
        aria-label="상위 경로"
        className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400"
      >
        <span className="text-zinc-400 dark:text-zinc-500">{node.project.name}</span>
        {ancestors.map((a) => (
          <span key={a.id} className="flex items-center gap-1.5">
            <span className="text-zinc-300 dark:text-zinc-600">›</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {LEVEL_LABEL[a.level] ?? a.level}
            </span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{a.name}</span>
          </span>
        ))}
      </nav>

      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        요구사항
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        {node.name}
      </h1>
      <p className="mt-1 font-mono text-xs text-zinc-400">
        #{node.id}
        <IdCopyButtons nodeId={node.id} />
        {" · "}v{node.version}
      </p>

      <DescriptionSection nodeId={node.id} description={node.description} />

      <StatusSection nodeId={node.id} status={node.status} />
      <AssigneeSection nodeId={node.id} assignees={assignees} />
      <RequestSection
        nodeId={node.id}
        groups={groups}
        requestedMemberIds={requestedMemberIds}
        requestedGroupIds={requestedGroupIds}
      />
      <TaskSection nodeId={node.id} tasks={tasks} envNames={envNames} />
    </div>
  );
}
