// 참조: docs/domain/04-node.md (v1.2) — 노드 편집기 UI (MODULE + FEATURE)
// 좌측: 모듈/피처 트리(펼침·접힘) + 추가 버튼. 우측: 선택 노드 공통 편집/삭제.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createModule,
  createFeature,
  updateNode,
  deleteNode,
} from "./actions";

type NodeLevel = "MODULE" | "FEATURE";

export type FeatureNode = {
  id: number;
  name: string;
  description: string | null;
  version: number;
};

export type ModuleNode = FeatureNode & {
  children: FeatureNode[];
};

type Selection = { id: number; level: NodeLevel } | null;

type Props = {
  projectId: number;
  modules: ModuleNode[];
};

type ActionResult = { ok: boolean; error?: string; nodeId?: number };

const LEVEL_BADGE: Record<NodeLevel, { label: string; short: string }> = {
  MODULE: { label: "MODULE", short: "M" },
  FEATURE: { label: "FEATURE", short: "F" },
};

export function NodeEditor({ projectId, modules }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Selection>(
    modules[0] ? { id: modules[0].id, level: "MODULE" } : null,
  );
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(modules.map((m) => m.id)),
  );
  const [error, setError] = useState<string | null>(null);

  // 선택된 노드를 트리에서 찾는다.
  const selectedNode: (FeatureNode & { level: NodeLevel }) | null = (() => {
    if (!selected) return null;
    if (selected.level === "MODULE") {
      const m = modules.find((m) => m.id === selected.id);
      return m ? { ...m, level: "MODULE" } : null;
    }
    for (const m of modules) {
      const f = m.children.find((c) => c.id === selected.id);
      if (f) return { ...f, level: "FEATURE" };
    }
    return null;
  })();

  function run(action: () => Promise<ActionResult>, onOk?: (r: ActionResult) => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "작업에 실패했습니다.");
        return;
      }
      onOk?.(result);
      router.refresh();
    });
  }

  function toggle(moduleId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  }

  function handleCreateModule() {
    run(
      () => createModule(projectId, "새 모듈", ""),
      (r) => r.nodeId && setSelected({ id: r.nodeId, level: "MODULE" }),
    );
  }

  function handleCreateFeature(moduleId: number) {
    run(
      () => createFeature(moduleId, "새 기능", ""),
      (r) => {
        setExpanded((prev) => new Set(prev).add(moduleId));
        if (r.nodeId) setSelected({ id: r.nodeId, level: "FEATURE" });
      },
    );
  }

  function handleSave(formData: FormData) {
    if (!selected) return;
    const name = String(formData.get("name") ?? "");
    const description = String(formData.get("description") ?? "");
    run(() => updateNode(selected.id, name, description));
  }

  function handleDelete() {
    if (!selected) return;
    run(
      () => deleteNode(selected.id),
      () => setSelected(null),
    );
  }

  const nodeRowClass = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
      active
        ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
    }`;

  const badge = (level: NodeLevel) => (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
      {LEVEL_BADGE[level].short}
    </span>
  );

  return (
    <div className="flex min-h-[24rem] gap-6">
      {/* 좌측: 트리 */}
      <div className="w-72 shrink-0">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            노드
          </h2>
          <button
            type="button"
            onClick={handleCreateModule}
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
          <ul className="flex flex-col gap-0.5">
            {modules.map((m) => {
              const isExpanded = expanded.has(m.id);
              const moduleActive =
                selected?.level === "MODULE" && selected.id === m.id;
              return (
                <li key={m.id}>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggle(m.id)}
                      aria-label={isExpanded ? "접기" : "펼치기"}
                      className="w-4 shrink-0 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      {m.children.length > 0 ? (isExpanded ? "▼" : "▶") : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected({ id: m.id, level: "MODULE" });
                        setError(null);
                      }}
                      className={nodeRowClass(moduleActive)}
                    >
                      {badge("MODULE")}
                      <span className="truncate">{m.name}</span>
                    </button>
                  </div>

                  {isExpanded && (
                    <ul className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
                      {m.children.map((f) => {
                        const featActive =
                          selected?.level === "FEATURE" && selected.id === f.id;
                        return (
                          <li key={f.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelected({ id: f.id, level: "FEATURE" });
                                setError(null);
                              }}
                              className={nodeRowClass(featActive)}
                            >
                              {badge("FEATURE")}
                              <span className="truncate">{f.name}</span>
                            </button>
                          </li>
                        );
                      })}
                      <li>
                        <button
                          type="button"
                          onClick={() => handleCreateFeature(m.id)}
                          disabled={pending}
                          className="rounded-md px-2 py-1 text-left text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                        >
                          + 기능 추가
                        </button>
                      </li>
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 우측: 디테일 패널 */}
      <div className="min-w-0 flex-1 border-l border-zinc-200 pl-6 dark:border-zinc-800">
        {selectedNode ? (
          <form
            key={`${selectedNode.level}-${selectedNode.id}`}
            action={handleSave}
            className="flex max-w-lg flex-col gap-4"
          >
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                {LEVEL_BADGE[selectedNode.level].label}
              </span>
              <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                v{selectedNode.version}
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
                defaultValue={selectedNode.name}
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
                defaultValue={selectedNode.description ?? ""}
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
            <p>{error ?? "노드를 선택하거나 새로 만드세요."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
