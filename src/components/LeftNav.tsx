// 참조: docs/components/02-navigation-left.md (v1.0) — 일반 경로 좌측 네비게이션
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ProjectItem = { id: number; name: string };

type Props = {
  /** 로그인한 멤버의 프로젝트 목록. 비로그인이면 null(네비 숨김). */
  projects: ProjectItem[] | null;
};

// 좌측 네비를 숨길 경로 접두사. admin은 자체 사이드바, auth는 카드 화면.
const HIDDEN_PREFIXES = ["/admin", "/signin", "/signup", "/me"];

function selectedProjectId(pathname: string): number | null {
  const match = pathname.match(/^\/project\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function LeftNav({ projects }: Props) {
  const pathname = usePathname();

  // 비로그인이거나 숨김 경로면 렌더하지 않는다.
  if (!projects) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const selectedId = selectedProjectId(pathname);

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        프로젝트
      </h2>
      {projects.length === 0 ? (
        <p className="px-2 text-sm text-zinc-500 dark:text-zinc-400">
          프로젝트가 없습니다.
        </p>
      ) : (
        <nav className="flex flex-col gap-1">
          {projects.map((p) => {
            const active = selectedId === p.id;
            return (
              <Link
                key={p.id}
                href={`/project/${p.id}`}
                aria-current={active ? "page" : undefined}
                className={`truncate rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {p.name}
              </Link>
            );
          })}
        </nav>
      )}
    </aside>
  );
}
