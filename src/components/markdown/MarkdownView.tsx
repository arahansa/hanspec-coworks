// 참조: docs/domain/03-node.md (v1.5) — 노드 설명(description) 마크다운 렌더링
// description에 저장된 마크다운 원본을 HTML로 렌더링한다.
// react-markdown은 기본적으로 raw HTML을 통과시키지 않아(rehype-raw 미사용) XSS에 안전하다.
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

type Props = {
  /** 마크다운 원본 텍스트 */
  source: string;
  className?: string;
};

export function MarkdownView({ source, className }: Props) {
  return (
    <div className={`markdown-body ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
