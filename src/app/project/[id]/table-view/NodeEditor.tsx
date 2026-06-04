// 참조: docs/domain/04-node.md (v1.3) — 노드 편집기 (MODULE | FEATURE | REQUIREMENT 매트릭스)
// 모듈 셀 옆에 피처 셀, 그 옆에 요구사항 셀. 같은 상위는 rowspan으로 병합.
// 셀은 인라인 편집(blur 자동 저장, version+1). 상세(ⓘ) 아이콘으로 우측 상세 패널.
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createModule,
  createFeature,
  createRequirement,
  updateNode,
  deleteNode,
  setNodeTags,
  moveRequirement,
} from "./actions";
import { NodeCell } from "./NodeCell";
import { NodeDetailPanel, type DetailNode } from "./NodeDetailPanel";
import { RequirementDetailModal } from "./RequirementDetailModal";
import { ModuleFilter } from "./ModuleFilter";
import type { NodeStatus } from "@/generated/prisma/client";
import {
  NODE_STATUS_BADGE_CLASS,
  NODE_STATUS_LABEL,
} from "@/app/project/[id]/node/[nodeId]/node-status";

type Level = "MODULE" | "FEATURE" | "REQUIREMENT";

type NodeBase = {
  id: number;
  name: string;
  description: string | null;
  version: number;
  createdAt: string; // 직렬화된 ISO 문자열
};
// REQUIREMENT 전용 필드: 상태·담당자 (03-node.md 추가요청1·2)
export type AssigneeItem = { id: number; username: string };
export type ReqNode = NodeBase & {
  status: NodeStatus;
  // REQUIREMENT도 ENDPOINT 가능 (FEATURE/MODULE과 동일)
  endpoint: string | null;
  // REQUIREMENT도 TAG 가능 (05-tag.md)
  tags: string[];
  assignees: AssigneeItem[];
};
// FEATURE 전용 필드: ENDPOINT·TAG (09-feature.md)
export type FeatureNode = NodeBase & {
  endpoint: string | null;
  tags: string[];
  children: ReqNode[];
};
export type ModuleNode = NodeBase & {
  endpoint: string | null; // MODULE도 ENDPOINT 가능 (09-feature.md)
  children: FeatureNode[];
};

type Props = { projectId: number; modules: ModuleNode[] };
type ActionResult = { ok: boolean; error?: string; nodeId?: number };

// 한 테이블 행을 셀 단위로 평탄화한다.
// moduleCell / featureCell은 그 셀을 "이 행에서 출력하고 rowSpan을 건다"는 의미.
// 없으면(undefined) 상위 행의 rowSpan에 덮여 출력하지 않는다.
type Row = {
  moduleCell?: { id: number; name: string; rowSpan: number; endpoint: string | null };
  featureCell?: {
    id: number;
    name: string;
    rowSpan: number;
    endpoint: string | null;
    // 하위 요구사항 완료율(DONE/전체×100, 정수). 요구사항이 없으면 null(미표시).
    progress: number | null;
  };
  // 세 번째 칸(요구사항 영역)에 무엇을 그릴지
  third:
    | { kind: "req"; node: ReqNode }
    | { kind: "req-empty" }
    | { kind: "req-add"; featureId: number }
    | { kind: "feat-add"; moduleId: number }
    | { kind: "mod-empty" };
  // mod-empty / feat-add 행은 기능 칸도 함께 비워야 하므로 표식
  featureSpanFull?: boolean; // 기능+요구사항 칸을 colSpan으로 합칠지(모듈 빈 행)
};

/** 모듈 총 행 수. 피처 없으면 2(빈행+기능추가), 있으면 Σ피처행 + 기능추가행. */
function moduleRowCount(m: ModuleNode): number {
  if (m.children.length === 0) return 2;
  return m.children.reduce((s, f) => s + featureRowCount(f), 0) + 1;
}
/** 피처 총 행 수: 요구사항 수(없으면 1 빈행) + 요구사항추가행. */
function featureRowCount(f: FeatureNode): number {
  return Math.max(1, f.children.length) + 1;
}

/**
 * 기능의 하위 요구사항 완료율(DONE/전체×100, 정수). 예: 4개 중 3개 DONE → 75.
 * 요구사항이 없으면 null(진행율 미표시).
 */
