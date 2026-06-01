// 참조: docs/superpowers/specs/2026-06-02-node-status-assignee-design.md (v1.0)
// 요구사항 상세 페이지의 상태 변경 섹션. (03-node.md 추가요청1)
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { NodeStatus } from "@/generated/prisma/client";
import { updateNodeStatus } from "./actions";
import {
  NODE_STATUS_BADGE_CLASS,
  NODE_STATUS_LABEL,
  NODE_STATUS_ORDER,
} from "./node-status";

type Props = {
  nodeId: number;
  status: NodeStatus;
};

export function StatusSection({ nodeId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: NodeStatus) {
    if (next === status || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await updateNodeStatus(nodeId, next);
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
        상태
      </h2>

      <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
        {NODE_STATUS_ORDER.map((s, i) => {
          const active = s === status;
          return (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => change(s)}
              className={[
                "px-4 py-1.5 text-sm transition-colors disabled:opacity-50",
                i > 0 ? "border-l border-zinc-300 dark:border-zinc-700" : "",
                active
                  ? NODE_STATUS_BADGE_CLASS[s] + " font-medium"
                  : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800",
              ].join(" ")}
              aria-pressed={active}
            >
              {NODE_STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
