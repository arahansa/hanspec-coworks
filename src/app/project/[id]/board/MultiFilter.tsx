// 보드 상단의 멀티 셀렉트 필터. 모듈·기능·담당자·태그에 공통으로 쓴다.
// 테이블뷰 ModuleFilter의 UI 패턴을 값 타입에 무관하게 일반화한 것.
"use client";

import { useEffect, useRef } from "react";

export type FilterOption<T extends string | number> = {
  value: T;
  label: string;
};

type Props<T extends string | number> = {
  /** 버튼에 표시할 필터 이름. 예: "모듈" */
  title: string;
  options: FilterOption<T>[];
  /** 선택된 값 집합. 비어 있으면 "전체"로 간주해 필터링하지 않는다. */
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
  /** 현재 열려 있는 필터의 title. 한 번에 하나만 열리도록 부모가 관리한다. */
  openFilter: string | null;
  onOpenChange: (next: string | null) => void;
};

export function MultiFilter<T extends string | number>({
  title,
  options,
  selected,
  onChange,
  openFilter,
  onOpenChange,
}: Props<T>) {
  const boxRef = useRef<HTMLDivElement>(null);

  // 열림 여부는 부모가 관리한다(동시에 두 개가 펼쳐져 겹치는 것을 막는다).
  const open = openFilter === title;

  // 바깥 클릭 시 닫기.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        onOpenChange(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, onOpenChange]);

  function toggle(value: T) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  // 선택이 비어 있으면 전체를 뜻한다(별도 "전체 선택" 없이 해제만 제공).
  const count = selected.size;
  const label = count === 0 ? `${title} 전체` : `${title} ${count}`;
  const active = count > 0;

  return (
    <div ref={boxRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => onOpenChange(open ? null : title)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ${
          active
            ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
            : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        }`}
      >
        <span>{label}</span>
        <span className="text-xs text-zinc-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-60 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              {title}
            </span>
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="rounded px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              모두 해제
            </button>
          </div>

          <ul
            className="max-h-72 overflow-auto py-1"
            role="listbox"
            aria-multiselectable
          >
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-400">
                선택지가 없습니다.
              </li>
            ) : (
              options.map((opt) => {
                const checked = selected.has(opt.value);
                return (
                  <li key={String(opt.value)} role="option" aria-selected={checked}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(opt.value)}
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                      />
                      <span className="truncate">{opt.label}</span>
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
