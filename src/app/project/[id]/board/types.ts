// 보드(칸반) 화면에서 서버 → 클라이언트로 넘기는 데이터 형태.
import type { NodeStatus } from "@/generated/prisma/client";

/** 보드의 카드 1장 = REQUIREMENT 노드 1개. */
export type BoardCard = {
  id: number;
  name: string;
  status: NodeStatus;
  /** DONE일 때만 값이 있다. ISO 문자열. */
  completedAt: string | null;
  /** 상위 기능(FEATURE). 트리가 어긋난 경우를 대비해 null 허용. */
  featureId: number | null;
  featureName: string | null;
  /** 상위 모듈(MODULE). */
  moduleId: number | null;
  moduleName: string | null;
  tags: string[];
  assignees: { id: number; username: string }[];
};

/** 필터 드롭다운의 선택지. 보드에 실제로 존재하는 값만 담는다. */
export type BoardFilterOptions = {
  modules: { id: number; name: string }[];
  features: { id: number; name: string }[];
  assignees: { id: number; name: string }[];
  tags: string[];
};
