// 참조: docs/superpowers/specs/2026-06-22-slides-design.md
// 에디터 미리보기용 wiremd 렌더 API. 본문(md)을 받아 와이어프레임 HTML 문서를 반환한다.
// 세션 쿠키(로그인) 인증만 한다 — 토큰 API와 별개의 웹 UI 보조 엔드포인트.
import { NextResponse } from "next/server";
import { getCurrentMemberId } from "@/lib/auth";
import { renderWiremd } from "@/lib/wiremd";

export const dynamic = "force-dynamic";

/**
 * POST /api/slides/render
 * Body: { content: string }
 * - 성공: 200 { ok: true, html }  (html은 완전한 HTML 문서; iframe srcDoc 용)
 */
export async function POST(request: Request) {
  const memberId = await getCurrentMemberId();
  if (memberId === null) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  let body: { content?: unknown };
  try {
    body = (await request.json()) as { content?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 본문(JSON)을 해석할 수 없습니다." },
      { status: 400 },
    );
  }

  const content = typeof body.content === "string" ? body.content : "";
  const html = renderWiremd(content);
  return NextResponse.json({ ok: true, html });
}
