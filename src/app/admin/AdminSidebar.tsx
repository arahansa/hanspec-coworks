// 참조: docs/components/01-navigation-header.md (v1.1) — SUPER 컨텐츠 좌측 sub-nav
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_NAV_ITEMS = [
  { href: "/admin/projects", label: "프로젝트 관리" },
  { href: "/admin/members", label: "회원 관리" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 border-r border-zinc-200 p-4 dark:border-zinc-800">
      <nav className="flex flex-col gap-1">
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
