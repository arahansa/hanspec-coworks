// Task의 Endpoint(경로) 입력. `{{` 입력 시 프로젝트 환경변수 자동완성. (06-task.md)
"use client";

import { useRef, useState } from "react";

type Props = {
  value: string;
  disabled?: boolean;
  envNames: string[];
  placeholder?: string;
  className?: string;
  onChange: (next: string) => void;
};

// 커서 직전의 열린 `{{...` 토큰을 찾는다. 닫힌 `}}`가 이미 있으면 자동완성하지 않는다.
function openBraceQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const idx = before.lastIndexOf("{{");
  if (idx < 0) return null;
  const between = before.slice(idx + 2);
  // `{{` 이후에 `}` 가 있으면 이미 닫힌 토큰으로 보고 자동완성 중단.
  if (between.includes("}")) return null;
  return { start: idx, query: between };
}

export function EndpointInput({
  value,
  disabled,
  envNames,
  placeholder,
  className,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    onChange(next);
    const caret = e.target.selectionStart ?? next.length;
    const token = openBraceQuery(next, caret);
    if (token) {
      setQuery(token.query.toLowerCase());
      setOpen(true);
    } else {
      setOpen(false);
      setQuery(null);
    }
  }

  function pick(name: string) {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? value.length;
    const token = openBraceQuery(value, caret);
    if (!token) return;
    // `{{query` 부분을 `{{NAME}}`로 치환한다.
    const before = value.slice(0, token.start);
    const after = value.slice(caret);
    const inserted = `{{${name}}}`;
    const next = before + inserted + after;
    onChange(next);
    setOpen(false);
    setQuery(null);
    // 삽입 후 커서를 `}}` 뒤로 이동.
    requestAnimationFrame(() => {
      const pos = (before + inserted).length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  const suggestions =
    query === null
      ? []
      : envNames.filter((n) => n.toLowerCase().includes(query));

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {suggestions.map((n) => (
            <li key={n}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(n);
                }}
                className="block w-full px-3 py-1.5 text-left font-mono text-xs text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {"{{"}{n}{"}}"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
