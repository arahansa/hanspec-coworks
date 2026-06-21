// 참조: docs/superpowers/specs/2026-06-22-slides-design.md
// wiremd가 만든 "완전한 HTML 문서"를 sandbox된 iframe으로 렌더한다.
//
// sandbox=""(allow-scripts 없음)이라 문서 내 <script>는 실행되지 않아 저장형 XSS를 막는다.
// 인라인 <style>/폰트 @import는 정상 동작한다. 훅을 쓰지 않으므로 서버/클라이언트 양쪽에서 쓸 수 있다.
type Props = {
  /** renderWiremd가 반환한 완전한 HTML 문서 문자열 */
  html: string;
  className?: string;
  title?: string;
};

export function SlideFrame({ html, className, title = "슬라이드 와이어프레임" }: Props) {
  return (
    <iframe
      title={title}
      srcDoc={html}
      // 스크립트·동일출처를 모두 차단(빈 sandbox). 와이어프레임은 정적이라 충분하다.
      sandbox=""
      className={
        className ??
        "h-[70vh] w-full rounded-lg border border-zinc-200 bg-white dark:border-zinc-800"
      }
    />
  );
}
