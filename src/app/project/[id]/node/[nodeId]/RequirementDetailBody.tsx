// 참조: docs/domain/04-node.md, 11-request-notification.md
// 요구사항 상세 본문(빵부스러기 + 헤더 + 각 섹션). 상세 페이지와 모달이 함께 재사용한다.
"use client";

import type { NodeStatus } from "@/generated/prisma/client";
import { TaskSection, type TaskItem } from "./TaskSection";
import { StatusSection } from "./StatusSection";
import { AssigneeSection, type AssigneeItem } from "./AssigneeSection";
import { DescriptionSection } from "./DescriptionSection";
import { RequestSection, type GroupOption } from "./RequestSection";
import {
  CompleteNotificationSection,
  type SiblingRequirement,
  type CompleteReservation,
} from "./CompleteNotificationSection";
import { IdCopyButtons } from "./IdCopyButtons";

export type Ancestor = { id: number; name: string; level: string };

export type RequirementDetailData = {
  id: number;
  name: string;
  version: number;
  description: string | null;
  status: NodeStatus;
  projectName: string;
  ancestors: Ancestor[];
  assignees: AssigneeItem[];
  tasks: TaskItem[];
  envNames: string[];
  groups: GroupOption[];
  requestedMemberIds: number[];
  requestedGroupIds: number[];
  // 완료 알림 예약 (12-complete-notification.md)
  siblings: SiblingRequirement[];
  reservations: CompleteReservation[];
};

const LEVEL_LABEL: Record<string, string> = {
  MODULE: "모듈",
  FEATURE: "기능",
  REQUIREMENT: "요구사항",
};

export function RequirementDetailBody({ data }: { data: RequirementDetailData }) {
  return (
    <div>
      {/* 빵부스러기: 프로젝트 › 모듈 › 기능 — 어떤 기능의 요구사항인지 한눈에. */}
      <nav
        aria-label="상위 경로"
        className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400"
      >
        <span className="text-zinc-400 dark:text-zinc-500">{data.projectName}</span>
        {data.ancestors.map((a) => (
          <span key={a.id} className="flex items-center gap-1.5">
            <span className="text-zinc-300 dark:text-zinc-600">›</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {LEVEL_LABEL[a.level] ?? a.level}
            </span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{a.name}</span>
          </span>
        ))}
      </nav>

      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        요구사항
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        {data.name}
      </h1>
      <p className="mt-1 font-mono text-xs text-zinc-400">
        #{data.id}
        <IdCopyButtons nodeId={data.id} />
        {" · "}v{data.version}
      </p>

      <DescriptionSection nodeId={data.id} description={data.description} />

      <StatusSection nodeId={data.id} status={data.status} />
      <AssigneeSection nodeId={data.id} assignees={data.assignees} />
      <RequestSection
        nodeId={data.id}
        groups={data.groups}
        requestedMemberIds={data.requestedMemberIds}
        requestedGroupIds={data.requestedGroupIds}
      />
      <CompleteNotificationSection
        nodeId={data.id}
        siblings={data.siblings}
        groups={data.groups}
        reservations={data.reservations}
      />
      <TaskSection nodeId={data.id} tasks={data.tasks} envNames={data.envNames} />
    </div>
  );
}
