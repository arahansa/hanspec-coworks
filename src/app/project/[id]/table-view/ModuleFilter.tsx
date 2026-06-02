// 테이블뷰 상단의 모듈 필터(멀티 셀렉트).
// 전체 선택 시 모든 모듈, 일부만 선택하면 해당 모듈만 표에 보인다.
"use client";

import { useEffect, useRef, useState } from "react";

export type ModuleOption = { id: number; name: string };

type Props = {
  modules: ModuleOption[];
  /** 선택된 모듈 id 집합. */
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
};

export function ModuleFilter({ modules, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const total = modules.length;
  const count = selected.size;
  const allSelected = count === total && total > 0;

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(modules.map((m) => m.id)));
  }

  function clearAll() {
    onChange(new Set());
  }

  const label = allSelected
    ? "전체 모듈"
    : count === 0
      ? "선택된 모듈 없음"
      : `${count}개 모듈 선택됨`;

  return (
    <div ref={boxRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-w-[12rem] items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 transition hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <span>{label}</span>
        <span className="text-zinc-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <button
              type="button"
              onClick={selectAll}
              className="rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              모두 해제
            </button>
          </div>

          <ul className="max-h-72 overflow-auto py-1" role="listbox" aria-multiselectable>
            {modules.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-400">모듈이 없습니다.</li>
            ) : (
              modules.map((m) => {
                const checked = selected.has(m.id);
                return (
                  <li key={m.id} role="option" aria-selected={checked}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(m.id)}
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                      />
                      <span className="truncate">{m.name}</span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
