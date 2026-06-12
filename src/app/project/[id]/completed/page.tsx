// 참조: docs/superpowers/specs/2026-06-08-completed-tasks-page-design.md (v1.1),
//       docs/domain/03-node.md (v1.5 추가기능),
//       요구사항 #201 "오늘 완료된 작업, 주간보기 라디오형태로 표현"
// 프로젝트별 "완료된 작업" 목록. DONE 상태가 된 REQUIREMENT를 completedAt 기준으로 조회한다.
// 필터(오늘 / 주간 / 기간)는 URL 쿼리로 관리하며, 이 서버 컴포넌트가 재조회한다.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import {
  CompletedSearchForm,
  type CompletedViewMode,
} from "./CompletedSearchForm";
import { WeekTable } from "./WeekTable";

export const dynamic = "force-dynamic";

/** 서버 로컬 타임존 기준 당일 00:00:00. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "YYYY-MM-DD" 문자열을 서버 로컬 자정 Date로 파싱. 유효하지 않으면 null. */
function parseDateParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, day] = value.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  // 존재하지 않는 날짜(예: 2026-02-31)는 거른다.
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day
    ? d
    : null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO 문자열을 "YYYY-MM-DD HH:mm"(서버 로컬)로 표시. */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

type SearchParams = {
  view?: string;
  today?: string;
  from?: string;
  to?: string;
};

/** 서버 로컬 기준 이번 주 월요일 00:00. */
function startOfWeek(d: Date): Date {
  const start = startOfDay(d);
  // getDay(): 일=0 … 토=6 → 월요일 시작 주의 오프셋으로 변환.
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

// Next.js 16: params·searchParams 모두 Promise.
export default async function CompletedTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
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

  const sp = await searchParams;
  const fromParsed = parseDateParam(sp.from);
  const toParsed = parseDateParam(sp.to);

  // 모드 결정(#201): view 파라미터(today|week|range) 우선.
  // 레거시 쿼리 호환 — today=1이면 오늘, from/to만 있으면 기간, 아무것도 없으면 오늘.
  let mode: CompletedViewMode;
  if (sp.view === "week") mode = "week";
  else if (sp.view === "range") mode = "range";
  else if (sp.view === "today" || sp.today != null) mode = "today";
  else if (sp.from != null || sp.to != null) mode = "range";
  else mode = "today";

  // completedAt 범위(gte/lt)를 계산한다. 모두 서버 로컬 타임존 기준.
  let gte: Date | undefined;
  let lt: Date | undefined;
  let summary: string;
  const weekStart = startOfWeek(new Date());

  if (mode === "today") {
    const start = startOfDay(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    gte = start;
    lt = end;
    summary = "오늘 완료";
  } else if (mode === "week") {
    // 이번 주 월요일 00:00 ~ 다음 주 월요일 00:00.
    gte = weekStart;
    lt = new Date(weekStart);
    lt.setDate(lt.getDate() + 7);
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    summary = `이번 주 완료 (${weekStart.getMonth() + 1}/${weekStart.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()})`;
  } else {
    // 기간: from 00:00 ~ to+1일 00:00(to 당일 포함).
    if (fromParsed) gte = fromParsed;
    if (toParsed) {
      lt = new Date(toParsed);
      lt.setDate(lt.getDate() + 1);
    }
    const left = sp.from ?? "…";
    const right = sp.to ?? "…";
    summary = `${left} ~ ${right}`;
  }

  const completedAtFilter: { gte?: Date; lt?: Date } = {};
  if (gte) completedAtFilter.gte = gte;
  if (lt) completedAtFilter.lt = lt;

  const nodes = await prisma.node.findMany({
    where: {
      projectId,
      level: "REQUIREMENT",
      status: "DONE",
      // 범위 조건이 하나도 없으면(기간 모드에서 from/to 둘 다 없음) DONE 전체.
      // completedAt이 null인 노드는 not:null로 제외한다.
      completedAt:
        gte || lt ? completedAtFilter : { not: null },
    },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      name: true,
      completedAt: true,
      parent: {
        select: { name: true, parent: { select: { name: true } } },
      },
      assignees: {
        orderBy: { assignedAt: "asc" },
        select: { member: { select: { id: true, username: true } } },
      },
    },
  });

  const items = nodes.map((n) => ({
    id: n.id,
    name: n.name,
    completedAt: n.completedAt ? n.completedAt.toISOString() : null,
    moduleName: n.parent?.parent?.name ?? null,
    featureName: n.parent?.name ?? null,
    assignees: n.assignees.map((a) => a.member),
  }));

  return (
    <div className="p-8">
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        {project.name} · 완료된 작업
      </p>
      <h1 className="mt-2 mb-6 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        완료된 작업
      </h1>

      <CompletedSearchForm
        initial={{
          view: mode,
          from: sp.from ?? "",
          to: sp.to ?? "",
        }}
      />

      <div className="mb-4 flex items-baseline gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {summary}
        </span>
        <span>· {items.length}건</span>
      </div>

      {mode === "week" ? (
        // 주간보기: 빈 날도 칸으로 보여주는 달력 표 (#201)
        <WeekTable
          projectId={projectId}
          weekStart={weekStart}
          items={items
            .filter((i) => i.completedAt !== null)
            .map((i) => ({
              id: i.id,
              name: i.name,
              completedAt: i.completedAt as string,
              moduleName: i.moduleName,
              featureName: i.featureName,
            }))}
        />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
          완료된 작업이 없습니다.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {(item.moduleName || item.featureName) && (
                    <p className="mb-1 truncate font-mono text-xs text-zinc-400 dark:text-zinc-500">
                      {[item.moduleName, item.featureName]
                        .filter(Boolean)
                        .join(" › ")}
                    </p>
                  )}
                  <Link
                    href={`/project/${projectId}/node/${item.id}`}
                    className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                  >
                    {item.name}
                  </Link>
                  {item.assignees.length > 0 && (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      담당:{" "}
                      {item.assignees.map((a) => `@${a.username}`).join(", ")}
                    </p>
                  )}
                </div>
                {item.completedAt && (
                  <span className="shrink-0 whitespace-nowrap font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(item.completedAt)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
