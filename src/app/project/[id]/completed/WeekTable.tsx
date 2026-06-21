// 참조: 요구사항 #201 "오늘 완료된 작업, 주간보기 라디오형태로 표현"
// 주간보기 — 이번 주(월~일)에 완료된 요구사항을 달력 형태의 표 하나로 표시한다.
// 데스크톱(md 이상)은 7열 표, 모바일은 요일별 스택 목록으로 표현한다.
import Link from "next/link";

export type WeekItem = {
  id: number;
  name: string;
  /** ISO 문자열. 서버 로컬 타임존 기준으로 요일을 가른다. */
  completedAt: string;
  moduleName: string | null;
  featureName: string | null;
};

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 서버 로컬 기준 "YYYY-MM-DD" 키. */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type Props = {
  projectId: number;
  /** 이번 주 월요일 00:00 (서버 로컬). */
  weekStart: Date;
  items: WeekItem[];
};

export function WeekTable({ projectId, weekStart, items }: Props) {
  // 월~일 7일 칸을 만들고, completedAt 날짜별로 아이템을 분배한다.
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return { date, key: dateKey(date), items: [] as WeekItem[] };
  });
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const item of items) {
    byKey.get(dateKey(new Date(item.completedAt)))?.items.push(item);
  }
  const todayKey = dateKey(new Date());

  const cellItem = (item: WeekItem) => (
    <li key={item.id}>
      {(item.moduleName || item.featureName) && (
        <p className="truncate font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
          {[item.moduleName, item.featureName].filter(Boolean).join(" › ")}
        </p>
      )}
      <Link
        href={`/project/${projectId}/node/${item.id}`}
        className="text-xs font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
      >
        <span className="mr-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
          #{item.id}
        </span>
        {item.name}
      </Link>
    </li>
  );

  return (
    <>
      {/* 데스크톱: 주간 달력 표 하나 (#201) */}
      <table className="hidden w-full table-fixed border-collapse md:table">
        <thead>
          <tr>
            {days.map((d, i) => {
              const isToday = d.key === todayKey;
              return (
                <th
                  key={d.key}
                  className={`border border-zinc-200 px-2 py-2 text-center text-xs font-medium dark:border-zinc-800 ${
                    isToday
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
                  }`}
                >
                  {DAY_LABELS[i]}{" "}
                  <span className="font-mono">
                    {d.date.getMonth() + 1}/{d.date.getDate()}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            {days.map((d) => (
              <td
                key={d.key}
                className={`min-h-32 border border-zinc-200 px-2 py-2 align-top dark:border-zinc-800 ${
                  d.key === todayKey ? "bg-zinc-50/80 dark:bg-zinc-900/60" : "bg-white dark:bg-zinc-950"
                }`}
              >
                {d.items.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-300 dark:text-zinc-700">
                    -
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">{d.items.map(cellItem)}</ul>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* 모바일: 요일별 스택 목록 */}
      <div className="flex flex-col gap-3 md:hidden">
        {days.map((d, i) => (
          <div
            key={d.key}
            className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p
              className={`mb-2 text-xs font-medium ${
                d.key === todayKey
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {DAY_LABELS[i]}{" "}
              <span className="font-mono">
                {d.date.getMonth() + 1}/{d.date.getDate()}
              </span>
              {d.key === todayKey && " · 오늘"}
            </p>
            {d.items.length === 0 ? (
              <p className="text-xs text-zinc-300 dark:text-zinc-700">없음</p>
            ) : (
              <ul className="flex flex-col gap-2">{d.items.map(cellItem)}</ul>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
