"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/node-mode", label: "NodeMode" },
] as const;

// SUPER 등급 멤버에게만 노출되는 좌측 관리자 메뉴.
// 참조: docs/components/01-navigation-header.md
const ADMIN_NAV_ITEMS = [
  { href: "/admin/projects", label: "프로젝트 관리" },
  { href: "/admin/members", label: "회원 관리" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  /** 로그인한 멤버의 이름. 비로그인이면 null. (서버 레이아웃에서 주입) */
  username: string | null;
  /** 로그인한 멤버가 SUPER 등급인지 여부. */
  isSuper?: boolean;
};

export function SiteHeader({ username, isSuper = false }: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="group flex items-baseline gap-px font-mono text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            <span>HanSpec</span>
            <span className="text-emerald-500">·</span>
            <span className="text-zinc-500 transition-colors group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
              Coworks
            </span>
          </Link>

          {isSuper && (
            <nav className="flex items-center gap-1 border-l border-zinc-200 pl-3 dark:border-zinc-800">
              {ADMIN_NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
          )}
        </div>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {username ? (
            <Link
              href="/me"
              aria-current={isActive(pathname, "/me") ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(pathname, "/me")
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {username}
            </Link>
          ) : (
            <Link
              href="/signin"
              aria-current={isActive(pathname, "/signin") ? "page" : undefined}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              SignIn
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
