// 참조: docs/domain/02-member.md (v1.0) — 내정보 화면
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { signOut } from "../actions";
import { AuthCard } from "../AuthCard";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  return (
    <AuthCard title="내 정보">
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500 dark:text-zinc-400">이름</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {member.username}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500 dark:text-zinc-400">등급</dt>
          <dd className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
            {member.grade}
          </dd>
        </div>
      </dl>

      {member.grade === "SUPER" && (
        <Link
          href="/admin"
          className="mt-6 block w-full rounded-md bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          관리자 페이지로 이동
        </Link>
      )}

      <form action={signOut} className={member.grade === "SUPER" ? "mt-2" : "mt-6"}>
        <button
          type="submit"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          로그아웃
        </button>
      </form>
    </AuthCard>
  );
}
