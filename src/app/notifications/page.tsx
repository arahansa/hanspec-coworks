// 참조: docs/domain/11-request-notification.md — 요청 알림 페이지(받은/보낸 탭 + 페이징)
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/auth";
import { CheckButton } from "./CheckButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type Tab = "received" | "sent";

// 노드 정보 + 태그를 함께 보여주기 위한 공통 select.
const nodeSelect = {
  id: true,
  name: true,
  description: true,
  projectId: true,
  tags: { select: { tag: { select: { name: true } } } },
} as const;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const sp = await searchParams;
  const tab: Tab = sp.tab === "sent" ? "sent" : "received";
  const page = Math.max(1, Number(sp.page) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  // 내가 속한 그룹 id(받은 요청 조회에 사용).
  const myGroups = await prisma.memberGroupParticipant.findMany({
    where: { memberId: member.id },
    select: { groupId: true },
  });
  const myGroupIds = myGroups.map((g) => g.groupId);

  const where =
    tab === "received"
      ? {
          OR: [
            { receiverId: member.id },
            ...(myGroupIds.length > 0 ? [{ groupId: { in: myGroupIds } }] : []),
          ],
        }
      : { senderId: member.id };

  const [total, rows] = await Promise.all([
    prisma.requestNotification.count({ where }),
    prisma.requestNotification.findMany({
      where,
      // 받은 요청은 미확인 건을 먼저, 그 외에는 최신순.
      orderBy:
        tab === "received"
          ? [{ checked: "asc" }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }],
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        checked: true,
        checkedAt: true,
        createdAt: true,
        sender: { select: { username: true } },
        receiver: { select: { username: true } },
        group: { select: { name: true } },
        node: { select: nodeSelect },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        요청 알림
      </h1>

      {/* 탭 */}
      <div className="mt-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        <TabLink tab="received" current={tab} label="받은 요청" />
        <TabLink tab="sent" current={tab} label="보낸 요청" />
      </div>

      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">총 {total}건</p>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-400 dark:text-zinc-500">
          {tab === "received" ? "받은 요청이 없습니다." : "보낸 요청이 없습니다."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((r) => {
            const tags = r.node.tags.map((t) => t.tag.name);
            const target =
              r.receiver?.username != null
                ? `@${r.receiver.username}`
                : r.group?.name != null
                  ? `그룹 ${r.group.name}`
                  : "—";
            return (
              <li
                key={r.id}
                className="flex gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                {/* 받은 요청에만 좌측 체크 동작 */}
                {tab === "received" && (
                  <div className="pt-0.5">
                    <CheckButton requestId={r.id} checked={r.checked} />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/project/${r.node.projectId}/node/${r.node.id}`}
                      className="truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {r.node.name}
                    </Link>
                    <span className="font-mono text-xs text-zinc-400">#{r.node.id}</span>
                  </div>

                  {r.node.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {r.node.description}
                    </p>
                  )}

                  {tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tags.map((name) => (
                        <span
                          key={name}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          #{name}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                    {tab === "received"
                      ? `보낸 사람: @${r.sender.username}`
                      : `받는 대상: ${target}`}
                    {" · "}
                    {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    {" · "}
                    {r.checked ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        확인됨
                        {r.checkedAt
                          ? ` (${r.checkedAt.toISOString().slice(0, 16).replace("T", " ")})`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">미확인</span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 페이징 */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          <PageLink tab={tab} page={page - 1} disabled={page <= 1} label="‹ 이전" />
          <span className="text-zinc-500 dark:text-zinc-400">
            {page} / {totalPages}
          </span>
          <PageLink
            tab={tab}
            page={page + 1}
            disabled={page >= totalPages}
            label="다음 ›"
          />
        </div>
      )}
    </div>
  );
}

function TabLink({ tab, current, label }: { tab: Tab; current: Tab; label: string }) {
  const active = tab === current;
  return (
    <Link
      href={`/notifications?tab=${tab}`}
      aria-current={active ? "page" : undefined}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
          : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      }`}
    >
      {label}
    </Link>
  );
}

function PageLink({
  tab,
  page,
  disabled,
  label,
}: {
  tab: Tab;
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="cursor-default rounded-md px-3 py-1.5 text-zinc-300 dark:text-zinc-700">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/notifications?tab=${tab}&page=${page}`}
      className="rounded-md px-3 py-1.5 text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {label}
    </Link>
  );
}
