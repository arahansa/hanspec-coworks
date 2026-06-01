// 참조: docs/superpowers/specs/2026-06-02-node-status-assignee-design.md (v1.0)
// 요구사항 상세 페이지의 담당자 지정 섹션. (03-node.md 추가요청2)
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAssignee, removeAssignee } from "./actions";

export type AssigneeItem = { id: number; username: string };

type Candidate = { id: number; username: string };

type Props = {
  nodeId: number;
  assignees: AssigneeItem[];
};

export function AssigneeSection({ nodeId, assignees }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);

  const assignedIds = new Set(assignees.map((a) => a.id));

  // `@` 입력 디바운스: 입력이 멈춘 뒤 200ms 후 멤버 검색.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/members?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data: { ok: boolean; members?: Candidate[] } = await res.json();
        // 이미 지정된 멤버는 후보에서 제외.
        setCandidates((data.members ?? []).filter((m) => !assignedIds.has(m.id)));
      } catch {
        // 네트워크 오류는 자동완성에서 조용히 무시.
      }
    }, 200);
    return () => clearTimeout(handle);
    // assignedIds는 assignees에서 파생되므로 assignees를 의존성으로 둔다.
  }, [query, open, assignees]);

  function add(memberId: number) {
    setError(null);
    setOpen(false);
    setQuery("");
    setCandidates([]);
    startTransition(async () => {
      const result = await addAssignee(nodeId, memberId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(memberId: number) {
    setError(null);
    startTransition(async () => {
      const result = await removeAssignee(nodeId, memberId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        담당자 <span className="text-sm font-normal text-zinc-400">({assignees.length})</span>
      </h2>

      {assignees.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {assignees.map((a) => (
            <li
              key={a.id}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-1 pl-3 pr-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <span className="font-mono">@{a.username}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(a.id)}
                aria-label={`@${a.username} 담당자 제거`}
                className="rounded-full px-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-zinc-400">아직 지정된 담당자가 없습니다.</p>
      )}

      <div className="relative max-w-xs">
        <div className="flex items-center rounded-md border border-zinc-300 bg-white px-2 focus-within:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          <span className="font-mono text-sm text-zinc-400">@</span>
          <input
            value={query}
            disabled={pending}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // 후보 클릭(mousedown)이 먼저 처리되도록 살짝 지연 후 닫는다.
              setTimeout(() => setOpen(false), 120);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            placeholder="담당자 username 검색"
            className="w-full bg-transparent px-1.5 py-1.5 text-sm text-zinc-900 outline-none disabled:opacity-50 dark:text-zinc-100"
          />
        </div>

        {open && candidates.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  // onClick 대신 onMouseDown: input의 blur보다 먼저 실행되도록.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(c.id);
                  }}
                  className="block w-full px-3 py-2 text-left font-mono text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  @{c.username}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
