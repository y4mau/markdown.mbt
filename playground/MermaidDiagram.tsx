///| Mermaid diagram renderer — ref-based, no lifecycle hooks
///| Works reliably regardless of Luna's component lifecycle timing

import { renderMermaid, getCachedMermaid } from "./mermaid-runtime";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const PADDING = 16; // matches .mermaid-rendered CSS padding

interface ZoomPanState {
  scale: number;
  panX: number;
  panY: number;
  isPanning: boolean;
  dragStartX: number;
  dragStartY: number;
  dragStartPanX: number;
  dragStartPanY: number;
}

const cleanupMap = new WeakMap<HTMLElement, () => void>();

function cleanupZoom(el: HTMLElement) {
  cleanupMap.get(el)?.();
  cleanupMap.delete(el);
}

function clampScale(s: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}

function clampPan(
  state: ZoomPanState,
  renderedEl: HTMLElement,
  viewport: HTMLElement,
  newPanX: number,
  newPanY: number,
) {
  const areaW = renderedEl.clientWidth - PADDING * 2;
  const areaH = renderedEl.clientHeight - PADDING * 2;
  const viewportW = viewport.offsetWidth;
  const viewportH = viewport.offsetHeight;
  const scaledW = viewportW * state.scale;
  const scaledH = viewportH * state.scale;
  const layoutLeft = (areaW - viewportW) / 2;
  const layoutTop = (areaH - viewportH) / 2;

  const minPanX = Math.min(-layoutLeft, areaW - layoutLeft - scaledW);
  const maxPanX = Math.max(-layoutLeft, areaW - layoutLeft - scaledW);
  state.panX = Math.max(minPanX, Math.min(maxPanX, newPanX));

  const minPanY = Math.min(-layoutTop, areaH - layoutTop - scaledH);
  const maxPanY = Math.max(-layoutTop, areaH - layoutTop - scaledH);
  state.panY = Math.max(minPanY, Math.min(maxPanY, newPanY));
}

function applyTransform(
  state: ZoomPanState,
  viewport: HTMLElement,
  renderedEl: HTMLElement,
  label: HTMLElement | null,
) {
  viewport.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;

  if (state.scale > 1) {
    renderedEl.classList.add("zoomed");
  } else {
    renderedEl.classList.remove("zoomed");
  }

  if (label) {
    label.textContent = `${Math.round(state.scale * 100)}%`;
  }
}

