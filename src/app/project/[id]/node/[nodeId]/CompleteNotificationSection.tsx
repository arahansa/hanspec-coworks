// 참조: docs/domain/12-complete-notification.md — 완료 알림 예약
// 이 요구사항이 DONE이 되면, 같은 기능 내 선택한 요구사항에 대한 확인 요청을
// 대상(개인/그룹)에게 자동 발송하도록 미리 예약한다.
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useRequirementMutation } from "./RequirementMutationContext";
import type { GroupOption } from "./RequestSection";
import {
  createCompleteNotification,
  deleteCompleteNotification,
} from "./actions";

export type SiblingRequirement = { id: number; name: string };
export type CompleteReservation = {
  id: number;
  targetNodeId: number;
  targetNodeName: string;
  receiverId: number | null;
  receiverName: string | null;
  groupId: number | null;
  groupName: string | null;
};

type Candidate = { id: number; username: string };

type Props = {
  nodeId: number;
  siblings: SiblingRequirement[];
  groups: GroupOption[];
  reservations: CompleteReservation[];
};

export function CompleteNotificationSection({
  nodeId,
  siblings,
  groups,
  reservations,
}: Props) {
  const router = useRouter();
  const { onMutated } = useRequirementMutation();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [targetNodeId, setTargetNodeId] = useState("");
  const [tab, setTab] = useState<"member" | "group">("member");

  // 개인 대상 @ 자동완성.
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);

  // 그룹 대상 선택.
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    if (!expanded || tab !== "member" || !open) return;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/members?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data: { ok: boolean; members?: Candidate[] } = await res.json();
        setCandidates(data.members ?? []);
      } catch {
        // 자동완성 네트워크 오류는 조용히 무시.
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open, tab, expanded]);

  function reserve(target: { receiverId: number } | { groupId: number }) {
    const tid = Number(targetNodeId);
    if (!Number.isInteger(tid)) {
      setError("알림을 보낼 요구사항을 먼저 선택하세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createCompleteNotification(nodeId, tid, target);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setGroupId("");
      setQuery("");
      setCandidates([]);
      router.refresh();
      onMutated();
    });
  }

  function remove(id: number) {
    setError(null);
    startTransition(async () => {
      const result = await deleteCompleteNotification(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onMutated();
    });
  }

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      active
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
    }`;

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
      >
        <span className="text-zinc-400">{expanded ? "▾" : "▸"}</span>
        완료 알림
        {reservations.length > 0 && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {reservations.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3">
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            이 요구사항이 <strong>완료(DONE)</strong>되면, 선택한 요구사항에 대한 확인 요청이
            대상에게 자동으로 발송됩니다.
          </p>

          {/* 예약 목록 */}
          {reservations.length > 0 && (
            <ul className="mb-4 flex flex-col gap-2">
              {reservations.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <span className="min-w-0 text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-400">→ </span>
                    <span className="font-medium">{r.targetNodeName}</span>
                    <span className="text-zinc-400"> · </span>
                    {r.receiverName != null ? (
                      <span className="font-mono">@{r.receiverName}</span>
                    ) : (
                      <span>그룹 {r.groupName}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(r.id)}
                    aria-label="예약 삭제"
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}

          {siblings.length === 0 ? (
            <p className="text-sm text-zinc-400">
              같은 기능 내에 선택할 다른 요구사항이 없습니다.
            </p>
          ) : (
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  알림 대상 요구사항
                </span>
                <select
                  value={targetNodeId}
                  disabled={pending}
                  onChange={(e) => setTargetNodeId(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="">요구사항 선택…</option>
                  {siblings.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mb-3 mt-4 flex gap-1">
                <button type="button" onClick={() => setTab("member")} className={tabCls(tab === "member")}>
                  개인
                </button>
                <button type="button" onClick={() => setTab("group")} className={tabCls(tab === "group")}>
                  그룹
                </button>
              </div>

              {tab === "member" ? (
                <div className="relative max-w-xs">
                  <div className="flex items-center rounded-md border border-zinc-300 bg-white px-2 focus-within:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
                    <span className="font-mono text-sm text-zinc-400">@</span>
                    <input
                      value={query}
                      disabled={pending}
                      onFocus={() => setOpen(true)}
                      onBlur={() => setTimeout(() => setOpen(false), 120)}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                      }}
                      placeholder="알림 받을 멤버 username 검색"
                      className="w-full bg-transparent px-1.5 py-1.5 text-sm text-zinc-900 outline-none disabled:opacity-50 dark:text-zinc-100"
                    />
                  </div>

                  {open && candidates.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                      {candidates.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setOpen(false);
                              reserve({ receiverId: c.id });
                            }}
                            className="block w-full px-3 py-2 text-left font-mono text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            @{c.username}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : groups.length === 0 ? (
                <p className="text-sm text-zinc-400">이 프로젝트에 그룹이 없습니다.</p>
              ) : (
                <div className="flex max-w-sm items-center gap-2">
                  <select
                    value={groupId}
                    disabled={pending}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">그룹 선택…</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending || !groupId || !targetNodeId}
                    onClick={() => reserve({ groupId: Number(groupId) })}
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    예약
                  </button>
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </section>
  );
}
