// 참조: docs/components/01-navigation-header.md (v1.1), docs/domain/03-admin.md (v1.0)
// 관리자(SUPER) 전용 영역. 비SUPER 접근은 차단한다.
// 컨텐츠 영역을 좌우로 나눠 좌측에 sub-nav 사이드바를 둔다.
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { AdminSidebar } from "./AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");
  if (member.grade !== "SUPER") redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
