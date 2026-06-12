// 참조: 요구사항 #210 "첫 페이지 하단 CLI API 안내 + md파일 다운로드",
//       docs/apis/02-client-integration.md (연동 가이드 원문)
// 첫 페이지 하단의 "CLI로 API 이용하기" 안내 영역.
// 핵심 3단계 요약과 curl 예시를 보여주고, 전체 연동 가이드(md)를 다운로드시킨다.

const CURL_EXAMPLE = `curl -H "Authorization: Bearer $HANSPEC_COWORKS_ACCESSTOKEN" \\
  "$HANSPEC_COWORKS_BASE_URL/api/nodes/75"`;

const STEPS = [
  {
    title: "액세스 토큰 발급",
    body: "로그인 후 /me 페이지에서 발급한다. 멤버당 1개, 발급일로부터 7일 유효.",
  },
  {
    title: "환경 변수 설정",
    body: "호출하는 프로젝트의 .env에 HANSPEC_COWORKS_BASE_URL과 HANSPEC_COWORKS_ACCESSTOKEN을 둔다(커밋 금지).",
  },
  {
    title: "Bearer 헤더로 호출",
    body: "모든 API는 Authorization: Bearer 헤더가 필요하며 { ok, ... } 형태로 응답한다.",
  },
];

export function CliApiGuide() {
  return (
    <section className="mt-8 rounded-xl bg-zinc-50 p-5 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">
            CLI로 API 이용하기
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            노드 조회·Task 등록 등 coworks API를 터미널/외부 프로젝트에서 호출할
            수 있다.
          </p>
        </div>
        <a
          href="/api/docs/client-integration"
          download
          className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          연동 가이드(.md) 다운로드
        </a>
      </div>

      <ol className="mt-4 space-y-2">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {i + 1}
            </span>
            <div>
              <p className="font-medium text-zinc-800 dark:text-zinc-200">
                {step.title}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100 dark:bg-black">
        {CURL_EXAMPLE}
      </pre>
    </section>
  );
}
