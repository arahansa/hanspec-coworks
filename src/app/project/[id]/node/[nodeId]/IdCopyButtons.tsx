// 참조: docs/domain/04-node.md — 노드 상세 헤더의 id/URL 복사 버튼
// "#{id}" 표시 옆에서 (1) id만, (2) 현재 페이지 URL을 클립보드로 복사한다.
// 서버 컴포넌트(page.tsx)에서 쓰지 못하는 navigator.clipboard/window를 다룬다.
"use client";

import { useState } from "react";

type Props = { nodeId: number };

type Copied = "id" | "url" | null;

export function IdCopyButtons({ nodeId }: Props) {
  const [copied, setCopied] = useState<Copied>(null);

  async function copy(kind: Exclude<Copied, null>, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      // 잠시 후 피드백을 되돌린다.
      window.setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1500);
    } catch {
      // 클립보드 권한 거부 등은 조용히 무시한다(아이콘만 그대로).
    }
  }

  const btnCls =
    "rounded px-1 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200";

  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle">
      <button
        type="button"
        onClick={() => copy("id", String(nodeId))}
        aria-label="ID 복사"
        title="ID 복사"
        className={btnCls}
      >
        {copied === "id" ? "✓" : "⧉"}
      </button>
      <button
        type="button"
        onClick={() => copy("url", window.location.href)}
        aria-label="페이지 주소 복사"
        title="페이지 주소 복사"
        className={btnCls}
      >
        {copied === "url" ? "✓" : "🔗"}
      </button>
    </span>
  );
}
