// 참조: docs/domain/10-user-group.md — 프로젝트 멤버 그룹 관리 UI
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createGroup,
  renameGroup,
  deleteGroup,
  assignMember,
  unassignMember,
  joinGroup,
  leaveGroup,
} from "./actions";

export type MemberItem = { id: number; username: string };
export type Participant = { memberId: number; username: string };
export type GroupItem = { id: number; name: string; participants: Participant[] };

type Props = {
  projectId: number;
  groups: GroupItem[];
  /** SUPER일 때만 채워진다. 임의 멤버 배치용 전체 멤버 목록. */
  allMembers: MemberItem[];
  currentMemberId: number;
  isSuper: boolean;
};

type ActionResult = { ok: boolean; error?: string };

export function GroupManager({
  projectId,
  groups,
  allMembers,
  currentMemberId,
  isSuper,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "작업에 실패했습니다.");
        return;
      }
      onOk?.();
      router.refresh();
    });
  }

  function add() {
    if (!newName.trim() || pending) return;
    run(
      () => createGroup(projectId, newName),
      () => setNewName(""),
    );
  }

  return (
    <div className="max-w-2xl">
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {/* 관리자 전용: 그룹 생성 */}
      {isSuper && (
        <div className="mb-6 flex items-center gap-2">
          <input
            value={newName}
            disabled={pending}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="새 그룹 이름"
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            disabled={pending || !newName.trim()}
            onClick={add}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            그룹 추가
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
          {isSuper
            ? "아직 그룹이 없습니다. 위에서 그룹을 추가해 보세요."
            : "참여할 수 있는 그룹이 없습니다."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              allMembers={allMembers}
              currentMemberId={currentMemberId}
              isSuper={isSuper}
              pending={pending}
              run={run}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupCard({
  group,
  allMembers,
  currentMemberId,
  isSuper,
  pending,
  run,
}: {
  group: GroupItem;
  allMembers: MemberItem[];
  currentMemberId: number;
  isSuper: boolean;
  pending: boolean;
  run: (action: () => Promise<ActionResult>, onOk?: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [assignId, setAssignId] = useState("");

  const joined = group.participants.some((p) => p.memberId === currentMemberId);
  const participantIds = new Set(group.participants.map((p) => p.memberId));
  // 아직 그룹에 없는 멤버만 배치 드롭다운에 노출한다.
  const assignable = allMembers.filter((m) => !participantIds.has(m.id));

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === group.name) {
      setEditing(false);
      setName(group.name);
      return;
    }
    run(
      () => renameGroup(group.id, trimmed),
      () => setEditing(false),
    );
  }

  function assign() {
    const memberId = Number(assignId);
    if (!Number.isInteger(memberId) || pending) return;
    run(
      () => assignMember(group.id, memberId),
      () => setAssignId(""),
    );
  }

  return (
    <li className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <input
            value={name}
            autoFocus
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                setEditing(false);
                setName(group.name);
              }
            }}
            onBlur={saveName}
            className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-medium text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        ) : (
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {group.name}
            <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
              {group.participants.length}명
            </span>
          </h3>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {/* 일반/관리자 공통: 본인 참여·해제 */}
          {joined ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => leaveGroup(group.id))}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              나가기
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => joinGroup(group.id))}
              className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              참여
            </button>
          )}

          {/* 관리자 전용: 그룹명 수정·삭제 */}
          {isSuper && !editing && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditing(true)}
              className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-40 dark:text-blue-400 dark:hover:bg-blue-950/40"
            >
              이름 수정
            </button>
          )}
          {isSuper && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteGroup(group.id))}
              aria-label={`${group.name} 그룹 삭제`}
              className="rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {/* 참여자 목록 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {group.participants.length === 0 ? (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            참여자가 없습니다.
          </span>
        ) : (
          group.participants.map((p) => (
            <span
              key={p.memberId}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {p.username}
              {p.memberId === currentMemberId && (
                <span className="text-zinc-400 dark:text-zinc-500">(나)</span>
              )}
              {isSuper && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => unassignMember(group.id, p.memberId))}
                  aria-label={`${p.username} 배치 해제`}
                  className="text-zinc-400 transition hover:text-red-600 disabled:opacity-40 dark:hover:text-red-400"
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {/* 관리자 전용: 임의 멤버 배치 */}
      {isSuper && assignable.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={assignId}
            disabled={pending}
            onChange={(e) => setAssignId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">멤버 선택…</option>
            {assignable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.username}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !assignId}
            onClick={assign}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            배치
          </button>
        </div>
      )}
    </li>
  );
}
