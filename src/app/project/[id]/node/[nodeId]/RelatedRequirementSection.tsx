// 참조: docs/superpowers/specs/2026-06-08-related-requirement-design.md (v1.0)
// 요구사항 상세의 "관련 요구사항" 섹션. AssigneeSection 패턴을 따른다.
"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addRelation, removeRelation } from "./actions";

export type RelatedItem = { id: number; name: string };

type Candidate = { id: number; name: string };

type Props = {
  nodeId: number;
  projectId: number;
  related: RelatedItem[];
};

export function RelatedRequirementSection({ nodeId, projectId, related }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);

  const relatedIds = new Set(related.map((r) => r.id));

  // 입력 디바운스: 입력이 멈춘 뒤 200ms 후 같은 프로젝트의 요구사항 검색.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/related-requirements?nodeId=${nodeId}&q=${encodeURIComponent(query)}`,
        );
        if (!res.ok) return;
        const data: { ok: boolean; candidates?: Candidate[] } = await res.json();
        // 이미 연결된 요구사항은 후보에서 제외.
        setCandidates((data.candidates ?? []).filter((c) => !relatedIds.has(c.id)));
      } catch {
        // 네트워크 오류는 자동완성에서 조용히 무시.
      }
    }, 200);
    return () => clearTimeout(handle);
    // relatedIds는 related에서 파생되므로 related를 의존성으로 둔다.
  }, [query, open, related, nodeId]);

  function add(otherId: number) {
    setError(null);
    setOpen(false);
    setQuery("");
    setCandidates([]);
    startTransition(async () => {
      const result = await addRelation(nodeId, otherId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove(otherId: number) {
    setError(null);
    startTransition(async () => {
      const result = await removeRelation(nodeId, otherId);
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
        관련 요구사항 <span className="text-sm font-normal text-zinc-400">({related.length})</span>
      </h2>

      {related.length > 0 ? (
        <ul className="mb-3 flex flex-col gap-2">
          {related.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <Link
                href={`/project/${projectId}/node/${r.id}`}
                className="flex min-w-0 items-center gap-2 text-zinc-700 hover:underline dark:text-zinc-200"
              >
                <span className="shrink-0 font-mono text-xs text-zinc-400">#{r.id}</span>
                <span className="truncate">{r.name}</span>
              </Link>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(r.id)}
                aria-label={`#${r.id} 관련 요구사항 연결 해제`}
                className="shrink-0 rounded-full px-1 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-zinc-400">아직 연결된 요구사항이 없습니다.</p>
      )}

      <div className="relative max-w-xs">
        <div className="flex items-center rounded-md border border-zinc-300 bg-white px-2 focus-within:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          <span className="font-mono text-sm text-zinc-400">🔍</span>
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
            placeholder="요구사항 이름 검색"
            className="w-full bg-transparent px-1.5 py-1.5 text-sm text-zinc-900 outline-none disabled:opacity-50 dark:text-zinc-100"
          />
        </div>

        {open && candidates.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  // onClick 대신 onMouseDown: input의 blur보다 먼저 실행되도록.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(c.id);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <span className="shrink-0 font-mono text-xs text-zinc-400">#{c.id}</span>
                  <span className="truncate">{c.name}</span>
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
