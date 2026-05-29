// 참조: docs/domain/01-project.md (v1.0)
"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { ProjectFormState } from "./actions";

type Project = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
};

type Props = {
  action: (
    prev: ProjectFormState,
    formData: FormData,
  ) => Promise<ProjectFormState>;
  submitLabel: string;
  /** 편집 시 기존 값. 생성 시 undefined. */
  project?: Project;
};

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {pending ? "저장 중…" : label}
    </button>
  );
}

export function ProjectForm({ action, submitLabel, project }: Props) {
  const [state, formAction] = useActionState<ProjectFormState, FormData>(
    action,
    { error: null },
  );
  // 생성 모드에서 slug를 사용자가 직접 건드리기 전까지 name을 따라 자동 제안.
  const [slug, setSlug] = useState(project?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(project));

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      {project && <input type="hidden" name="id" value={project.id} />}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          이름
        </span>
        <input
          name="name"
          type="text"
          required
          defaultValue={project?.name ?? ""}
          onChange={(e) => {
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          슬러그
        </span>
        <input
          name="slug"
          type="text"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="이름에서 자동 생성됩니다"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          설명
        </span>
        <textarea
          name="description"
          rows={3}
          defaultValue={project?.description ?? ""}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>

      {state.error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <SubmitButton label={submitLabel} />
        <Link
          href="/admin/projects"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
