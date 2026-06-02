// 참조: docs/domain/09-feature.md — FEATURE 태그 입력
// @로 태그를 하나씩 입력한다. 없는 태그는 신규로 추가되고,
// 있는 태그는 프로젝트 기존 태그 펼침목록에서 선택해 입력한다.
"use client";

import { useEffect, useRef, useState } from "react";
import { listProjectTags } from "./actions";

type Props = {
  projectId: number;
  value: string[];
  pending: boolean;
  /** 태그 목록이 변경되면 서버에 동기화한다. */
  onChange: (tags: string[]) => void;
};

/** 입력값에서 선행 @와 앞뒤 공백을 제거한다. */
function normalize(raw: string): string {
  return raw.trim().replace(/^@+/, "").trim();
}

export function TagInput({ projectId, value, pending, onChange }: Props) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [projectTags, setProjectTags] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  // 프로젝트 기존 태그(자동완성 소스)를 한 번 불러온다.
  useEffect(() => {
    let alive = true;
    listProjectTags(projectId).then((res) => {
      if (alive && res.ok) setProjectTags(res.tags);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // 바깥 클릭 시 펼침목록 닫기.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const query = normalize(input).toLowerCase();
  // 이미 부여된 태그는 제외하고, 입력값으로 필터링한 후보.
  const suggestions = projectTags.filter(
    (t) =>
      !value.some((v) => v.toLowerCase() === t.toLowerCase()) &&
      (query === "" || t.toLowerCase().includes(query)),
  );
  // 입력값과 정확히 같은 후보가 없으면 "신규 추가" 후보를 노출.
  const normalizedInput = normalize(input);
  const exactExists =
    normalizedInput !== "" &&
    [...projectTags, ...value].some(
      (t) => t.toLowerCase() === normalizedInput.toLowerCase(),
    );

  function addTag(name: string) {
    const tag = normalize(name);
    if (!tag) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      setInput("");
      return;
    }
    onChange([...value, tag]);
    // 새로 만든 태그도 다음 자동완성에 보이도록 즉시 반영.
    setProjectTags((prev) =>
      prev.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? prev
        : [...prev, tag].sort((a, b) => a.localeCompare(b)),
    );
    setInput("");
    setOpen(false);
  }

  function removeTag(name: string) {
    onChange(value.filter((v) => v !== name));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Enter 또는 @로 현재 입력을 확정한다.
    if (e.key === "Enter") {
      e.preventDefault();
      if (normalizedInput) addTag(normalizedInput);
    } else if (e.key === "@" && normalizedInput) {
      // "@태그@" 식으로 연속 입력 시 @를 구분자로 확정.
      e.preventDefault();
      addTag(normalizedInput);
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      // 빈 입력에서 Backspace → 마지막 태그 제거.
      removeTag(value[value.length - 1]);
    }
  }

  return (
    <div ref={boxRef} className="relative mt-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
          >
            @{tag}
            <button
              type="button"
              disabled={pending}
              onClick={() => removeTag(tag)}
              aria-label={`${tag} 태그 제거`}
              className="text-blue-400 transition hover:text-blue-700 disabled:opacity-50 dark:hover:text-blue-200"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          disabled={pending}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? "@태그 입력" : ""}
          className="min-w-[6rem] flex-1 bg-transparent text-sm text-zinc-900 outline-none disabled:opacity-50 dark:text-zinc-100"
        />
      </div>

      {open && (suggestions.length > 0 || (normalizedInput && !exactExists)) && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {normalizedInput && !exactExists && (
            <li>
              <button
                type="button"
                onClick={() => addTag(normalizedInput)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="text-zinc-400">신규</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  @{normalizedInput}
                </span>
              </button>
            </li>
          )}
          {suggestions.map((t) => (
            <li key={t}>
              <button
                type="button"
                onClick={() => addTag(t)}
                className="block w-full px-3 py-1.5 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                @{t}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