function featureProgress(f: FeatureNode): number | null {
  const total = f.children.length;
  if (total === 0) return null;
  const done = f.children.filter((r) => r.status === "DONE").length;
  return Math.round((done / total) * 100);
}

/**
 * 트리를 행 단위로 평탄화한다.
 * hideAffordances=true('진행중만 보기' 등 조회 모드)면 추가 버튼(feat-add/req-add)과
 * 빈 플레이스홀더(mod-empty/req-empty) 행을 생성하지 않는다. 이 모드에서는 호출 전
 * 가지치기로 빈 기능/모듈이 이미 제거되므로 rowSpan 계산도 그에 맞춰 보정한다.
 */
function buildRows(modules: ModuleNode[], hideAffordances = false): Row[] {
  // 추가행을 숨길 땐 모듈/피처의 rowSpan에서 추가행 몫(+1)을 빼야 셀 병합이 맞는다.
  const modRows = (m: ModuleNode) =>
    hideAffordances
      ? m.children.reduce((s, f) => s + featRows(f), 0)
      : moduleRowCount(m);
  const featRows = (f: FeatureNode) =>
    hideAffordances ? f.children.length : featureRowCount(f);

  const rows: Row[] = [];
  for (const m of modules) {
    let modulePending: Row["moduleCell"] | undefined = {
      id: m.id,
      name: m.name,
      rowSpan: modRows(m),
      endpoint: m.endpoint,
    };
    const takeModule = () => {
      const c = modulePending;
      modulePending = undefined;
      return c;
    };

    if (m.children.length === 0) {
      // hideAffordances면 가지치기로 여기 도달하지 않지만 방어적으로 건너뛴다.
      if (hideAffordances) continue;
      rows.push({ moduleCell: takeModule(), third: { kind: "mod-empty" }, featureSpanFull: true });
      rows.push({ third: { kind: "feat-add", moduleId: m.id } });
      continue;
    }

    for (const f of m.children) {
      let featurePending: Row["featureCell"] | undefined = {
        id: f.id,
        name: f.name,
        rowSpan: featRows(f),
        endpoint: f.endpoint,
        progress: featureProgress(f),
      };
      const takeFeature = () => {
        const c = featurePending;
        featurePending = undefined;
        return c;
      };

      if (f.children.length === 0) {
        if (hideAffordances) continue;
        rows.push({
          moduleCell: takeModule(),
          featureCell: takeFeature(),
          third: { kind: "req-empty" },
        });
      } else {
        for (const r of f.children) {
          rows.push({
            moduleCell: takeModule(),
            featureCell: takeFeature(),
            third: { kind: "req", node: r },
          });
        }
      }
      if (!hideAffordances) {
        rows.push({ third: { kind: "req-add", featureId: f.id } });
      }
    }
    if (!hideAffordances) {
      rows.push({ third: { kind: "feat-add", moduleId: m.id } });
    }
  }
  return rows;
}

/**
 * 행의 안정적인 React key. 인덱스를 key로 쓰면 '진행중만' 토글로 행 수가 바뀔 때
 * NodeCell의 내부 draft 상태가 엉뚱한 노드에 재사용되어 제목과 배지가 어긋난다.
 * req 행은 반드시 노드 id로 식별해 인스턴스 공유를 막는다.
 */
function rowKey(row: Row, i: number): string {
  const t = row.third;
  switch (t.kind) {
    case "req":
      return `req-${t.node.id}`;
    case "req-add":
      return `req-add-${t.featureId}`;
    case "feat-add":
      return `feat-add-${t.moduleId}`;
    case "req-empty":
      return `req-empty-${row.featureCell?.id ?? i}`;
    case "mod-empty":
      return `mod-empty-${row.moduleCell?.id ?? i}`;
  }
}

