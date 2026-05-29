// 참조: docs/domain/03-admin.md (v1.0) — 회원 목록 조회 (읽기 전용)
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const members = await prisma.member.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, username: true, grade: true, createdAt: true },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        회원 관리
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        총 {members.length}명
      </p>

      {members.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          등록된 회원이 없습니다.
        </p>
      ) : (
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-2 pr-4 font-medium">이름</th>
              <th className="py-2 pr-4 font-medium">등급</th>
              <th className="py-2 pr-4 font-medium">가입일</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.id}
                className="border-b border-zinc-100 dark:border-zinc-900"
              >
                <td className="py-3 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                  {m.username}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.grade === "SUPER"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {m.grade}
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  {m.createdAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
