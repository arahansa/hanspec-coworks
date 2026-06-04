// 참조: docs/domain/04-node.md — 노드 상세 패널
// "노드 상세 아이콘 클릭시 상세 정보 표현" (Node id=45) 구현.
// FEATURE 상세에서는 ENDPOINT·TAG 입력을 추가로 제공한다. (09-feature.md)
"use client";

import { useState } from "react";
import type { NodeStatus } from "@/generated/prisma/client";
import { TagInput } from "./TagInput";
import { StatusSection } from "@/app/project/[id]/node/[nodeId]/StatusSection";
import {
  AssigneeSection,
  type AssigneeItem,
} from "@/app/project/[id]/node/[nodeId]/AssigneeSection";

export type DetailNode = {
  id: number;
  name: string;
  level: "MODULE" | "FEATURE" | "REQUIREMENT";
  description: string | null;
  version: number;
  createdAt: string; // ISO 문자열
  // FEATURE에만 존재. 다른 레벨에서는 undefined.
  endpoint?: string | null;
  tags?: string[];
  // REQUIREMENT에만 존재. 다른 레벨에서는 undefined.
  status?: NodeStatus;
  assignees?: AssigneeItem[];
};

const LEVEL_LABEL: Record<DetailNode["level"], string> = {
  MODULE: "모듈",
  FEATURE: "기능",
  REQUIREMENT: "요구사항",
};

const ENDPOINT_MAX = 255;

type Props = {
  node: DetailNode;
  projectId: number;
  pending: boolean;
  onClose: () => void;
  /** 요구사항 상세 페이지로 이동(REQUIREMENT에서만 노출). */
  onOpenDetail: () => void;
  /** 설명 저장(변경 시에만 호출). */
  onSaveDescription: (description: string) => void;
  /** ENDPOINT 저장(FEATURE 전용, 변경 시에만 호출). */
  onSaveEndpoint: (endpoint: string) => void;
  /** 태그 저장(FEATURE 전용). */
  onSaveTags: (tags: string[]) => void;
};

export function NodeDetailPanel({
  node,
  projectId,
  pending,
  onClose,
  onOpenDetail,
  onSaveDescription,
  onSaveEndpoint,
  onSaveTags,
}: Props) {
  const [draft, setDraft] = useState(node.description ?? "");
  const dirty = draft.trim() !== (node.description ?? "").trim();

  const [endpointDraft, setEndpointDraft] = useState(node.endpoint ?? "");
  const endpointDirty =
    endpointDraft.trim() !== (node.endpoint ?? "").trim();

  const isFeature = node.level === "FEATURE";
  const isRequirement = node.level === "REQUIREMENT";
  // ENDPOINT는 MODULE·FEATURE에서 입력할 수 있다. (09-feature.md)
  const hasEndpoint = node.level === "MODULE" || node.level === "FEATURE";

  return (
    <>
      {/* 좁은 화면(lg 미만)에서만 보이는 딤 백드롭. 클릭 시 닫힘. */}
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-30 bg-black/40 lg:hidden"
      />
      {/*
        넓은 화면(lg 이상): 테이블 옆에 붙는 인라인 컬럼.
          sticky로 두어 표를 길게 스크롤해도 패널이 헤더(h-14=3.5rem) 바로 아래에
          고정되어 따라온다. self-start가 없으면 flex 부모의 stretch로 늘어나
          sticky가 동작하지 않는다. 패널이 화면보다 길면 자체 스크롤한다.
        좁은 화면(lg 미만): 우측에서 떠오르는 불투명 오버레이 드로어.
      */}
      <aside
        className="
          fixed inset-y-0 right-0 z-40 w-80 max-w-[90vw] overflow-y-auto
          border-l border-zinc-200 bg-white p-5 shadow-2xl
          dark:border-zinc-800 dark:bg-zinc-950
          lg:sticky lg:top-14 lg:z-auto lg:max-w-none lg:shrink-0 lg:self-start
          lg:max-h-[calc(100vh-3.5rem)] lg:overflow-y-auto
          lg:p-0 lg:pl-5 lg:shadow-none
        "
      >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {LEVEL_LABEL[node.level]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {node.level === "REQUIREMENT" && (
            <button
              type="button"
              onClick={onOpenDetail}
              aria-label="요구사항 상세 보기"
              title="요구사항 상세 보기"
              className="rounded px-1.5 py-0.5 text-sm text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              ↗
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded px-1.5 py-0.5 text-sm text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
      </div>

      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {node.name}
      </h2>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500 dark:text-zinc-400">ID</dt>
          <dd className="font-mono text-zinc-700 dark:text-zinc-300">#{node.id}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500 dark:text-zinc-400">버전</dt>
          <dd className="font-mono text-zinc-700 dark:text-zinc-300">v{node.version}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500 dark:text-zinc-400">생성일</dt>
          <dd className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
            {node.createdAt.slice(0, 10)}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">설명</span>
          <textarea
            value={draft}
            rows={6}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="이 노드에 대한 설명을 입력하세요."
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => onSaveDescription(draft)}
          className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "저장 중…" : "설명 저장"}
        </button>
      </div>

      {/* MODULE·FEATURE: ENDPOINT (09-feature.md) */}
      {hasEndpoint && (
        <div className="mt-6">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              ENDPOINT
            </span>
            <input
              type="text"
              value={endpointDraft}
              maxLength={ENDPOINT_MAX}
              disabled={pending}
              onChange={(e) => setEndpointDraft(e.target.value)}
              placeholder="예: GET /api/projects/:id"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <button
            type="button"
            disabled={pending || !endpointDirty}
            onClick={() => onSaveEndpoint(endpointDraft)}
            className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "저장 중…" : "ENDPOINT 저장"}
          </button>
        </div>
      )}

      {/* FEATURE 전용: TAG (09-feature.md) */}
      {isFeature && (
        <div className="mt-6">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            태그
          </span>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
            @로 태그를 하나씩 입력하세요. 기존 태그는 목록에서 선택할 수 있습니다.
          </p>
          <TagInput
            projectId={projectId}
            value={node.tags ?? []}
            pending={pending}
            onChange={onSaveTags}
          />
        </div>
      )}

      {/* REQUIREMENT 전용: 상태 변경·담당자 지정 (03-node.md 추가요청1·2) */}
      {isRequirement && node.status !== undefined && (
        <StatusSection nodeId={node.id} status={node.status} />
      )}
      {isRequirement && (
        <AssigneeSection nodeId={node.id} assignees={node.assignees ?? []} />
      )}
      </aside>
    </>
  );
}
