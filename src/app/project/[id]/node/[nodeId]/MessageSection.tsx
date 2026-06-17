// 참조: docs/feature/01-talk-ai-user.md (v1.0)
// 요구사항 상세의 coworks ↔ Claude 대화 스레드 섹션.
// - 스레드 표시: CLAUDE 질문 / USER 답변 / USER 지시를 시간순으로.
// - 미답변 QUESTION에는 선택지 버튼 + 자유입력 폼.
// - 하단에 자유 추가 지시(INSTRUCTION) 입력란.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerMessage, addInstruction } from "./actions";

export type MessageItem = {
  id: number;
  role: "CLAUDE" | "USER";
  kind: "QUESTION" | "ANSWER" | "INSTRUCTION";
  status: "PENDING" | "ANSWERED" | "ACKNOWLEDGED" | null;
  body: string;
  options: string[] | null;
  selectedOption: number | null;
  parentId: number | null;
  createdAt: string; // ISO 문자열
};

type Props = {
  nodeId: number;
  messages: MessageItem[];
};

const inputCls =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const KIND_LABEL: Record<MessageItem["kind"], string> = {
  QUESTION: "질문",
  ANSWER: "답변",
  INSTRUCTION: "지시",
};

function fmt(iso: string): string {
  // 표시는 로컬 시각의 분 단위까지.
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 미답변 QUESTION에 답하는 폼: 선택지 버튼 + 자유 텍스트. */
function AnswerForm({ question }: { question: MessageItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");

  function submit(input: { selectedOption?: number; body?: string }) {
    setError(null);
    startTransition(async () => {
      const res = await answerMessage(question.id, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setText("");
      router.refresh();
    });
  }

  return (
    <div className="mt-2 space-y-2">
      {question.options && question.options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={pending}
              onClick={() => submit({ selectedOption: i })}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <span className="mr-1.5 font-mono text-xs text-zinc-400">
                {i + 1}
              </span>
              {opt}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          disabled={pending}
          placeholder="직접 입력해서 답하기…"
          className={`${inputCls} flex-1`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) submit({ body: text });
          }}
        />
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={() => submit({ body: text })}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          답변
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** 한 메시지 말풍선. role/kind에 따라 정렬·색을 달리한다. */
function Bubble({ msg }: { msg: MessageItem }) {
  const isClaude = msg.role === "CLAUDE";
  return (
    <div className={isClaude ? "" : "flex flex-col items-end"}>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400">
          {isClaude ? "Claude" : "나"} · {KIND_LABEL[msg.kind]}
        </span>
        <span className="text-[10px] text-zinc-400">{fmt(msg.createdAt)}</span>
      </div>
      <div
        className={`mt-0.5 inline-block max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
          isClaude
            ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
            : "bg-blue-600 text-white"
        }`}
      >
        {msg.body}
      </div>
    </div>
  );
}

export function MessageSection({ nodeId, messages }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);

  function sendInstruction() {
    const text = instruction.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const res = await addInstruction(nodeId, text);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setInstruction("");
      router.refresh();
    });
  }

  // 미답변 QUESTION(=PENDING)만 답변 폼을 띄운다.
  const pendingQuestions = new Set(
    messages
      .filter((m) => m.kind === "QUESTION" && m.status === "PENDING")
      .map((m) => m.id),
  );

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        대화 (Claude ↔ 나)
      </h2>

      {messages.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
          아직 대화가 없습니다. Claude가 질문을 남기거나, 아래에서 추가 지시를
          보낼 수 있습니다.
        </p>
      ) : (
        <ul className="mt-3 space-y-4">
          {messages.map((m) => (
            <li key={m.id}>
              <Bubble msg={m} />
              {pendingQuestions.has(m.id) && <AnswerForm question={m} />}
            </li>
          ))}
        </ul>
      )}

      {/* 자유 추가 지시 입력란. */}
      <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={instruction}
            disabled={pending}
            placeholder="Claude에게 추가 지시 보내기…"
            className={`${inputCls} flex-1`}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendInstruction();
            }}
          />
          <button
            type="button"
            disabled={pending || !instruction.trim()}
            onClick={sendInstruction}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            지시 보내기
          </button>
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </section>
  );
}
