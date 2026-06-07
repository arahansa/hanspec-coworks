// 참조: docs/superpowers/specs/2026-06-08-completed-tasks-page-design.md (v1.1)
// 완료된 작업 목록 페이지 상단의 검색영역.
// <form method="get">로 URL 쿼리를 갱신 → 서버 컴포넌트가 재조회한다(server action 불필요).
"use client";

import { useState } from "react";

type Props = {
  /** 페이지 진입 시점의 필터 상태(현재 searchParams 반영). */
  initial: { today: boolean; from: string; to: string };
};

export function CompletedSearchForm({ initial }: Props) {
  const [today, setToday] = useState(initial.today);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [error, setError] = useState<string | null>(null);

  // from > to 면 제출을 막는다(기간 모드에서만 검증).
  const rangeInvalid = !today && from !== "" && to !== "" && from > to;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (rangeInvalid) {
      e.preventDefault();
      setError("시작일이 종료일보다 늦을 수 없습니다.");
    }
  }

  return (
    <form
      method="get"
      onSubmit={onSubmit}
      className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      {/* 체크박스 ON이면 today=1만 전송, OFF면 today를 빼고 from/to만 전송한다. */}
      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        <input
          type="checkbox"
          name="today"
          value="1"
          checked={today}
          onChange={(e) => {
            setToday(e.target.checked);
            setError(null);
          }}
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
        />
        오늘 완료된 작업 보기
      </label>

      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          시작일
          <input
            type="date"
            name="from"
            value={from}
            disabled={today}
            onChange={(e) => {
              setFrom(e.target.value);
              setError(null);
            }}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 transition disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          />
        </label>
        <span className="pb-2 text-zinc-400">~</span>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          종료일
          <input
            type="date"
            name="to"
            value={to}
            disabled={today}
            onChange={(e) => {
              setTo(e.target.value);
              setError(null);
            }}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 transition disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={rangeInvalid}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        검색
      </button>

      {error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}
