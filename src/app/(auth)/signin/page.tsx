// 참조: docs/domain/02-member.md (v1.0) — 로그인 화면
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { signIn } from "../actions";
import { AuthCard } from "../AuthCard";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getCurrentMember()) redirect("/");

  return (
    <AuthCard title="로그인" description="이름과 비밀번호를 입력하세요.">
      <AuthForm
        action={signIn}
        submitLabel="로그인"
        footer={{
          text: "아직 계정이 없으신가요?",
          linkLabel: "회원가입",
          href: "/signup",
        }}
      />
    </AuthCard>
  );
}
