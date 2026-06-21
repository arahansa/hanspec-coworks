// 참조: docs/superpowers/specs/2026-06-22-slides-design.md
// wiremd(md) 본문을 와이어프레임 HTML로 렌더링한다.
//
// wiremd는 Node 전용 라이브러리라 서버에서만 호출한다(server-only).
// renderToHTML은 <!DOCTYPE html>…<style>… 형태의 "완전한 HTML 문서"를 반환하며,
// raw HTML/스크립트를 이스케이프하지 않는다. 따라서 이 문자열은 페이지에 직접 주입하지 않고
// 반드시 sandbox된 <iframe srcDoc>로 렌더해 스크립트 실행을 차단한다. (SlideFrame 컴포넌트)
import "server-only";
import { parse, renderToHTML } from "wiremd";

// 기획서/와이어프레임 느낌의 기본 스타일(Balsamiq 풍). 다중 스타일 토글은 차후 과제.
const DEFAULT_STYLE = "sketch" as const;

/** wiremd 파싱 실패 시 iframe에 보여줄 최소 오류 문서. */
function errorDocument(message: string): string {
  const safe = message.replace(/[<>&]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
  );
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:system-ui,sans-serif;padding:24px;color:#b91c1c">와이어프레임을 렌더링할 수 없습니다.<br><pre style="white-space:pre-wrap">${safe}</pre></body></html>`;
}

/**
 * wiremd(md) 본문을 와이어프레임 HTML 문서 문자열로 렌더링한다.
 * 항상 완전한 HTML 문서를 반환하므로 sandbox된 iframe의 srcDoc으로 사용한다.
 */
export function renderWiremd(content: string): string {
  try {
    const ast = parse(content ?? "");
    return renderToHTML(ast, { style: DEFAULT_STYLE, inlineStyles: true });
  } catch (e) {
    return errorDocument(e instanceof Error ? e.message : String(e));
  }
}
