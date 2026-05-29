// 참조: docs/domain/03-admin.md (v1.0) — 어드민 관리 화면 (/admin)
// 접근 가드·좌측 사이드바는 admin/layout.tsx에서 처리한다.
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CARDS = [
  {
    href: "/admin/projects",
    title: "프로젝트 관리",
    description: "프로젝트를 생성·편집·삭제합니다.",
  },
  {
    href: "/admin/members",
    title: "회원 관리",
    description: "가입한 회원 목록을 조회합니다.",
  },
] as const;

export default async function AdminHomePage() {
  const [projectCount, memberCount] = await Promise.all([
    prisma.project.count(),
    prisma.member.count(),
  ]);
  const counts: Record<string, number> = {
    "/admin/projects": projectCount,
    "/admin/members": memberCount,
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        관리자
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        관리할 영역을 선택하세요.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                {card.title}
              </h2>
              <span className="font-mono text-sm text-zinc-400 dark:text-zinc-500">
                {counts[card.href]}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