function createControls(
  state: ZoomPanState,
  viewport: HTMLElement,
  renderedEl: HTMLElement,
): HTMLElement {
  const controls = document.createElement("div");
  controls.className = "mermaid-zoom-controls";

  const zoomOut = document.createElement("button");
  zoomOut.className = "mermaid-zoom-btn";
  zoomOut.textContent = "\u2212"; // minus sign
  zoomOut.setAttribute("aria-label", "Zoom out");
  zoomOut.title = "Zoom out";

  const label = document.createElement("span");
  label.className = "mermaid-zoom-label";
  label.textContent = "100%";

  const zoomIn = document.createElement("button");
  zoomIn.className = "mermaid-zoom-btn";
  zoomIn.textContent = "+";
  zoomIn.setAttribute("aria-label", "Zoom in");
  zoomIn.title = "Zoom in";

  const reset = document.createElement("button");
  reset.className = "mermaid-zoom-btn";
  reset.textContent = "Reset";
  reset.setAttribute("aria-label", "Reset zoom");
  reset.title = "Reset zoom";

  const btnZoom = (delta: number) => {
    const newScale = clampScale(state.scale + delta);
    if (newScale === state.scale) return;
    state.scale = newScale;
    if (state.scale <= 1) {
      state.panX = 0;
      state.panY = 0;
    } else {
      clampPan(state, renderedEl, viewport, state.panX, state.panY);
    }
    applyTransform(state, viewport, renderedEl, label);
  };

  const handleClick = (e: MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  zoomOut.addEventListener("click", (e) => handleClick(e, () => btnZoom(-0.25)));
  zoomIn.addEventListener("click", (e) => handleClick(e, () => btnZoom(0.25)));
  reset.addEventListener("click", (e) =>
    handleClick(e, () => {
      state.scale = 1;
      state.panX = 0;
      state.panY = 0;
      applyTransform(state, viewport, renderedEl, label);
    }),
  );

  controls.appendChild(zoomOut);
  controls.appendChild(label);
  controls.appendChild(zoomIn);
  controls.appendChild(reset);

  return controls;
}

function setupZoomPan(renderedEl: HTMLElement): () => void {
  const svg = renderedEl.querySelector("svg");
  if (!svg) return () => {};

  // Wrap SVG in viewport
  const viewport = document.createElement("div");
  viewport.className = "mermaid-zoom-viewport";
  svg.replaceWith(viewport);
  viewport.appendChild(svg);

  const state: ZoomPanState = {
    scale: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartPanX: 0,
    dragStartPanY: 0,
  };

  const controls = createControls(state, viewport, renderedEl);
  const label = controls.querySelector(".mermaid-zoom-label") as HTMLElement;
  renderedEl.appendChild(controls);

  let suppressClick = false;
  let savedUserSelect = "";
  let removeDocListeners: (() => void) | null = null;

  // Wheel zoom (Ctrl+wheel)
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();

    const oldScale = state.scale;
    const newScale = clampScale(oldScale - e.deltaY * 0.005);
    if (newScale === oldScale) return;

    const containerRect = renderedEl.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left - PADDING;
    const mouseY = e.clientY - containerRect.top - PADDING;
    const areaW = renderedEl.clientWidth - PADDING * 2;
    const areaH = renderedEl.clientHeight - PADDING * 2;
    const layoutLeft = (areaW - viewport.offsetWidth) / 2;
    const layoutTop = (areaH - viewport.offsetHeight) / 2;
    const relX = mouseX - layoutLeft;
    const relY = mouseY - layoutTop;

    state.panX = relX - (relX - state.panX) * (newScale / oldScale);
    state.panY = relY - (relY - state.panY) * (newScale / oldScale);
    state.scale = newScale;

    if (state.scale <= 1) {
      state.panX = 0;
      state.panY = 0;
    } else {
      clampPan(state, renderedEl, viewport, state.panX, state.panY);
    }

    applyTransform(state, viewport, renderedEl, label);
  };

  renderedEl.addEventListener("wheel", onWheel, { passive: false });

  // Pan (mousedown on renderedEl — entire diagram frame is draggable)
  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || state.scale <= 1) return;
    // Don't start drag from control buttons
    if ((e.target as HTMLElement).closest(".mermaid-zoom-controls")) return;

    state.isPanning = true;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    state.dragStartPanX = state.panX;
    state.dragStartPanY = state.panY;
    suppressClick = false;

    savedUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    viewport.classList.add("panning");
    renderedEl.classList.add("panning");

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - state.dragStartX;
      const dy = ev.clientY - state.dragStartY;
      if (Math.abs(dx) >= 3 || Math.abs(dy) >= 3) {
        suppressClick = true;
      }
      clampPan(state, renderedEl, viewport, state.dragStartPanX + dx, state.dragStartPanY + dy);
      applyTransform(state, viewport, renderedEl, label);
    };

    const finishDrag = () => {
      state.isPanning = false;
      document.body.style.userSelect = savedUserSelect;
      viewport.classList.remove("panning");
      renderedEl.classList.remove("panning");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", finishDrag);
      window.removeEventListener("blur", finishDrag);
      removeDocListeners = null;
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", finishDrag);
    window.addEventListener("blur", finishDrag, { once: true });

    removeDocListeners = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", finishDrag);
      window.removeEventListener("blur", finishDrag);
    };
  };

  renderedEl.addEventListener("mousedown", onMouseDown);

  // Click suppression (capture phase on renderedEl)
  const onClickCapture = (e: MouseEvent) => {
    if (suppressClick) {
      e.stopPropagation();
      e.preventDefault();
      suppressClick = false;
    }
  };

  renderedEl.addEventListener("click", onClickCapture, true);

  // Cleanup function
  return () => {
    renderedEl.removeEventListener("wheel", onWheel);
    renderedEl.removeEventListener("mousedown", onMouseDown);
    renderedEl.removeEventListener("click", onClickCapture, true);
    removeDocListeners?.();
    if (state.isPanning) {
      document.body.style.userSelect = savedUserSelect;
    }
    renderedEl.classList.remove("zoomed", "panning");
    viewport.classList.remove("panning");
  };
}

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

        cleanupZoom(el);

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
            cleanupZoom(el);
            setError(el, e instanceof Error ? e.message : String(e), props.code);
          });
      }}
    />
  );
}

function setSvg(el: HTMLElement, svg: string) {
  cleanupZoom(el);

  const rendered = document.createElement("div");
  rendered.className = "mermaid-rendered";
  rendered.innerHTML = svg;
  el.innerHTML = "";
  el.appendChild(rendered);

  const cleanup = setupZoomPan(rendered);
  cleanupMap.set(el, cleanup);
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
