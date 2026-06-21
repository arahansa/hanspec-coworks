// 참조: docs/superpowers/specs/2026-06-22-slides-design.md
// 슬라이드 기획서 인덱스의 인라인 관리 UI. 페이지/섹션 CRUD + 섹션 배치.
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createSlidePage,
  renameSlidePage,
  deleteSlidePage,
  createSlideSection,
  renameSlideSection,
  deleteSlideSection,
  assignPageToSection,
  removePageFromSection,
  type SlideActionResult,
} from "./actions";

export type SectionSummary = { id: number; name: string };
export type PageSummary = {
  id: number;
  title: string;
  latestVersion: number;
  versionCount: number;
  sectionIds: number[];
};

type Props = {
  projectId: number;
  sections: SectionSummary[];
  pages: PageSummary[];
};

export function SlidesManager({ projectId, sections, pages }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [newPageTitle, setNewPageTitle] = useState("");
  const [newSectionName, setNewSectionName] = useState("");

  // 인라인 이름변경 대상.
  const [editing, setEditing] = useState<
    { kind: "page" | "section"; id: number } | null
  >(null);
  const [editValue, setEditValue] = useState("");

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

  function startEdit(kind: "page" | "section", id: number, current: string) {
    setEditing({ kind, id });
    setEditValue(current);
  }

  function commitEdit() {
    if (!editing) return;
    const value = editValue;
    const target = editing;
    run(
      () =>
        target.kind === "page"
          ? renameSlidePage(target.id, value)
          : renameSlideSection(target.id, value),
      () => setEditing(null),
    );
  }

  const ungrouped = pages.filter((p) => p.sectionIds.length === 0);
  const pagesInSection = (sectionId: number) =>
    pages.filter((p) => p.sectionIds.includes(sectionId));

  function PageRow({ page, inSectionId }: { page: PageSummary; inSectionId?: number }) {
    const isEditing = editing?.kind === "page" && editing.id === page.id;
    return (
      <li className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            disabled={pending}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(null);
            }}
            onBlur={commitEdit}
            className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        ) : (
          <Link
            href={`/project/${projectId}/slides/${page.id}`}
            className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            {page.title}
          </Link>
        )}

        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          v{page.latestVersion}
          {page.versionCount > 1 ? ` · ${page.versionCount}개` : ""}
        </span>

        {/* 섹션 배치(미분류 행) 또는 제거(섹션 내 행) */}
        {inSectionId === undefined ? (
          sections.length > 0 && (
            <select
              value=""
              disabled={pending}
              onChange={(e) => {
                const sectionId = Number(e.target.value);
                if (Number.isInteger(sectionId)) {
                  run(() => assignPageToSection(sectionId, page.id));
                }
              }}
              className="shrink-0 rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <option value="">섹션에 추가…</option>
              {sections
                .filter((s) => !page.sectionIds.includes(s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          )
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => removePageFromSection(inSectionId, page.id))}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            제거
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => startEdit("page", page.id, page.title)}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          이름변경
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`'${page.title}' 페이지를 삭제할까요? (모든 버전·코멘트 삭제)`)) {
              run(() => deleteSlidePage(page.id));
            }
          }}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          삭제
        </button>
      </li>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* 생성 폼 */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newPageTitle.trim()) return;
            run(() => createSlidePage(projectId, newPageTitle), () => setNewPageTitle(""));
          }}
          className="flex flex-1 gap-2"
        >
          <input
            value={newPageTitle}
            disabled={pending}
            onChange={(e) => setNewPageTitle(e.target.value)}
            placeholder="새 페이지 제목"
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={pending || !newPageTitle.trim()}
            className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            + 페이지
          </button>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newSectionName.trim()) return;
            run(
              () => createSlideSection(projectId, newSectionName),
              () => setNewSectionName(""),
            );
          }}
          className="flex flex-1 gap-2"
        >
          <input
            value={newSectionName}
            disabled={pending}
            onChange={(e) => setNewSectionName(e.target.value)}
            placeholder="새 섹션 이름"
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={pending || !newSectionName.trim()}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            + 섹션
          </button>
        </form>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {pages.length === 0 && sections.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          아직 페이지가 없습니다. “+ 페이지”로 시작하세요.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* 섹션별 */}
          {sections.map((section) => {
            const sectionPages = pagesInSection(section.id);
            const isEditing =
              editing?.kind === "section" && editing.id === section.id;
            return (
              <section key={section.id}>
                <div className="mb-2 flex items-center gap-2">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editValue}
                      disabled={pending}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditing(null);
                      }}
                      onBlur={commitEdit}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  ) : (
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {section.name}
                    </h2>
                  )}
                  <span className="text-xs text-zinc-400">
                    {sectionPages.length}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startEdit("section", section.id, section.name)}
                    className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    이름변경
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`'${section.name}' 섹션을 삭제할까요? (페이지는 유지됩니다)`)) {
                        run(() => deleteSlideSection(section.id));
                      }
                    }}
                    className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    삭제
                  </button>
                </div>
                {sectionPages.length === 0 ? (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    이 섹션에 페이지가 없습니다.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {sectionPages.map((p) => (
                      <PageRow key={p.id} page={p} inSectionId={section.id} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {/* 미분류 */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              미분류 페이지
            </h2>
            {ungrouped.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">없음</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {ungrouped.map((p) => (
                  <PageRow key={p.id} page={p} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
