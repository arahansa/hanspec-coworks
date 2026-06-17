// 참조: docs/feature/01-talk-ai-user.md (v1.0)
// NodeMessage 검증·정규화 헬퍼.
// API 라우트(messages 관련)에서 공통으로 쓰는 입력 검증을 모은다.

import type { MessageKind } from "@/generated/prisma/client";

const BODY_MAX = 8000;

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

/** 메시지 본문 검증: 비어 있지 않고 최대 길이 이내. */
export function validateBody(body: unknown): Validated<string> {
  if (typeof body !== "string") {
    return { ok: false, error: "본문(body)은 문자열이어야 합니다." };
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "본문(body)을 입력해 주세요." };
  }
  if (trimmed.length > BODY_MAX) {
    return { ok: false, error: `본문은 ${BODY_MAX}자 이내여야 합니다.` };
  }
  return { ok: true, value: trimmed };
}

/** CLAUDE가 생성할 수 있는 메시지 종류는 QUESTION·INSTRUCTION 뿐. */
export function validateCreateKind(kind: unknown): Validated<MessageKind> {
  if (kind === "QUESTION" || kind === "INSTRUCTION") {
    return { ok: true, value: kind };
  }
  return {
    ok: false,
    error: "kind는 QUESTION 또는 INSTRUCTION이어야 합니다.",
  };
}

/**
 * QUESTION의 선택지(options) 검증.
 * - 미지정/null이면 옵션 없는 자유응답 질문으로 허용.
 * - 지정 시 비어 있지 않은 문자열 배열이어야 한다.
 */
export function validateOptions(
  options: unknown,
): Validated<string[] | null> {
  if (options === undefined || options === null) {
    return { ok: true, value: null };
  }
  if (
    !Array.isArray(options) ||
    options.length === 0 ||
    !options.every((o) => typeof o === "string" && o.trim().length > 0)
  ) {
    return {
      ok: false,
      error: "options는 비어 있지 않은 문자열 배열이어야 합니다.",
    };
  }
  return { ok: true, value: options.map((o) => (o as string).trim()) };
}
