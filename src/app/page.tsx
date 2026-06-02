import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type DbStatus =
  | { ok: true; dbTime: Date }
  | { ok: false; error: string };

// DATABASE_URL에서 비밀번호 등 민감 정보를 가리고 host/port/db만 노출한다.
function describeDbUrl(raw: string | undefined): string {
  if (!raw) return "(설정되지 않음)";
  try {
    const url = new URL(raw);
    const user = url.username ? `${url.username}:***@` : "";
    const port = url.port ? `:${url.port}` : "";
    const db = url.pathname.replace(/^\//, "") || "(default)";
    return `${url.protocol}//${user}${url.hostname}${port}/${db}`;
  } catch {
    // URL 파싱 실패 시 비밀번호 패턴만 마스킹
    return raw.replace(/(:)([^:@/]+)(@)/, "$1***$3");
  }
}

async function checkDb(): Promise<DbStatus> {
  try {
    const rows = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`;
    return { ok: true, dbTime: rows[0].now };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function Home() {
  const status = await checkDb();
  const dbUrl = describeDbUrl(process.env.DATABASE_URL);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <main className="w-full max-w-xl rounded-2xl border border-black/[.08] bg-white p-10 shadow-sm dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          coworks
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          HanSpec 협업 워크스페이스
        </p>

        <div className="mt-8 rounded-xl bg-zinc-50 p-5 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                status.ok ? "bg-emerald-500" : "bg-red-500"
              }`}
              aria-hidden
            />
            <span className="text-sm font-medium text-black dark:text-zinc-50">
              데이터베이스 연결
            </span>
          </div>

          {status.ok ? (
            <dl className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between gap-4">
                <dt>상태</dt>
                <dd className="font-medium text-emerald-600 dark:text-emerald-400">
                  연결됨
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>DB 시간</dt>
                <dd className="font-mono text-xs">
                  {status.dbTime.toISOString()}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0">DB URL</dt>
                <dd className="break-all text-right font-mono text-xs">
                  {dbUrl}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="mt-3 text-sm">
              <p className="font-medium text-red-600 dark:text-red-400">
                연결 실패
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {status.error}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
