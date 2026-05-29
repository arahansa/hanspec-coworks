// 참조: docs/domain/04-node.md — 노드 상세 패널
// "노드 상세 아이콘 클릭시 상세 정보 표현" (Node id=45) 구현.
"use client";

import { useState } from "react";

export type DetailNode = {
  id: number;
  name: string;
  level: "MODULE" | "FEATURE" | "REQUIREMENT";
  description: string | null;
  version: number;
  createdAt: string; // ISO 문자열
};

const LEVEL_LABEL: Record<DetailNode["level"], string> = {
  MODULE: "모듈",
  FEATURE: "기능",
  REQUIREMENT: "요구사항",
};

type Props = {
  node: DetailNode;
  pending: boolean;
  onClose: () => void;
  /** 설명 저장(변경 시에만 호출). */
  onSaveDescription: (description: string) => void;
};

export function NodeDetailPanel({ node, pending, onClose, onSaveDescription }: Props) {
  const [draft, setDraft] = useState(node.description ?? "");
  const dirty = draft.trim() !== (node.description ?? "").trim();

  return (
    <aside className="w-80 shrink-0 border-l border-zinc-200 pl-5 dark:border-zinc-800">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {LEVEL_LABEL[node.level]}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded px-1.5 py-0.5 text-sm text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          ✕
        </button>
      </div>

      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {node.name}
      </h2>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500 dark:text-zinc-400">버전</dt>
          <dd className="font-mono text-zinc-700 dark:text-zinc-300">v{node.version}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500 dark:text-zinc-400">생성일</dt>
          <dd className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
            {node.createdAt.slice(0, 10)}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">설명</span>
          <textarea
            value={draft}
            rows={6}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="이 노드에 대한 설명을 입력하세요."
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => onSaveDescription(draft)}
          className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "저장 중…" : "설명 저장"}
        </button>
      </div>
    </aside>
  );
}
