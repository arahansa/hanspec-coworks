// 참조: docs/superpowers/specs/2026-06-01-requirement-detail-task-design.md (v1.0),
//       docs/domain/06-task.md — Task name·endpoint 추가 + 편집
// 요구사항 상세 페이지의 Task 목록 + 생성/편집 폼.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTask, updateTask } from "./actions";
import { EndpointInput } from "./EndpointInput";

export type TaskItem = {
  id: number;
  description: string;
  progress: number;
  name: string | null;
  endpoint: string | null;
  createdAt: string; // ISO 문자열
};

type Props = {
  nodeId: number;
  tasks: TaskItem[];
  /** endpoint {{}} 자동완성용 환경변수 이름. */
  envNames: string[];
};

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function TaskSection({ nodeId, tasks, envNames }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 신규 생성 폼.
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState(0);
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createTask(nodeId, { description, progress, name, endpoint });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDescription("");
      setProgress(0);
      setName("");
      setEndpoint("");
      router.refresh();
    });
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Task <span className="text-sm font-normal text-zinc-400">({tasks.length})</span>
      </h2>

      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-400 dark:border-zinc-700">
          아직 등록된 Task가 없습니다. 아래에서 추가하세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              pending={pending}
              envNames={envNames}
              onSave={(fields) =>
                startTransition(async () => {
                  setError(null);
                  const result = await updateTask(t.id, fields);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  router.refresh();
                })
              }
            />
          ))}
        </ul>
      )}

      <div className="mt-5 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">새 Task 추가</h3>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">이름 (컴포넌트 이름 등)</span>
            <input
              value={name}
              maxLength={50}
              disabled={pending}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: TaskSection"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">
              Endpoint / 경로 <span className="text-zinc-400">({"{{"}로 환경변수 자동완성)</span>
            </span>
            <EndpointInput
              value={endpoint}
              disabled={pending}
              envNames={envNames}
              placeholder="예: {{SERVER_REPO_PATH}}/src/...  또는  GET /api/..."
              className={`w-full font-mono text-xs ${inputCls}`}
              onChange={setEndpoint}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">작업 설명</span>
            <textarea
              value={description}
              rows={3}
              disabled={pending}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="작업 내용을 입력하세요."
              className={inputCls}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">진행도(%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={progress}
              disabled={pending}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
        </div>

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="button"
          disabled={pending || !description.trim()}
          onClick={submit}
          className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "추가 중…" : "Task 추가"}
        </button>
      </div>
    </section>
  );
}

// 기존 Task 한 항목. 보기 모드 ↔ 인라인 편집 모드 전환.
function TaskRow({
  task,
  pending,
  envNames,
  onSave,
}: {
  task: TaskItem;
  pending: boolean;
  envNames: string[];
  onSave: (fields: {
    description: string;
    progress: number;
    name: string;
    endpoint: string;
  }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(task.description);
  const [progress, setProgress] = useState(task.progress);
  const [name, setName] = useState(task.name ?? "");
  const [endpoint, setEndpoint] = useState(task.endpoint ?? "");

  function cancel() {
    setDescription(task.description);
    setProgress(task.progress);
    setName(task.name ?? "");
    setEndpoint(task.endpoint ?? "");
    setEditing(false);
  }

  function save() {
    onSave({ description, progress, name, endpoint });
    setEditing(false);
  }

  if (!editing) {
    return (
      <li className="flex items-start justify-between gap-4 rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="min-w-0">
          {task.name && (
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{task.name}</p>
          )}
          {task.endpoint && (
            <p className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              {task.endpoint}
            </p>
          )}
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-200">
            {task.description}
          </p>
          <p className="mt-1 font-mono text-[11px] text-zinc-400">
            #{task.id} · {task.createdAt.slice(0, 10)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {task.progress}%
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditing(true)}
            className="rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
          >
            편집
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-blue-300 px-4 py-3 dark:border-blue-800">
      <div className="flex flex-col gap-2">
        <input
          value={name}
          maxLength={50}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름 (컴포넌트 이름 등)"
          className={inputCls}
        />
        <EndpointInput
          value={endpoint}
          disabled={pending}
          envNames={envNames}
          placeholder="Endpoint / 경로 ({{로 환경변수 자동완성)"
          className={`w-full font-mono text-xs ${inputCls}`}
          onChange={setEndpoint}
        />
        <textarea
          value={description}
          rows={3}
          disabled={pending}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="작업 내용"
          className={inputCls}
        />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">진행도(%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={progress}
            disabled={pending}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={pending || !description.trim()}
          onClick={save}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={cancel}
          className="rounded-md px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          취소
        </button>
      </div>
    </li>
  );
}
