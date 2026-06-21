// 참조: 요구사항 #210 "첫 페이지 하단 CLI API 안내 + md파일 다운로드"
// 연동 가이드(docs/apis/02-client-integration.md)를 markdown 파일로 다운로드시킨다.
// 가이드 자체는 비밀값이 없는 공개 문서라 인증 없이 제공한다.
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * GET /api/docs/client-integration
 * - 응답: text/markdown, 첨부 파일명 coworks-client-integration.md
 */
export async function GET() {
  // 정적 경로 문자열이어야 번들러(file tracing)가 배포 산출물에 파일을 포함한다.
  const filePath = path.join(
    process.cwd(),
    "docs/apis/02-client-integration.md",
  );

  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return Response.json(
      { ok: false, error: "가이드 문서를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="coworks-client-integration.md"',
    },
  });
}
