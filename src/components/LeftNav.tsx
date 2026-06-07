// 참조: docs/components/02-navigation-left.md (v1.1) — 일반 경로 좌측 네비게이션
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// 접힘 상태를 새로고침·경로 이동 후에도 유지하기 위한 localStorage 키.
const COLLAPSE_KEY = "coworks.leftnav.collapsed";

type ProjectItem = { id: number; name: string };

type Props = {
  /** 로그인한 멤버의 프로젝트 목록. 비로그인이면 null(네비 숨김). */
  projects: ProjectItem[] | null;
};

// 좌측 네비를 숨길 경로 접두사. admin은 자체 사이드바, auth는 카드 화면.
const HIDDEN_PREFIXES = ["/admin", "/signin", "/signup", "/me"];

// 프로젝트 선택 시 좌측에 표시되는 프로젝트 내 작업 메뉴.
// 참조: docs/components/02-navigation-left.md (v1.1)
const PROJECT_TASK_ITEMS = [
  { segment: "/table-view", label: "TableView" },
  { segment: "/completed", label: "완료된 작업" },
  { segment: "/environment", label: "환경변수 관리" },
  { segment: "/groups", label: "그룹관리" },
] as const;

function selectedProjectId(pathname: string): number | null {
  const match = pathname.match(/^\/project\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function LeftNav({ projects }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // 마운트 시 저장된 접힘 상태를 복원한다.
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  // 비로그인이거나 숨김 경로면 렌더하지 않는다.
  if (!projects) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const selectedId = selectedProjectId(pathname);

  // 접힌 상태: 얇은 바에 펼치기 버튼만 노출해 본문 공간을 넓힌다.
  if (collapsed) {
    return (
      <aside className="w-10 shrink-0 border-r border-zinc-200 p-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={toggle}
          aria-label="프로젝트 네비게이션 펼치기"
          aria-expanded={false}
          title="펼치기"
          className="flex h-8 w-full items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          »
        </button>
      </aside>
    );
  }

  const notificationsActive = pathname === "/notifications";

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-200 p-4 dark:border-zinc-800">
      {/* 요청 알림 (참조: docs/domain/11-request-notification.md) */}
      <Link
        href="/notifications"
        aria-current={notificationsActive ? "page" : undefined}
        className={`mb-3 block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          notificationsActive
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
            : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        }`}
      >
        요청 알림
      </Link>

      <div className="flex items-center justify-between px-2 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          프로젝트
        </h2>
        <button
          type="button"
          onClick={toggle}
          aria-label="프로젝트 네비게이션 접기"
          aria-expanded={true}
          title="접기"
          className="rounded px-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          «
        </button>
      </div>
      {projects.length === 0 ? (
        <p className="px-2 text-sm text-zinc-500 dark:text-zinc-400">
          프로젝트가 없습니다.
        </p>
      ) : (
        <nav className="flex flex-col gap-1">
          {projects.map((p) => {
            const active = selectedId === p.id;
            return (
              <div key={p.id} className="flex flex-col gap-1">
                <Link
                  href={`/project/${p.id}`}
                  aria-current={
                    active && pathname === `/project/${p.id}`
                      ? "page"
                      : undefined
                  }
                  className={`truncate rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {p.name}
                </Link>

                {/* 선택된 프로젝트일 때만 작업 메뉴를 펼친다. */}
                {active && (
                  <div className="ml-3 flex flex-col gap-1 border-l border-zinc-200 pl-2 dark:border-zinc-800">
                    {PROJECT_TASK_ITEMS.map((task) => {
                      const href = `/project/${p.id}${task.segment}`;
                      const taskActive = pathname === href;
                      return (
                        <Link
                          key={task.segment}
                          href={href}
                          aria-current={taskActive ? "page" : undefined}
                          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                            taskActive
                              ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                          }`}
                        >
                          {task.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      )}
    </aside>
  );
}
