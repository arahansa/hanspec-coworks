// 참조: docs/domain/03-node.md (v1.5) — 노드 설명(description) 마크다운 편집/보기
// 보기(렌더링) 기본, "편집" 버튼으로 textarea 전환. 저장 시 다시 보기로 돌아간다.
// 저장 동작은 호출처마다 다르므로(서버 액션 직접 호출 vs 부모 콜백) onSave로 주입받는다.
"use client";

import { useEffect, useState } from "react";
import { MarkdownView } from "./MarkdownView";

type Props = {
  /** 현재 저장된 설명(마크다운 원본). null/빈 문자열이면 미입력. */
  value: string | null;
  /** 저장 중 여부(외부 transition 상태). */
  pending?: boolean;
  /** 저장 콜백. 변경된 draft를 넘긴다. */
  onSave: (draft: string) => void;
  /** 입력 영역 placeholder */
  placeholder?: string;
  /** textarea 행 수 */
  rows?: number;
  /** 에러 메시지(저장 실패 시) */
  error?: string | null;
};

export function DescriptionEditor({
  value,
  pending = false,
  onSave,
  placeholder = "마크다운으로 설명을 입력하세요. (코드블록 ```, 굵게 **, 리스트 - 지원)",
  rows = 6,
  error = null,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  // 외부에서 value가 갱신되면(저장 후 refresh 등) draft를 동기화한다.
  // 단, 편집 중에는 사용자의 입력을 덮어쓰지 않는다.
  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  const trimmed = (value ?? "").trim();
  const dirty = draft.trim() !== trimmed;

  function startEdit() {
    setDraft(value ?? "");
    setEditing(true);
  }

  function cancel() {
    setDraft(value ?? "");
    setEditing(false);
  }

  function save() {
    if (!dirty || pending) {
      setEditing(false);
      return;
    }
    onSave(draft);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-start justify-between gap-2">
          {trimmed ? (
            <MarkdownView source={value ?? ""} className="min-w-0 flex-1" />
          ) : (
            <p className="flex-1 text-sm text-zinc-400 dark:text-zinc-500">
              설명이 없습니다.
            </p>
          )}
          <button
            type="button"
            onClick={startEdit}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            편집
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={draft}
        rows={rows}
        disabled={pending}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        마크다운 지원: <code>**굵게**</code>, <code>- 리스트</code>,{" "}
        <code>```언어 코드블록```</code>, 표 등.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "저장 중…" : "설명 저장"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={cancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          취소
        </button>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
