// 참조: docs/components/01-navigation-header.md (v1.0), docs/domain/02-member.md (v1.0)
// 관리자(SUPER) 전용 영역. 비SUPER 접근은 차단한다.
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/signin");
  if (member.grade !== "SUPER") redirect("/");

  return <>{children}</>;
}
