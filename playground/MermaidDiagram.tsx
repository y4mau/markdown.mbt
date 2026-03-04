///| Mermaid diagram component with async rendering and token-based cancellation

import { createSignal, createEffect } from "@luna_ui/luna";
import { renderMermaid } from "./mermaid-runtime";

export function MermaidDiagram(props: {
  code: string;
  span: string;
  isDark: () => boolean;
}) {
  const [svgHtml, setSvgHtml] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [isRendering, setIsRendering] = createSignal(true);

  let token = 0; // request token for stale-result cancellation

  createEffect(() => {
    const dark = props.isDark(); // tracks isDark signal — re-runs on theme change
    // props.code is NOT reactive (plain string prop), so code changes are handled
    // by remounting via key={span} in the handler (span changes when code changes)
    const currentToken = ++token;

    setIsRendering(true);
    setError(null);
    // Retain previous svgHtml to avoid flicker during re-render

    renderMermaid(props.code, dark)
      .then((svg) => {
        if (currentToken !== token) return; // stale: discard
        setSvgHtml(svg);
        setIsRendering(false);
      })
      .catch((e) => {
        if (currentToken !== token) return;
        setError(e instanceof Error ? e.message : String(e));
        setIsRendering(false);
      });
  });

  return (
    <div class="mermaid-diagram-wrapper" data-span={props.span}>
      {isRendering() && !svgHtml() && (
        <div class="mermaid-loading">Rendering diagram…</div>
      )}
      {error() && (
        <div class="mermaid-error">
          <div class="mermaid-error-message">Mermaid Error: {error()}</div>
          <pre class="mermaid-error-source">
            <code>{props.code}</code>
          </pre>
        </div>
      )}
      {svgHtml() && !error() && (
        <div
          class="mermaid-rendered"
          ref={(el) => {
            if (el) el.innerHTML = svgHtml()!;
          }}
        />
      )}
    </div>
  );
}
