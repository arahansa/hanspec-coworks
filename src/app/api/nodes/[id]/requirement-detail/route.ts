// 참조: docs/domain/04-node.md, 11-request-notification.md
// 세션(쿠키) 인증 기반 요구사항 상세 데이터 조회 API. 테이블뷰 패널의 모달 보기에 사용한다.
// (외부 토큰용 /api/nodes/:id 와 달리 앱 내부 로그인 세션으로 인증한다.)
import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/auth";
import { loadRequirementDetail } from "@/lib/requirement-detail";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const reqId = Number(id);
  if (!Number.isInteger(reqId)) {
    return NextResponse.json(
      { ok: false, error: "올바르지 않은 노드 id입니다." },
      { status: 400 },
    );
  }

  const result = await loadRequirementDetail(reqId);
  if (!result.ok) {
    const status = result.reason === "not-found" ? 404 : 400;
    const error =
      result.reason === "not-found"
        ? "존재하지 않는 노드입니다."
        : "요구사항이 아니어서 상세를 제공하지 않습니다.";
    return NextResponse.json({ ok: false, error }, { status });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
