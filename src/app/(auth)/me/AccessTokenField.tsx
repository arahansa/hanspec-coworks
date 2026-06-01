// 참조: docs/domain/08-access_token.md (v1.0) — 토큰 평문 표시 + 복사
"use client";

import { useEffect, useRef, useState } from "react";

/** 액세스 토큰을 평문으로 표시하고 클립보드 복사를 제공한다. */
export function AccessTokenField({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없으면 무시 — 사용자가 직접 선택해 복사할 수 있다.
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1.5 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {token}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}
