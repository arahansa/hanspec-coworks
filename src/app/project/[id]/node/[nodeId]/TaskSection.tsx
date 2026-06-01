// 참조: docs/superpowers/specs/2026-06-01-requirement-detail-task-design.md (v1.0)
// 요구사항 상세 페이지의 Task 목록 + 인라인 생성 폼.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "./actions";

export type TaskItem = {
  id: number;
  description: string;
  progress: number;
  createdAt: string; // ISO 문자열
};

type Props = {
  nodeId: number;
  tasks: TaskItem[];
};

export function TaskSection({ nodeId, tasks }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createTask(nodeId, description, progress);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDescription("");
      setProgress(0);
      router.refresh();
    });
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Task <span className="text-sm font-normal text-zinc-400">({tasks.length})</span>
      </h2>

      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-700">
          아직 등록된 Task가 없습니다. 아래에서 추가하세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex items-start justify-between gap-4 rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <div className="min-w-0">
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-200">
                  {t.description}
                </p>
                <p className="mt-1 font-mono text-[11px] text-zinc-400">
                  #{t.id} · {t.createdAt.slice(0, 10)}
                </p>
              </div>
              <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {t.progress}%
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">새 Task 추가</h3>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">작업 설명</span>
          <textarea
            value={description}
            rows={3}
            disabled={pending}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="작업 내용을 입력하세요."
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">진행도(%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={progress}
            disabled={pending}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="button"
          disabled={pending || !description.trim()}
          onClick={submit}
          className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "추가 중…" : "Task 추가"}
        </button>
      </div>
    </section>
  );
}
