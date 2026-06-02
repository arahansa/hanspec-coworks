// 참조: docs/domain/07-environment.md — 프로젝트별 환경변수 편집기
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
} from "./actions";

export type EnvItem = { id: number; name: string; value: string };

type Props = { projectId: number; items: EnvItem[] };
type ActionResult = { ok: boolean; error?: string };

export function EnvironmentEditor({ projectId, items }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 신규 추가 폼 입력값.
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");

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
      () => createEnvironment(projectId, newName, newValue),
      () => {
        setNewName("");
        setNewValue("");
      },
    );
  }

  const inputCls =
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

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

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            <th className="pb-2" style={{ width: "35%" }}>
              필드명
            </th>
            <th className="pb-2" style={{ width: "50%" }}>
              변수값
            </th>
            <th className="pb-2" style={{ width: "15%" }} />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <EnvRow
              key={item.id}
              item={item}
              pending={pending}
              inputCls={inputCls}
              onSave={(name, value) =>
                run(() => updateEnvironment(item.id, name, value))
              }
              onDelete={() => run(() => deleteEnvironment(item.id))}
            />
          ))}

          {items.length === 0 && (
            <tr>
              <td
                colSpan={3}
                className="py-3 text-sm text-zinc-400 dark:text-zinc-500"
              >
                등록된 환경변수가 없습니다.
              </td>
            </tr>
          )}

          {/* 신규 추가 행 */}
          <tr>
            <td className="py-1 pr-2">
              <input
                value={newName}
                disabled={pending}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="예: SERVER_REPO_PATH"
                className={`w-full font-mono ${inputCls}`}
              />
            </td>
            <td className="py-1 pr-2">
              <input
                value={newValue}
                disabled={pending}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="예: /Users/me/code/server"
                className={`w-full ${inputCls}`}
              />
            </td>
            <td className="py-1">
              <button
                type="button"
                disabled={pending || !newName.trim()}
                onClick={add}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                추가
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
        저장소 위치 등을 기록합니다. 노드 설명에서 <code>{"{{필드명}}"}</code>으로
        참조할 수 있습니다(치환은 차후 과제). <code>.env</code>에서 같은 이름으로
        오버라이딩할 수 있습니다.
      </p>
    </div>
  );
}

// 기존 환경변수 한 행. 인라인 편집 후 변경 시에만 저장 버튼 활성.
function EnvRow({
  item,
  pending,
  inputCls,
  onSave,
  onDelete,
}: {
  item: EnvItem;
  pending: boolean;
  inputCls: string;
  onSave: (name: string, value: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [value, setValue] = useState(item.value);
  const dirty = name.trim() !== item.name || value !== item.value;

  return (
    <tr>
      <td className="py-1 pr-2">
        <input
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          className={`w-full font-mono ${inputCls}`}
        />
      </td>
      <td className="py-1 pr-2">
        <input
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          className={`w-full ${inputCls}`}
        />
      </td>
      <td className="py-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={() => onSave(name, value)}
            className="rounded-md px-2 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-40 dark:text-blue-400 dark:hover:bg-blue-950/40"
          >
            저장
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            aria-label={`${item.name} 삭제`}
            className="rounded-md px-2 py-1.5 text-xs text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            삭제
          </button>
        </div>
      </td>
    </tr>
  );
}
