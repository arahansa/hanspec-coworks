// 참조: docs/superpowers/specs/2026-06-22-slides-design.md
// 슬라이드 본문(md) 편집 + wiremd 미리보기 + 새 버전 생성 + 코멘트 관리.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlideFrame } from "../SlideFrame";
import {
  updateSlideContent,
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
  initialContent: string;
  comments: CommentItem[];
};

export function SlideEditor({
  projectId,
  slideId,
  pageId,
  version,
  initialContent,
  comments,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [content, setContent] = useState(initialContent);
  // 미리보기 HTML(완전한 문서). null이면 미리보기 영역 숨김.
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // 코멘트 입력 폼.
  const [commentNum, setCommentNum] = useState("");
  const [commentText, setCommentText] = useState("");

  const dirty = content !== initialContent;

  function run(action: () => Promise<SlideActionResult>, after?: () => void) {
    setError(null);
    setNotice(null);
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

  async function preview() {
    setError(null);
    setPreviewing(true);
    try {
      const res = await fetch("/api/slides/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data: { ok: boolean; html?: string; error?: string } = await res.json();
      if (!data.ok || data.html === undefined) {
        setError(data.error ?? "미리보기를 불러오지 못했습니다.");
        return;
      }
      setPreviewHtml(data.html);
    } catch {
      setError("미리보기를 불러오지 못했습니다.");
    } finally {
      setPreviewing(false);
    }
  }

  function startEditComment(c: CommentItem) {
    setCommentNum(String(c.commentNum));
    setCommentText(c.comment);
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        편집 <span className="font-mono text-sm text-zinc-400">v{version}</span>
      </h2>

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>
      )}

      {/* 본문 에디터 + 미리보기 */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            본문 (wiremd / markdown)
          </label>
          <textarea
            value={content}
            disabled={pending}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            spellCheck={false}
            placeholder={"# 제목\n\n[[ 로고 | 메뉴 | 도움말 ]]\n\n[이메일________]\n[로그인]  (1)"}
            className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || !dirty}
              onClick={() =>
                run(() => updateSlideContent(slideId, content), () =>
                  setNotice("저장했습니다."),
                )
              }
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              저장
            </button>
            <button
              type="button"
              disabled={previewing}
              onClick={preview}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {previewing ? "렌더링 중…" : "미리보기"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (
                  confirm(
                    "현재 내용을 복사해 새 버전을 만들까요? (코멘트는 복사되지 않습니다)",
                  )
                ) {
                  run(() => createSlideVersion(pageId), () =>
                    router.push(`/project/${projectId}/slides/${pageId}`),
                  );
                }
              }}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              새 버전 만들기
            </button>
            {dirty && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                저장되지 않은 변경
              </span>
            )}
          </div>
        </div>

        {previewHtml !== null && (
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              미리보기
            </label>
            <SlideFrame html={previewHtml} className="h-[24rem] w-full rounded-lg border border-zinc-200 bg-white dark:border-zinc-800" />
          </div>
        )}
      </div>

      {/* 코멘트 관리 */}
      <div className="mt-8">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          코멘트 (본문의 (n) 마커 설명)
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
          className="flex flex-wrap items-start gap-2"
        >
          <input
            type="number"
            min={1}
            value={commentNum}
            disabled={pending}
            onChange={(e) => setCommentNum(e.target.value)}
            placeholder="(n)"
            className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            value={commentText}
            disabled={pending}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="이 번호에 대한 설명"
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={pending || !commentNum || !commentText.trim()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            저장
          </button>
        </form>
      </div>
    </section>
  );
}
