// 참조: docs/domain/01-project.md (v1.0), docs/domain/03-admin.md (v1.0)
// 프로젝트 관리 — 목록 + 삭제. 생성/편집은 별도 페이지.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteProject } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          프로젝트 관리
        </h1>
        <Link
          href="/admin/projects/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          새 프로젝트
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          등록된 프로젝트가 없습니다.
        </p>
      ) : (
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-2 pr-4 font-medium">이름</th>
              <th className="py-2 pr-4 font-medium">슬러그</th>
              <th className="py-2 pr-4 font-medium">설명</th>
              <th className="py-2 pl-4 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr
                key={p.id}
                className="border-b border-zinc-100 dark:border-zinc-900"
              >
                <td className="py-3 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                  {p.name}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  {p.slug}
                </td>
                <td className="max-w-xs truncate py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                  {p.description ?? "—"}
                </td>
                <td className="py-3 pl-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/projects/${p.id}/edit`}
                      className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      편집
                    </Link>
                    <form action={deleteProject}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        삭제
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
