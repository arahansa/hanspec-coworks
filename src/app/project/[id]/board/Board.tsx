// 참조: docs/domain/03-node.md (상태 DRAFT/IN_PROGRESS/DONE)
// 보드(칸반) 본체. 요구사항 카드를 상태별 컬럼으로 나눠 보여주고,
// 드래그&드롭으로 컬럼을 옮기면 서버 액션으로 상태를 전환한다.
"use client";

import { useMemo, useState, useTransition } from "react";
import type { NodeStatus } from "@/generated/prisma/client";
import {
  NODE_STATUS_ORDER,
  NODE_STATUS_LABEL,
} from "@/app/project/[id]/node/[nodeId]/node-status";
import { moveCardStatus } from "./actions";
import { BoardCardItem } from "./BoardCardItem";
import { MultiFilter } from "./MultiFilter";
import type { BoardCard, BoardFilterOptions } from "./types";

type Props = {
  projectId: number;
  cards: BoardCard[];
  options: BoardFilterOptions;
  /** 로그인한 멤버. "내 작업만" 토글에 사용한다. */
  currentMemberId: number;
};

/** 컬럼 헤더의 상태별 강조색. 카드 배지와 톤을 맞춘다. */
const COLUMN_ACCENT: Record<NodeStatus, string> = {
  DRAFT: "border-t-zinc-400 dark:border-t-zinc-600",
  IN_PROGRESS: "border-t-amber-400 dark:border-t-amber-600",
  DONE: "border-t-emerald-400 dark:border-t-emerald-600",
};

