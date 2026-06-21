// 참조: docs/superpowers/specs/2026-06-08-related-requirement-design.md (v1.0)
// 요구사항 상세 본문(RequirementDetailBody)이 상세 페이지와 모달에서 함께 쓰이는데,
// 모달은 데이터를 클라이언트 useState로 보관하므로 router.refresh()로는 갱신되지 않는다.
// 각 섹션이 서버 액션 성공 후 onMutated()를 호출하면, 모달은 데이터를 다시 fetch한다.
// 상세 페이지는 Provider를 쓰지 않으므로 기본 no-op이 적용되고, 기존 router.refresh()가 동작한다.
"use client";

import { createContext, useContext } from "react";

type RequirementMutationContextValue = {
  /** 서버 액션으로 데이터가 바뀐 뒤 호출. 모달은 이 신호로 상세를 다시 불러온다. */
  onMutated: () => void;
};

const RequirementMutationContext = createContext<RequirementMutationContextValue>({
  // 기본값: 아무것도 하지 않음(상세 페이지는 router.refresh()로 충분).
  onMutated: () => {},
});

export const RequirementMutationProvider = RequirementMutationContext.Provider;

/** 섹션에서 서버 액션 성공 후 호출할 onMutated를 얻는다. */
export function useRequirementMutation(): RequirementMutationContextValue {
  return useContext(RequirementMutationContext);
}
