// 참조: docs/domain/04-node.md (v1.3) — 매트릭스 셀 인라인 편집
"use client";

import { useState } from "react";

type Props = {
  value: string;
  level: "MODULE" | "FEATURE" | "REQUIREMENT";
  pending: boolean;
  /** 상세 패널에서 현재 열려 있는 노드인지(강조 표시). */
  active?: boolean;
  /** 값이 바뀐 채로 포커스를 잃으면 호출(자동 저장). */
  onCommit: (next: string) => void;
  /** 상세(ℹ) 아이콘 클릭. */
  onDetail: () => void;
  onDelete: () => void;
};

const BADGE: Record<Props["level"], { short: string; cls: string }> = {
  MODULE: { short: "M", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  FEATURE: { short: "F", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400" },
  REQUIREMENT: { short: "R", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
};

/** 한 노드의 이름 셀. 클릭/포커스로 편집, blur 시 변경분 자동 저장. */
export function NodeCell({
  value,
  level,
  pending,
  active = false,
  onCommit,
  onDetail,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState(value);
  const badge = BADGE[level];

  function commit() {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else if (!next) setDraft(value); // 빈 값이면 되돌린다
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded-md ${
        active ? "bg-blue-50 dark:bg-blue-950/30" : ""
      }`}
    >
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${badge.cls}`}
      >
        {badge.short}
      </span>
      <input
        value={draft}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(value);
            e.currentTarget.blur();
          }
        }}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none hover:border-zinc-200 focus:border-zinc-400 focus:bg-white disabled:opacity-50 dark:text-zinc-100 dark:hover:border-zinc-700 dark:focus:bg-zinc-900"
      />
      <button
        type="button"
        onClick={onDetail}
        aria-label="상세 정보"
        className={`shrink-0 rounded px-1.5 py-0.5 text-xs transition hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 ${
          active
            ? "text-blue-600 opacity-100 dark:text-blue-400"
            : "text-zinc-300 opacity-0 dark:text-zinc-600"
        }`}
      >
        ⓘ
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        aria-label="삭제"
        className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50 dark:text-zinc-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
      >
        ✕
      </button>
    </div>
  );
}
