// 참조: docs/domain/06-task.md (v1.1)
// Task 필드(description·progress·name·endpoint)의 검증·정규화 로직.
//
// Server Action(actions.ts)과 HTTP API 핸들러(api/tasks/route.ts)가 공유한다.
// actions.ts는 "use server"로 묶여 있어 그 안의 헬퍼를 API에서 import할 수 없으므로
// 순수 검증 로직을 여기로 추출했다.
import "server-only";

export const TASK_NAME_MAX = 50;
export const TASK_ENDPOINT_MAX = 255;

/** description을 trim한다. 비어 있으면 에러. */
export function validateDescription(
  description: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const desc = description.trim();
  if (!desc) return { ok: false, error: "작업 설명을 입력해 주세요." };
  return { ok: true, value: desc };
}

/** progress를 정수로 정규화하고 0~100 범위를 검증한다. (기본 0) */
export function validateProgress(
  progress: number,
): { ok: true; value: number } | { ok: false; error: string } {
  const p = Number.isFinite(progress) ? Math.trunc(progress) : 0;
  if (p < 0 || p > 100) {
    return { ok: false, error: "진행도는 0~100 사이여야 합니다." };
  }
  return { ok: true, value: p };
}

/** Task의 name(컴포넌트 이름)·endpoint(경로)를 검증·정규화한다. (06-task.md) */
export function normalizeTaskFields(
  name?: string,
  endpoint?: string,
):
  | { ok: true; name: string | null; endpoint: string | null }
  | { ok: false; error: string } {
  let n: string | null = null;
  let e: string | null = null;
  if (name !== undefined) {
    const t = name.trim();
    if (t.length > TASK_NAME_MAX) {
      return { ok: false, error: `이름은 ${TASK_NAME_MAX}자 이하여야 합니다.` };
    }
    n = t || null;
  }
  if (endpoint !== undefined) {
    const t = endpoint.trim();
    if (t.length > TASK_ENDPOINT_MAX) {
      return {
        ok: false,
        error: `Endpoint는 ${TASK_ENDPOINT_MAX}자 이하여야 합니다.`,
      };
    }
    e = t || null;
  }
  return { ok: true, name: n, endpoint: e };
}
