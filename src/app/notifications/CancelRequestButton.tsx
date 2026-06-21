// 참조: docs/domain/11-request-notification.md — 보낸 요청 철회(취소) 버튼
// sent 탭의 미확인 요청에만 노출된다(확인된 요청은 부모에서 렌더하지 않음).
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRequest } from "./actions";

type Props = { requestId: number };

export function CancelRequestButton({ requestId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRequest(requestId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={cancel}
      disabled={pending}
      aria-label="보낸 요청 취소"
      title={error ?? "요청 취소"}
      className={`rounded-md border px-2 py-1 text-xs font-medium transition disabled:opacity-40 ${
        error
          ? "border-red-400 text-red-500"
          : "border-zinc-300 text-zinc-500 hover:border-red-500 hover:text-red-500 dark:border-zinc-600 dark:text-zinc-400"
      }`}
    >
      {pending ? "취소 중…" : error ? "실패" : "취소"}
    </button>
  );
}