export function NodeEditor({ projectId, modules }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  // 모달로 상세를 보는 요구사항 노드 id(null이면 닫힘).
  const [modalId, setModalId] = useState<number | null>(null);
  // 드래그 중인 요구사항 id / 드롭 하이라이트 중인 기능 id.
  const [draggingReqId, setDraggingReqId] = useState<number | null>(null);
  const [dropFeatureId, setDropFeatureId] = useState<number | null>(null);

  // 모듈 필터: 선택된 모듈 id 집합. 초기엔 전체 선택.
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<number>>(
    () => new Set(modules.map((m) => m.id)),
  );
  // "진행중만 보기" 필터. 화면 상태로만 관리(새로고침 시 초기화).
  const [inProgressOnly, setInProgressOnly] = useState(false);
  // 요구사항 셀의 태그 배지 표시 여부. 모든 요구사항은 그대로 나오고 배지만 토글한다.
  const [showTags, setShowTags] = useState(true);
  // 모듈 목록이 바뀌면(추가/삭제) 동기화한다.
  // - 새로 생긴 모듈은 자동 선택(전체가 보이던 기본 동작 유지).
  // - 삭제된 모듈 id는 선택에서 제거.
  const prevIdsRef = useRef<number[]>(modules.map((m) => m.id));
  useEffect(() => {
    const currentIds = modules.map((m) => m.id);
    const prev = prevIdsRef.current;
    const added = currentIds.filter((id) => !prev.includes(id));
    const removed = prev.filter((id) => !currentIds.includes(id));
    if (added.length === 0 && removed.length === 0) return;
    setSelectedModuleIds((cur) => {
      const next = new Set(cur);
      added.forEach((id) => next.add(id));
      removed.forEach((id) => next.delete(id));
      return next;
    });
    prevIdsRef.current = currentIds;
  }, [modules]);

  // 선택된 모듈만 표에 노출한다.
  const visibleModules = modules.filter((m) => selectedModuleIds.has(m.id));

  // "진행중만 보기": IN_PROGRESS 요구사항만 남기고, 그 결과 빈 기능·모듈은 제거한다.
  // 모듈 멀티셀렉트(visibleModules)와 AND로 합성된다.
  const displayModules = inProgressOnly
    ? visibleModules
        .map((m) => ({
          ...m,
          children: m.children
            .map((f) => ({
              ...f,
              children: f.children.filter((r) => r.status === "IN_PROGRESS"),
            }))
            .filter((f) => f.children.length > 0),
        }))
        .filter((m) => m.children.length > 0)
    : visibleModules;

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "작업에 실패했습니다.");
      router.refresh();
    });
  }

  // 드래그한 요구사항을 다른 기능 아래로 이동한다.
  function moveReq(reqId: number, featureId: number) {
    if (!Number.isInteger(reqId)) return;
    run(() => moveRequirement(reqId, featureId));
  }

  // 트리에서 detailId에 해당하는 노드를 찾아 상세 패널 데이터로 만든다.
  // 데이터가 갱신되면(예: 설명 저장 후 refresh) 항상 최신 값을 반영한다.
  const detailNode: DetailNode | null = (() => {
    if (detailId === null) return null;
    for (const m of modules) {
      if (m.id === detailId)
        return { ...m, level: "MODULE", endpoint: m.endpoint };
      for (const f of m.children) {
        if (f.id === detailId)
          return {
            ...f,
            level: "FEATURE",
            endpoint: f.endpoint,
            tags: f.tags,
          };
        for (const r of f.children) {
          if (r.id === detailId)
            return { ...r, level: "REQUIREMENT", tags: r.tags };
        }
      }
    }
    return null; // 삭제된 경우
  })();

  // 진행중만 보기 모드에선 추가 버튼·빈 행을 숨긴다(조회/검토 모드).
  const rows = buildRows(displayModules, inProgressOnly);

  const addBtn = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
    >
      {label}
    </button>
  );

  const cellCls =
    "border border-zinc-200 px-2 py-1 align-middle dark:border-zinc-800";
  const moduleCellCls = `${cellCls} bg-zinc-50/60 dark:bg-zinc-900/40`;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        {modules.length > 0 && (
          <ModuleFilter
            modules={modules.map((m) => ({ id: m.id, name: m.name }))}
            selected={selectedModuleIds}
            onChange={setSelectedModuleIds}
          />
        )}
        {modules.length > 0 && (
          <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={inProgressOnly}
              onChange={(e) => setInProgressOnly(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
            />
            진행중만
          </label>
        )}
        {modules.length > 0 && (
          <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={showTags}
              onChange={(e) => setShowTags(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
            />
            태그 표시
          </label>
        )}
        {addBtn("+ 새 모듈", () =>
          run(() => createModule(projectId, "새 모듈", "")),
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="flex gap-6">
       <div className="min-w-0 flex-1">
      {modules.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          모듈이 없습니다. “+ 새 모듈”로 시작하세요.
        </p>
      ) : visibleModules.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          선택된 모듈이 없습니다. 상단 필터에서 모듈을 선택하세요.
        </p>
      ) : displayModules.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          진행중인 요구사항이 없습니다.
        </p>
      ) : (
        <table className="w-full border-collapse border border-zinc-300 text-sm dark:border-zinc-700">
          <thead>
            <tr className="bg-zinc-100 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <th className="border border-zinc-300 px-3 py-2 dark:border-zinc-700" style={{ width: "20%" }}>
                모듈
              </th>
              <th className="border border-zinc-300 px-3 py-2 dark:border-zinc-700" style={{ width: "28%" }}>
                기능
              </th>
              <th className="border border-zinc-300 px-3 py-2 dark:border-zinc-700" style={{ width: "52%" }}>
                요구사항
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {/* 모듈 칸 */}
                {row.moduleCell && (
                  <td className={moduleCellCls} rowSpan={row.moduleCell.rowSpan}>
                    <NodeCell
                      value={row.moduleCell.name}
                      level="MODULE"
                      pending={pending}
                      active={detailId === row.moduleCell.id}
                      onCommit={(name) =>
                        run(() => updateNode(row.moduleCell!.id, { name }))
                      }
                      onDetail={() => setDetailId(row.moduleCell!.id)}
                      onDelete={() =>
                        run(() => deleteNode(row.moduleCell!.id))
                      }
                    />
                    {/* ENDPOINT 정보가 있으면 노출 (09-feature.md) */}
                    {row.moduleCell.endpoint && (
                      <p className="mt-1 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        {row.moduleCell.endpoint}
                      </p>
                    )}
                  </td>
                )}

                {/* 기능 칸 (모듈 빈 행이면 요구사항 칸과 합쳐 colSpan=2) */}
                {row.featureSpanFull ? (
                  <td
                    className={`${cellCls} text-zinc-400 dark:text-zinc-500`}
                    colSpan={2}
                  >
                    기능 없음
                  </td>
                ) : (
                  <>
                    {row.featureCell && (
                      <td
                        className={`${cellCls} ${
                          dropFeatureId === row.featureCell.id
                            ? "bg-blue-50/60 outline outline-2 -outline-offset-2 outline-blue-400 dark:bg-blue-950/30"
                            : ""
                        }`}
                        rowSpan={row.featureCell.rowSpan}
                        onDragOver={(e) => {
                          // 요구사항을 드래그하는 중일 때만 드롭을 허용한다.
                          if (draggingReqId == null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dropFeatureId !== row.featureCell!.id) {
                            setDropFeatureId(row.featureCell!.id);
                          }
                        }}
                        onDragLeave={(e) => {
                          // 셀 내부 자식으로 이동하는 경우는 무시(셀을 완전히 벗어날 때만 해제).
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                          setDropFeatureId((cur) =>
                            cur === row.featureCell!.id ? null : cur,
                          );
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDropFeatureId(null);
                          const reqId = Number(e.dataTransfer.getData("text/plain"));
                          setDraggingReqId(null);
                          moveReq(reqId, row.featureCell!.id);
                        }}
                      >
                        <NodeCell
                          value={row.featureCell.name}
                          level="FEATURE"
                          pending={pending}
                          active={detailId === row.featureCell.id}
                          onCommit={(name) =>
                            run(() => updateNode(row.featureCell!.id, { name }))
                          }
                          onDetail={() => setDetailId(row.featureCell!.id)}
                          onDelete={() =>
                            run(() => deleteNode(row.featureCell!.id))
                          }
                        />
                        {/* 하위 요구사항 완료율(DONE/전체). 요구사항 없으면 미표시. */}
                        {row.featureCell.progress !== null && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                              <div
                                className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
                                style={{ width: `${row.featureCell.progress}%` }}
                              />
                            </div>
                            <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
                              {row.featureCell.progress}%
                            </span>
                          </div>
                        )}
                        {/* ENDPOINT 정보가 있으면 노출 (09-feature.md) */}
                        {row.featureCell.endpoint && (
                          <p className="mt-1 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                            {row.featureCell.endpoint}
                          </p>
                        )}
                      </td>
                    )}

                    {/* "+ 기능 추가" 행: 기능 칸 자리에서 요구사항 칸까지 colSpan=2 */}
                    {row.third.kind === "feat-add" && (
                      <td className={cellCls} colSpan={2}>
                        {addBtn("+ 기능 추가", () =>
                          run(() =>
                            createFeature(
                              (row.third as { featureId?: number; moduleId: number }).moduleId,
                              "새 기능",
                              "",
                            ),
                          ),
                        )}
                      </td>
                    )}

                    {/* 요구사항 칸 */}
                    {row.third.kind === "req" && (
                      <td className={cellCls}>
                        <div className="flex items-center gap-1">
                          <span
                            draggable
                            onDragStart={(e) => {
                              const reqId = (row.third as { node: ReqNode }).node.id;
                              e.dataTransfer.setData("text/plain", String(reqId));
                              e.dataTransfer.effectAllowed = "move";
                              setDraggingReqId(reqId);
                            }}
                            onDragEnd={() => {
                              setDraggingReqId(null);
                              setDropFeatureId(null);
                            }}
                            title="드래그하여 다른 기능으로 이동"
                            aria-label="요구사항 이동 핸들"
                            className="shrink-0 cursor-grab select-none rounded px-1 py-1 text-zinc-300 transition hover:bg-zinc-100 hover:text-zinc-500 active:cursor-grabbing dark:text-zinc-600 dark:hover:bg-zinc-800"
                          >
                            ⠿
                          </span>
                          <div className="min-w-0 flex-1">
                        <NodeCell
                          value={row.third.node.name}
                          level="REQUIREMENT"
                          pending={pending}
                          active={detailId === row.third.node.id}
                          onCommit={(name) =>
                            run(() =>
                              updateNode((row.third as { node: ReqNode }).node.id, {
                                name,
                              }),
                            )
                          }
                          onDetail={() =>
                            setDetailId((row.third as { node: ReqNode }).node.id)
                          }
                          onDelete={() =>
                            run(() =>
                              deleteNode((row.third as { node: ReqNode }).node.id),
                            )
                          }
                        />
                          </div>
                        </div>
                        {/* ENDPOINT 정보가 있으면 노출 (MODULE·FEATURE와 동일) */}
                        {row.third.node.endpoint && (
                          <p className="mt-1 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                            {row.third.node.endpoint}
                          </p>
                        )}
                        {/* 상태·담당자를 셀에서 함께 노출 (03-node.md) */}
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              NODE_STATUS_BADGE_CLASS[row.third.node.status]
                            }`}
                          >
                            {NODE_STATUS_LABEL[row.third.node.status]}
                          </span>
                          {row.third.node.assignees.map((a) => (
                            <span
                              key={a.id}
                              className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                            >
                              @{a.username}
                            </span>
                          ))}
                        </div>
                        {/* 태그 배지. '태그 표시' 체크 시에만 노출(05-tag.md) */}
                        {showTags && row.third.node.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {row.third.node.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    )}
                    {row.third.kind === "req-empty" && (
                      <td className={`${cellCls} text-zinc-400 dark:text-zinc-500`}>
                        요구사항 없음
                      </td>
                    )}
                    {row.third.kind === "req-add" && (
                      <td className={cellCls}>
                        {addBtn("+ 요구사항 추가", () =>
                          run(() =>
                            createRequirement(
                              (row.third as { featureId: number }).featureId,
                              "새 요구사항",
                              "",
                            ),
                          ),
                        )}
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
       </div>

        {detailNode && (
          <NodeDetailPanel
            // 노드 id를 key로 줘서 다른 노드를 선택하면 패널을 새로 마운트한다.
            // 없으면 인스턴스가 재사용되어 useState(node.description) 초기값이
            // 재적용되지 않고 이전 노드의 입력(draft)이 남는다. (rowKey와 같은 이유)
            key={detailNode.id}
            node={detailNode}
            projectId={projectId}
            pending={pending}
            onClose={() => setDetailId(null)}
            onOpenDetail={() =>
              router.push(`/project/${projectId}/node/${detailNode.id}`)
            }
            onOpenModal={() => setModalId(detailNode.id)}
            onSaveDescription={(description) =>
              run(() => updateNode(detailNode.id, { description }))
            }
            onSaveEndpoint={(endpoint) =>
              run(() => updateNode(detailNode.id, { endpoint }))
            }
            onSaveTags={(tags) => run(() => setNodeTags(detailNode.id, tags))}
          />
        )}
      </div>

      {modalId !== null && (
        <RequirementDetailModal
          key={modalId}
          nodeId={modalId}
          onClose={() => setModalId(null)}
        />
      )}
    </div>
  );
}
