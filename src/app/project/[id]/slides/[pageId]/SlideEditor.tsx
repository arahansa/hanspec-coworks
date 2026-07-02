// 참조: docs/superpowers/specs/2026-07-02-slides-canvas-excalidraw-design.md
// 단일 Excalidraw 캔버스(편집) + 디바운스 자동저장 + 우측 코멘트 패널/관리 + 새 버전.
"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExcalidrawCanvas, type SceneDocument } from "@/components/ExcalidrawCanvas";
import {
  updateSlideDocument,
  createSlideVersion,
  upsertSlideComment,
  deleteSlideComment,
  type SlideActionResult,
} from "../actions";

export type CommentItem = { id: number; commentNum: number; comment: string };

type Props = {
  projectId: number;
  slideId: number;
  pageId: number;
  version: number;
  initialDocument: SceneDocument | null;
  comments: CommentItem[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function SlideEditor({
  projectId,
  slideId,
  pageId,
  version,
  initialDocument,
  comments,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // 코멘트 입력 폼.
  const [commentNum, setCommentNum] = useState("");
  const [commentText, setCommentText] = useState("");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDoc = useRef<SceneDocument | null>(null);

  // 캔버스 변경 → 800ms 디바운스 후 저장. onChange가 초기 마운트에도 불릴 수 있어
  // 실제 저장은 사용자 상호작용 이후에만 의미 있도록 latestDoc에 담아두고 타이머로 커밋.
  const handleChange = useCallback(
    (doc: SceneDocument) => {
      latestDoc.current = doc;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const toSave = latestDoc.current;
        if (!toSave) return;
        setSaveState("saving");
        setError(null);
        void updateSlideDocument(slideId, toSave).then((res: SlideActionResult) => {
          if (res.ok) {
            setSaveState("saved");
          } else {
            setSaveState("error");
            setError(res.error);
          }
        });
      }, 800);
    },
    [slideId],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function run(action: () => Promise<SlideActionResult>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function startEditComment(c: CommentItem) {
    setCommentNum(String(c.commentNum));
    setCommentText(c.comment);
  }

  const saveLabel =
    saveState === "saving"
      ? "저장 중…"
      : saveState === "saved"
        ? "저장됨"
        : saveState === "error"
          ? "저장 실패"
          : "";

  return (
    <section>
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          편집 <span className="font-mono text-sm text-zinc-400">v{version}</span>
        </h2>
        {saveLabel && (
          <span
            className={`text-xs ${
              saveState === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {saveLabel}
          </span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              confirm(
                "현재 캔버스를 복사해 새 버전을 만들까요? (코멘트는 복사되지 않습니다)",
              )
            ) {
              run(() => createSlideVersion(pageId), () =>
                router.push(`/project/${projectId}/slides/${pageId}`),
              );
            }
          }}
          className="ml-auto rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          새 버전 만들기
        </button>
      </div>

      {/* 캔버스 + 우측 코멘트 */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <ExcalidrawCanvas initialDocument={initialDocument} onChange={handleChange} />
        </div>

        <aside className="w-full shrink-0 lg:w-72">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            코멘트 (캔버스의 (n) 마커 설명)
          </h3>

          {comments.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <span className="shrink-0 font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                    ({c.commentNum})
                  </span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                    {c.comment}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startEditComment(c)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteSlideComment(c.id))}
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const num = Number(commentNum);
              if (!Number.isInteger(num) || num < 1 || !commentText.trim()) return;
              run(() => upsertSlideComment(slideId, num, commentText), () => {
                setCommentNum("");
                setCommentText("");
              });
            }}
            className="flex flex-col gap-2"
          >
            <input
              type="number"
              min={1}
              value={commentNum}
              disabled={pending}
              onChange={(e) => setCommentNum(e.target.value)}
              placeholder="(n)"
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={commentText}
              disabled={pending}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="이 번호에 대한 설명"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={pending || !commentNum || !commentText.trim()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              코멘트 저장
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}
