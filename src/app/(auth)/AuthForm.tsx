// 참조: docs/domain/02-member.md (v1.0) — 가입/로그인 공용 폼
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { AuthState } from "./actions";

type Props = {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  submitLabel: string;
  /** 자동로그인 체크박스 노출 여부 (가입 화면에서만 사용) */
  showRemember?: boolean;
  /** 하단 보조 링크 */
  footer: { text: string; linkLabel: string; href: string };
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {pending ? "처리 중…" : label}
    </button>
  );
}

export function AuthForm({
  action,
  submitLabel,
  showRemember = false,
  footer,
}: Props) {
  const [state, formAction] = useActionState<AuthState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          이름
        </span>
        <input
          name="username"
          type="text"
          required
          maxLength={20}
          autoComplete="username"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          비밀번호
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete={showRemember ? "new-password" : "current-password"}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>

      {showRemember && (
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            name="remember"
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          <span>자동 로그인</span>
        </label>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <SubmitButton label={submitLabel} />

      <p className="mt-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {footer.text}{" "}
        <Link
          href={footer.href}
          className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          {footer.linkLabel}
        </Link>
      </p>
    </form>
  );
}
