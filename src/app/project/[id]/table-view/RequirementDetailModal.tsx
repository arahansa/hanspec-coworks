// 참조: docs/domain/04-node.md — 노드 상세 패널의 "모달 보기"
// 패널의 모달 아이콘 클릭 시, 상세 페이지와 동일한 본문을 모달로 띄운다.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RequirementDetailBody,
  type RequirementDetailData,
} from "@/app/project/[id]/node/[nodeId]/RequirementDetailBody";
import { RequirementMutationProvider } from "@/app/project/[id]/node/[nodeId]/RequirementMutationContext";

type Props = { nodeId: number; onClose: () => void };

export function RequirementDetailModal({ nodeId, onClose }: Props) {
  const [data, setData] = useState<RequirementDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 모달이 열린 동안 ESC로 닫고, 배경 스크롤을 잠근다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // 상세 데이터를 불러온다. clearFirst=true면 먼저 "불러오는 중…"을 표시(최초 로딩용).
  // 섹션의 서버 액션 후 재조회(onMutated)는 clearFirst=false로 화면 깜빡임을 피한다.
  const load = useCallback(
    async (clearFirst: boolean) => {
      if (clearFirst) setData(null);
      setError(null);
      try {
        const res = await fetch(`/api/nodes/${nodeId}/requirement-detail`);
        const json: { ok: boolean; data?: RequirementDetailData; error?: string } =
          await res.json();
        if (!json.ok || !json.data) {
          setError(json.error ?? "상세를 불러오지 못했습니다.");
          return;
        }
        setData(json.data);
      } catch {
        setError("상세를 불러오지 못했습니다.");
      }
    },
    [nodeId],
  );

  // nodeId가 바뀌면 상세 데이터를 처음부터 다시 불러온다.
  useEffect(() => {
    load(true);
  }, [load]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="요구사항 상세"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-4 w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          ✕
        </button>

        {error ? (
          <p className="py-12 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : !data ? (
          <p className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
            불러오는 중…
          </p>
        ) : (
          <RequirementMutationProvider value={{ onMutated: () => load(false) }}>
            <RequirementDetailBody data={data} />
          </RequirementMutationProvider>
        )}
      </div>
    </div>
  );
}
