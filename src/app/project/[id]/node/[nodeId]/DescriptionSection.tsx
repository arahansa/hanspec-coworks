// 요구사항 상세 페이지의 설명(description) 섹션.
// 보기(마크다운 렌더링) 기본, 편집 토글은 DescriptionEditor 공용 컴포넌트에 위임한다.
// 참조: docs/domain/03-node.md (v1.5) — description 마크다운 렌더링
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DescriptionEditor } from "@/components/markdown/DescriptionEditor";
import { updateNodeDescription } from "./actions";

type Props = {
  nodeId: number;
  description: string | null;
};

export function DescriptionSection({ nodeId, description }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(draft: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateNodeDescription(nodeId, draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-8 max-w-2xl">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        설명
      </h2>
      <DescriptionEditor
        value={description}
        pending={pending}
        error={error}
        onSave={save}
        placeholder="이 요구사항에 대한 설명을 마크다운으로 입력하세요."
      />
    </section>
  );
}
