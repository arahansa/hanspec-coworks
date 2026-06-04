// 참조: docs/superpowers/specs/2026-06-01-requirement-detail-task-design.md (v1.0)
// 요구사항(REQUIREMENT) 상세 페이지. 본문은 RequirementDetailBody로 모달과 공유한다.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { loadRequirementDetail } from "@/lib/requirement-detail";
import { RequirementDetailBody } from "./RequirementDetailBody";

export const dynamic = "force-dynamic";

// Next.js 16: params는 Promise로 전달된다.
export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string; nodeId: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");

  const { id, nodeId } = await params;
  const projectId = Number(id);
  const reqId = Number(nodeId);
  if (!Number.isInteger(projectId) || !Number.isInteger(reqId)) notFound();

  const backHref = `/project/${projectId}/table-view`;
  const result = await loadRequirementDetail(reqId);

  if (!result.ok && result.reason === "not-found") notFound();
  if (result.ok && result.projectId !== projectId) notFound();

  return (
    <div className="p-8">
      <Link href={backHref} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← TableView로 돌아가기
      </Link>

      {result.ok ? (
        <div className="mt-4">
          <RequirementDetailBody data={result.data} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          이 노드는 요구사항이 아니어서 상세 페이지를 제공하지 않습니다.
        </p>
      )}
    </div>
  );
}
