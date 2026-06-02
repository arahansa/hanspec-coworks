// 요구사항 상세 페이지의 설명(description) 편집 섹션.
// 드로어 패널(NodeDetailPanel)과 동일하게 항상 표시·편집 가능하게 한다.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateNodeDescription } from "./actions";

type Props = {
  nodeId: number;
  description: string | null;
};

export function DescriptionSection({ nodeId, description }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(description ?? "");

  const dirty = draft.trim() !== (description ?? "").trim();

  function save() {
    if (!dirty || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await updateNodeDescription(nodeId, draft);
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
        설명
      </h2>

      <textarea
        value={draft}
        rows={6}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="이 요구사항에 대한 설명을 입력하세요."
        className="w-full max-w-2xl rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={save}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "저장 중…" : "설명 저장"}
        </button>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </section>
  );
}
