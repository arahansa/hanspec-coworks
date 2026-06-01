// 참조: docs/superpowers/specs/2026-06-02-node-status-assignee-design.md (v1.0)
// 노드 상태(NodeStatus)의 라벨·색 매핑. StatusSection과 배지가 공유한다.
import type { NodeStatus } from "@/generated/prisma/client";

export const NODE_STATUS_ORDER: NodeStatus[] = ["DRAFT", "IN_PROGRESS", "DONE"];

export const NODE_STATUS_LABEL: Record<NodeStatus, string> = {
  DRAFT: "초안",
  IN_PROGRESS: "진행중",
  DONE: "완료",
};

/** 배지·세그먼트 버튼(선택 시)에 쓰는 상태별 색 클래스. */
export const NODE_STATUS_BADGE_CLASS: Record<NodeStatus, string> = {
  DRAFT:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  IN_PROGRESS:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  DONE:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};