export function Board({
  projectId,
  cards,
  options,
  currentMemberId,
}: Props) {
  const [moduleFilter, setModuleFilter] = useState<Set<number>>(new Set());
  const [featureFilter, setFeatureFilter] = useState<Set<number>>(new Set());
  const [assigneeFilter, setAssigneeFilter] = useState<Set<number>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [mineOnly, setMineOnly] = useState(false);
  // 필터 드롭다운은 한 번에 하나만 펼친다(겹침 방지).
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  // 드래그 중인 카드 id와 드래그가 올라와 있는 컬럼. 드롭 대상 강조에 쓴다.
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<NodeStatus | null>(null);

  // 서버 왕복 동안 카드가 제자리에 남아 보이지 않도록 낙관적으로 상태를 덮어쓴다.
  const [optimistic, setOptimistic] = useState<Map<number, NodeStatus>>(
    new Map(),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 낙관적 상태를 반영한 카드 목록.
  const effectiveCards = useMemo(
    () =>
      cards.map((c) => {
        const next = optimistic.get(c.id);
        return next && next !== c.status ? { ...c, status: next } : c;
      }),
    [cards, optimistic],
  );

  // 선택이 비어 있는 필터는 "전체"를 뜻하므로 통과시킨다.
  const visibleCards = useMemo(
    () =>
      effectiveCards.filter((c) => {
        if (moduleFilter.size > 0 && (c.moduleId === null || !moduleFilter.has(c.moduleId))) {
          return false;
        }
        if (featureFilter.size > 0 && (c.featureId === null || !featureFilter.has(c.featureId))) {
          return false;
        }
        if (
          assigneeFilter.size > 0 &&
          !c.assignees.some((a) => assigneeFilter.has(a.id))
        ) {
          return false;
        }
        if (tagFilter.size > 0 && !c.tags.some((t) => tagFilter.has(t))) {
          return false;
        }
        if (mineOnly && !c.assignees.some((a) => a.id === currentMemberId)) {
          return false;
        }
        return true;
      }),
    [
      effectiveCards,
      moduleFilter,
      featureFilter,
      assigneeFilter,
      tagFilter,
      mineOnly,
      currentMemberId,
    ],
  );

  function handleDrop(status: NodeStatus, nodeId: number) {
    setDragOverStatus(null);
    setDraggingId(null);

    const card = cards.find((c) => c.id === nodeId);
    if (!card) return;
    const current = optimistic.get(nodeId) ?? card.status;
    if (current === status) return;

    setError(null);
    setOptimistic((prev) => new Map(prev).set(nodeId, status));

    startTransition(async () => {
      const result = await moveCardStatus(nodeId, status);
      if (!result.ok) {
        // 실패하면 낙관적 갱신을 되돌리고 사유를 알린다.
        setOptimistic((prev) => {
          const next = new Map(prev);
          next.delete(nodeId);
          return next;
        });
        setError(result.error);
      }
    });
  }

  const anyFilterActive =
    moduleFilter.size > 0 ||
    featureFilter.size > 0 ||
    assigneeFilter.size > 0 ||
    tagFilter.size > 0 ||
    mineOnly;

  function clearFilters() {
    setModuleFilter(new Set());
    setFeatureFilter(new Set());
    setAssigneeFilter(new Set());
    setTagFilter(new Set());
    setMineOnly(false);
  }

  return (
    <div>
      {/* 필터 바 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MultiFilter
          title="모듈"
          options={options.modules.map((m) => ({ value: m.id, label: m.name }))}
          selected={moduleFilter}
          onChange={setModuleFilter}
          openFilter={openFilter}
          onOpenChange={setOpenFilter}
        />
        <MultiFilter
          title="기능"
          options={options.features.map((f) => ({ value: f.id, label: f.name }))}
          selected={featureFilter}
          onChange={setFeatureFilter}
          openFilter={openFilter}
          onOpenChange={setOpenFilter}
        />
        <MultiFilter
          title="담당자"
          options={options.assignees.map((a) => ({
            value: a.id,
            label: a.name,
          }))}
          selected={assigneeFilter}
          onChange={setAssigneeFilter}
          openFilter={openFilter}
          onOpenChange={setOpenFilter}
        />
        <MultiFilter
          title="태그"
          options={options.tags.map((t) => ({ value: t, label: t }))}
          selected={tagFilter}
          onChange={setTagFilter}
          openFilter={openFilter}
          onOpenChange={setOpenFilter}
        />

        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 transition hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
          />
          내 작업만
        </label>

        {anyFilterActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md px-2 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            필터 초기화
          </button>
        )}

        <span className="ml-auto text-sm text-zinc-400 dark:text-zinc-500">
          {visibleCards.length} / {cards.length}
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {/* 상태별 컬럼 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {NODE_STATUS_ORDER.map((status) => {
          const columnCards = visibleCards.filter((c) => c.status === status);
          const isOver = dragOverStatus === status;
          return (
            <section
              key={status}
              onDragOver={(e) => {
                // preventDefault를 해야 drop 이벤트가 발생한다(HTML5 DnD 규칙).
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverStatus(status);
              }}
              onDragLeave={(e) => {
                // 자식 요소로 이동하는 경우는 떠난 것이 아니므로 무시한다.
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOverStatus((prev) => (prev === status ? null : prev));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const nodeId = Number(e.dataTransfer.getData("text/plain"));
                if (Number.isInteger(nodeId)) handleDrop(status, nodeId);
              }}
              aria-label={`${NODE_STATUS_LABEL[status]} 컬럼`}
              className={`rounded-lg border border-t-4 bg-zinc-50/60 p-3 transition dark:bg-zinc-900/40 ${
                COLUMN_ACCENT[status]
              } ${
                isOver
                  ? "border-blue-400 bg-blue-50/60 dark:border-blue-600 dark:bg-blue-950/20"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  {NODE_STATUS_LABEL[status]}
                </h2>
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {columnCards.length}
                </span>
              </div>

              <ul className="flex min-h-24 flex-col gap-2">
                {columnCards.length === 0 ? (
                  <li className="rounded-md border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-600">
                    {isOver ? "여기에 놓기" : "요구사항 없음"}
                  </li>
                ) : (
                  columnCards.map((card) => (
                    <BoardCardItem
                      key={card.id}
                      projectId={projectId}
                      card={card}
                      pending={
                        draggingId === card.id ||
                        (pending && optimistic.has(card.id))
                      }
                      onDragStart={setDraggingId}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStatus(null);
                      }}
                    />
                  ))
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
