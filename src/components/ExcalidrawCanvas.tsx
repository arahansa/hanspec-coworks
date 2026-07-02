// 참조: docs/superpowers/specs/2026-07-02-slides-canvas-excalidraw-design.md
// Excalidraw 캔버스 래퍼. 브라우저 전용이라 ssr:false 동적 import로 로드한다.
"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { serializeAsJSON } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export type SceneDocument = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

// Excalidraw 본체는 window에 의존 → 서버 렌더 금지.
const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => m.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 text-sm text-zinc-400">캔버스 로딩…</div>
    ),
  },
);

type Props = {
  initialDocument: SceneDocument | null;
  viewMode?: boolean;
  onChange?: (doc: SceneDocument) => void;
  className?: string;
};

export function ExcalidrawCanvas({
  initialDocument,
  viewMode,
  onChange,
  className,
}: Props) {
  // initialData는 마운트 시 1회만 반영되므로 안정적인 값으로 고정.
  const initialData = useMemo(
    () =>
      initialDocument
        ? {
            elements: initialDocument.elements as never,
            appState: {
              ...(initialDocument.appState as object),
              collaborators: undefined,
            },
            files: initialDocument.files as never,
          }
        : undefined,
    [initialDocument],
  );

  return (
    <div
      className={
        className ??
        "h-[70vh] w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
      }
    >
      <Excalidraw
        initialData={initialData}
        viewModeEnabled={viewMode ?? false}
        onChange={(elements, appState, files) => {
          if (!onChange) return;
          // serializeAsJSON("database")이 휘발성 appState를 정제한 문자열을 반환.
          const parsed = JSON.parse(
            serializeAsJSON(elements, appState, files, "database"),
          ) as {
            elements: unknown[];
            appState: Record<string, unknown>;
            files: Record<string, unknown>;
          };
          onChange({
            elements: parsed.elements,
            appState: parsed.appState,
            files: parsed.files,
          });
        }}
      />
    </div>
  );
}
