// 참조: docs/domain/04-node.md (v1.3) — 노드 편집기 (MODULE | FEATURE | REQUIREMENT 매트릭스)
// 모듈 셀 옆에 피처 셀, 그 옆에 요구사항 셀. 같은 상위는 rowspan으로 병합.
// 셀은 인라인 편집(blur 자동 저장, version+1). 상세(ⓘ) 아이콘으로 우측 상세 패널.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createModule,
  createFeature,
  createRequirement,
  updateNode,
  deleteNode,
  setFeatureTags,
} from "./actions";
import { NodeCell } from "./NodeCell";
import { NodeDetailPanel, type DetailNode } from "./NodeDetailPanel";
import type { NodeStatus } from "@/generated/prisma/client";

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
  assignees: AssigneeItem[];
};
// FEATURE 전용 필드: ENDPOINT·TAG (09-feature.md)
export type FeatureNode = NodeBase & {
  endpoint: string | null;
  tags: string[];
  children: ReqNode[];
};
export type ModuleNode = NodeBase & { children: FeatureNode[] };

type Props = { projectId: number; modules: ModuleNode[] };
type ActionResult = { ok: boolean; error?: string; nodeId?: number };

// 한 테이블 행을 셀 단위로 평탄화한다.
// moduleCell / featureCell은 그 셀을 "이 행에서 출력하고 rowSpan을 건다"는 의미.
// 없으면(undefined) 상위 행의 rowSpan에 덮여 출력하지 않는다.
type Row = {
  moduleCell?: { id: number; name: string; rowSpan: number };
  featureCell?: { id: number; name: string; rowSpan: number; endpoint: string | null };
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

function buildRows(modules: ModuleNode[]): Row[] {
  const rows: Row[] = [];
  for (const m of modules) {
    let modulePending: Row["moduleCell"] | undefined = {
      id: m.id,
      name: m.name,
      rowSpan: moduleRowCount(m),
    };
    const takeModule = () => {
      const c = modulePending;
      modulePending = undefined;
      return c;
    };

    if (m.children.length === 0) {
      rows.push({ moduleCell: takeModule(), third: { kind: "mod-empty" }, featureSpanFull: true });
      rows.push({ third: { kind: "feat-add", moduleId: m.id } });
      continue;
    }

    for (const f of m.children) {
      let featurePending: Row["featureCell"] | undefined = {
        id: f.id,
        name: f.name,
        rowSpan: featureRowCount(f),
        endpoint: f.endpoint,
      };
      const takeFeature = () => {
        const c = featurePending;
        featurePending = undefined;
        return c;
      };

      if (f.children.length === 0) {
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
      rows.push({ third: { kind: "req-add", featureId: f.id } });
    }
    rows.push({ third: { kind: "feat-add", moduleId: m.id } });
  }
  return rows;
}

export function NodeEditor({ projectId, modules }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "작업에 실패했습니다.");
      router.refresh();
    });
  }

  // 트리에서 detailId에 해당하는 노드를 찾아 상세 패널 데이터로 만든다.
  // 데이터가 갱신되면(예: 설명 저장 후 refresh) 항상 최신 값을 반영한다.
  const detailNode: DetailNode | null = (() => {
    if (detailId === null) return null;
    for (const m of modules) {
      if (m.id === detailId) return { ...m, level: "MODULE" };
      for (const f of m.children) {
        if (f.id === detailId)
          return {
            ...f,
            level: "FEATURE",
            endpoint: f.endpoint,
            tags: f.tags,
          };
        for (const r of f.children) {
          if (r.id === detailId) return { ...r, level: "REQUIREMENT" };
        }
      }
    }
    return null; // 삭제된 경우
  })();

  const rows = buildRows(modules);

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
      <div className="mb-3">
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
      ) : (
        <table className="w-full border-collapse border border-zinc-300 text-sm dark:border-zinc-700">
          <thead>
            <tr className="bg-zinc-100 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <th className="border border-zinc-300 px-3 py-2 dark:border-zinc-700" style={{ width: "30%" }}>
                모듈
              </th>
              <th className="border border-zinc-300 px-3 py-2 dark:border-zinc-700" style={{ width: "35%" }}>
                기능
              </th>
              <th className="border border-zinc-300 px-3 py-2 dark:border-zinc-700" style={{ width: "35%" }}>
                요구사항
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
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
                      <td className={cellCls} rowSpan={row.featureCell.rowSpan}>
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
            node={detailNode}
            projectId={projectId}
            pending={pending}
            onClose={() => setDetailId(null)}
            onOpenDetail={() =>
              router.push(`/project/${projectId}/node/${detailNode.id}`)
            }
            onSaveDescription={(description) =>
              run(() => updateNode(detailNode.id, { description }))
            }
            onSaveEndpoint={(endpoint) =>
              run(() => updateNode(detailNode.id, { endpoint }))
            }
            onSaveTags={(tags) => run(() => setFeatureTags(detailNode.id, tags))}
          />
        )}
      </div>
    </div>
  );
}
