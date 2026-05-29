// 참조: docs/domain/02-member.md (v1.0) — 가입 화면
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { signUp } from "../actions";
import { AuthCard } from "../AuthCard";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  // 이미 로그인했다면 가입 화면 대신 Home으로.
  if (await getCurrentMember()) redirect("/");

  return (
    <AuthCard title="회원가입" description="이름과 비밀번호로 가입하세요.">
      <AuthForm
        action={signUp}
        submitLabel="가입하기"
        showRemember
        footer={{
          text: "이미 계정이 있으신가요?",
          linkLabel: "로그인",
          href: "/signin",
        }}
      />
    </AuthCard>
  );
}
