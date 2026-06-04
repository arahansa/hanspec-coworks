// 참조: docs/domain/11-request-notification.md — 받은 요청 체크 버튼
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkRequest } from "./actions";

type Props = { requestId: number; checked: boolean };

export function CheckButton({ requestId, checked }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (checked) {
    return (
      <span
        aria-label="확인됨"
        className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
        title="확인됨"
      >
        ✓
      </span>
    );
  }

  function check() {
    setError(null);
    startTransition(async () => {
      const result = await checkRequest(requestId);
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
      onClick={check}
      disabled={pending}
      aria-label="요청 확인"
      title={error ?? "확인 처리"}
      className={`flex h-6 w-6 items-center justify-center rounded-md border transition disabled:opacity-40 ${
        error
          ? "border-red-400 text-red-500"
          : "border-zinc-300 text-transparent hover:border-emerald-500 hover:text-emerald-500 dark:border-zinc-600"
      }`}
    >
      ✓
    </button>
  );
}
