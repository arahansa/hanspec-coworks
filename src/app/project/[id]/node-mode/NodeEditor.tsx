// 참조: docs/domain/04-node.md (v1.1) — 노드 편집기 UI (1단계: MODULE)
// 좌측: 모듈 트리 + "새 모듈". 우측: 선택된 모듈의 이름·설명 편집 / 삭제.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createModule, updateModule, deleteModule } from "./actions";

export type ModuleNode = {
  id: number;
  name: string;
  description: string | null;
  version: number;
};

type Props = {
  projectId: number;
  modules: ModuleNode[];
};

export function NodeEditor({ projectId, modules }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<number | null>(
    modules[0]?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const selected = modules.find((m) => m.id === selectedId) ?? null;

  function run(action: () => Promise<{ ok: boolean; error?: string; nodeId?: number }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "작업에 실패했습니다.");
        return;
      }
      if (result.nodeId) setSelectedId(result.nodeId);
      router.refresh();
    });
  }

  function handleCreate() {
    run(() => createModule(projectId, "새 모듈", ""));
  }

  function handleSave(formData: FormData) {
    if (!selected) return;
    const name = String(formData.get("name") ?? "");
    const description = String(formData.get("description") ?? "");
    run(() => updateModule(selected.id, name, description));
  }

  function handleDelete() {
    if (!selected) return;
    run(async () => {
      const r = await deleteModule(selected.id);
      if (r.ok) setSelectedId(null);
      return r;
    });
  }

  return (
    <div className="flex min-h-[24rem] gap-6">
      {/* 좌측: 모듈 트리 */}
      <div className="w-64 shrink-0">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            모듈
          </h2>
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending}
            className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            + 새 모듈
          </button>
        </div>

        {modules.length === 0 ? (
          <p className="px-2 text-sm text-zinc-500 dark:text-zinc-400">
            모듈이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {modules.map((m) => {
              const active = m.id === selectedId;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(m.id);
                      setError(null);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                      M
                    </span>
                    <span className="truncate">{m.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 우측: 디테일 패널 */}
      <div className="min-w-0 flex-1 border-l border-zinc-200 pl-6 dark:border-zinc-800">
        {selected ? (
          <form
            key={selected.id}
            action={handleSave}
            className="flex max-w-lg flex-col gap-4"
          >
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                MODULE
              </span>
              <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                v{selected.version}
              </span>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                이름
              </span>
              <input
                name="name"
                type="text"
                required
                maxLength={255}
                defaultValue={selected.name}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                설명
              </span>
              <textarea
                name="description"
                rows={4}
                defaultValue={selected.description ?? ""}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
              >
                {error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {pending ? "저장 중…" : "저장"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="rounded-md px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                삭제
              </button>
            </div>
          </form>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-sm text-zinc-400 dark:text-zinc-500">
            <p>
              {error ?? "모듈을 선택하거나 새로 만드세요."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
