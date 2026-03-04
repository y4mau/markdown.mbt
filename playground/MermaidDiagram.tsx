///| Mermaid diagram renderer — ref-based, no lifecycle hooks
///| Works reliably regardless of Luna's component lifecycle timing

import { renderMermaid, getCachedMermaid } from "./mermaid-runtime";

/**
 * Returns a div that renders a mermaid diagram via ref callback.
 * No signals, no createEffect, no onMount — avoids all Luna timing issues.
 * Cache hit → instant SVG display. Cache miss → loading → async render.
 */
export function MermaidDiagram(props: {
  code: string;
  span: string;
}) {
  return (
    <div
      class="mermaid-diagram-wrapper"
      data-span={props.span}
      ref={(el) => {
        if (!el) return;
        const dark = document.documentElement.getAttribute("data-theme") === "dark";

        // Synchronous cache check — instant display, no flicker
        const cached = getCachedMermaid(props.code, dark);
        if (cached) {
          setSvg(el, cached);
          return;
        }

        // Cache miss: show loading, start async render
        el.innerHTML = `<div class="mermaid-loading">Rendering diagram\u2026</div>`;
        renderMermaid(props.code, dark)
          .then((svg) => {
            if (!el.isConnected) return;
            setSvg(el, svg);
          })
          .catch((e) => {
            if (!el.isConnected) return;
            setError(el, e instanceof Error ? e.message : String(e), props.code);
          });
      }}
    />
  );
}

function setSvg(el: HTMLElement, svg: string) {
  const rendered = document.createElement("div");
  rendered.className = "mermaid-rendered";
  rendered.innerHTML = svg;
  el.innerHTML = "";
  el.appendChild(rendered);
}

function setError(el: HTMLElement, message: string, code: string) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "mermaid-error";

  const msgDiv = document.createElement("div");
  msgDiv.className = "mermaid-error-message";
  msgDiv.textContent = `Mermaid Error: ${message}`;

  const pre = document.createElement("pre");
  pre.className = "mermaid-error-source";
  const codeEl = document.createElement("code");
  codeEl.textContent = code;
  pre.appendChild(codeEl);

  errorDiv.appendChild(msgDiv);
  errorDiv.appendChild(pre);
  el.innerHTML = "";
  el.appendChild(errorDiv);
}
