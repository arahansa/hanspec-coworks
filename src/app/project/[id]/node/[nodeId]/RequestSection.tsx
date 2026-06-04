// 참조: docs/domain/11-request-notification.md — 요구사항에서 개인/그룹에게 확인 요청 보내기
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendRequest } from "./actions";

export type GroupOption = { id: number; name: string };
type Candidate = { id: number; username: string };

type Props = {
  nodeId: number;
  /** 노드가 속한 프로젝트의 그룹 목록. */
  groups: GroupOption[];
  /** 이미 확인 요청을 보낸 개인 멤버 id 목록. */
  requestedMemberIds: number[];
  /** 이미 확인 요청을 보낸 그룹 id 목록. */
  requestedGroupIds: number[];
};

export function RequestSection({
  nodeId,
  groups,
  requestedMemberIds,
  requestedGroupIds,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [tab, setTab] = useState<"member" | "group">("member");

  // 개인 대상 @ 자동완성.
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);

  // 그룹 대상 선택.
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    if (tab !== "member" || !open) return;
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
  }, [query, open, tab]);

  function send(target: { receiverId: number } | { groupId: number }, label: string) {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await sendRequest(nodeId, target);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(`${label}에게 확인 요청을 보냈습니다.`);
      // 서버에서 "이미 보낸 대상" 목록을 다시 받아와 요청됨 표시를 갱신한다.
      router.refresh();
    });
  }

  function sendToGroup() {
    const id = Number(groupId);
    if (!Number.isInteger(id) || pending) return;
    const name = groups.find((g) => g.id === id)?.name ?? "그룹";
    // 선택은 유지한다(전송 후 "요청됨" 표시를 계속 보여주기 위해).
    send({ groupId: id }, name);
  }

  const selectedGroupRequested =
    groupId !== "" && requestedGroupIds.includes(Number(groupId));

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      active
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
    }`;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        확인 요청
      </h2>

      <div className="mb-3 flex gap-1">
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
              placeholder="요청 보낼 멤버 username 검색"
              className="w-full bg-transparent px-1.5 py-1.5 text-sm text-zinc-900 outline-none disabled:opacity-50 dark:text-zinc-100"
            />
          </div>

          {open && candidates.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {candidates.map((c) => {
                const requested = requestedMemberIds.includes(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={requested}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        // 이미 보낸 멤버는 다시 보내지 않는다.
                        if (requested) return;
                        setOpen(false);
                        setQuery("");
                        setCandidates([]);
                        send({ receiverId: c.id }, `@${c.username}`);
                      }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-mono text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-default disabled:hover:bg-transparent dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <span className={requested ? "text-zinc-400 dark:text-zinc-500" : ""}>
                        @{c.username}
                      </span>
                      {requested && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-normal text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          요청됨
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
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
                {requestedGroupIds.includes(g.id) ? " (요청됨)" : ""}
              </option>
            ))}
          </select>
          {/* 이미 보낸 그룹이면 요청 버튼을 비활성화한다(재요청 없음). */}
          <button
            type="button"
            disabled={pending || !groupId || selectedGroupRequested}
            onClick={sendToGroup}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {selectedGroupRequested ? "요청됨" : "요청"}
          </button>
        </div>
      )}

      {done && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{done}</p>}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
