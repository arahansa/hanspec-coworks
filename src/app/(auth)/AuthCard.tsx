// 참조: docs/domain/02-member.md (v1.0) — 인증 화면 공용 카드 레이아웃
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <main className="w-full max-w-sm rounded-2xl border border-black/[.08] bg-white p-8 shadow-sm dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
          {title}
        </h1>
        {description && (
          <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
        <div className={description ? "" : "mt-6"}>{children}</div>
      </main>
    </div>
  );
}
