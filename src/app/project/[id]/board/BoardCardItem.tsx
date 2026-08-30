// 보드의 카드 1장. REQUIREMENT 노드를 나타내며 드래그해서 다른 컬럼으로 옮길 수 있다.
// 카드 클릭 시 요구사항 상세 화면으로 이동한다.
"use client";

import Link from "next/link";
import type { BoardCard } from "./types";

type Props = {
  projectId: number;
  card: BoardCard;
  /** 낙관적 갱신 중이라 서버 응답을 기다리는 상태. 흐리게 표시한다. */
  pending: boolean;
  onDragStart: (nodeId: number) => void;
  onDragEnd: () => void;
};

/** ISO 문자열을 YY-MM-DD로 짧게 표시한다. 카드가 좁아 연도는 두 자리만 쓴다. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function BoardCardItem({
  projectId,
  card,
  pending,
  onDragStart,
  onDragEnd,
}: Props) {
  return (
    <li
      draggable
      onDragStart={(e) => {
        // 드롭 대상(컬럼)에서 노드 id를 읽을 수 있도록 함께 실어 보낸다.
        e.dataTransfer.setData("text/plain", String(card.id));
        e.dataTransfer.effectAllowed = "move";
        onDragStart(card.id);
      }}
      onDragEnd={onDragEnd}
      className={`cursor-grab rounded-md border border-zinc-200 bg-white p-3 shadow-sm transition active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900 ${
        pending ? "opacity-50" : "hover:border-zinc-300 dark:hover:border-zinc-600"
      }`}
    >
      <Link
        href={`/project/${projectId}/node/${card.id}`}
        className="block text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
      >
        {card.name}
      </Link>

      {/* 상위 경로: 모듈 › 기능. 카드만 보고 위치를 알 수 있게 한다. */}
      {(card.moduleName || card.featureName) && (
        <p className="mt-1 truncate text-xs text-zinc-400 dark:text-zinc-500">
          {[card.moduleName, card.featureName].filter(Boolean).join(" › ")}
        </p>
      )}

      {card.tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <li
              key={tag}
              className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {card.assignees.length === 0
            ? "담당자 없음"
            : card.assignees.map((a) => `@${a.username}`).join(", ")}
        </span>
        {card.completedAt && (
          <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400">
            ✓ {shortDate(card.completedAt)}
          </span>
        )}
      </div>
    </li>
  );
}
