///| Table chart toggle — ref-based, no lifecycle hooks
///| Follows MermaidDiagram.tsx pattern for reliable Luna integration

import type { Table } from "mdast";
import {
  getChartJs,
  extractChartData,
  buildChartConfig,
  defaultLabelConfig,
  type ChartType,
  type ChartData,
  type ChartLabelConfig,
} from "./chart-runtime";
import type { Chart } from "chart.js";

const cleanupMap = new WeakMap<HTMLElement, () => void>();

function cleanup(el: HTMLElement) {
  cleanupMap.get(el)?.();
  cleanupMap.delete(el);
}

// SVG icon paths (minimal, inline)
const ICONS = {
  table:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><line x1="2" y1="6" x2="14" y2="6"/><line x1="6" y1="6" x2="6" y2="14"/></svg>',
  bar:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="8" width="3" height="6" rx="0.5"/><rect x="6.5" y="4" width="3" height="10" rx="0.5"/><rect x="11" y="6" width="3" height="8" rx="0.5"/></svg>',
  line:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,12 6,6 10,9 14,3"/></svg>',
  pie:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><line x1="8" y1="8" x2="8" y2="2"/><line x1="8" y1="8" x2="13.2" y2="11"/></svg>',
  reset:
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8a6 6 0 1 1 1.8 4.3"/><polyline points="2,13 2,8.5 5,10.5"/></svg>',
};

function createBtn(
  icon: string,
  title: string,
  active: boolean,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "table-chart-btn" + (active ? " active" : "");
  btn.innerHTML = icon;
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

function createLabelRow(
  label: string,
  config: { show: boolean; text: string },
  onChange: () => void,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "table-chart-config-row";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = config.show;
  checkbox.addEventListener("change", () => {
    config.show = checkbox.checked;
    input.disabled = !checkbox.checked;
    onChange();
  });

  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  labelEl.style.minWidth = "60px";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "table-chart-config-input";
  input.value = config.text;
  input.disabled = !config.show;
  input.addEventListener("input", () => {
    config.text = input.value;
    onChange();
  });

  row.appendChild(checkbox);
  row.appendChild(labelEl);
  row.appendChild(input);
  return row;
}

function createConfigPopover(
  labelConfig: ChartLabelConfig,
  onChange: () => void,
): HTMLElement {
  const popover = document.createElement("div");
  popover.className = "table-chart-config-popover";

  popover.appendChild(createLabelRow("Title", labelConfig.caption, onChange));
  popover.appendChild(createLabelRow("X axis", labelConfig.xAxis, onChange));
  popover.appendChild(createLabelRow("Y axis", labelConfig.yAxis, onChange));

  return popover;
}

function renderChart(
  container: HTMLElement,
  data: ChartData,
  chartType: ChartType,
  dark: boolean,
  tableEl: HTMLElement | null,
  labels?: ChartLabelConfig,
  splitView?: boolean,
): Promise<Chart | null> {
  // Clear only the render target, not the whole container (toolbar may be a sibling)
  let renderTarget = container.querySelector(".table-chart-render-target") as HTMLElement | null;
  if (!renderTarget) {
    renderTarget = document.createElement("div");
    renderTarget.className = "table-chart-render-target";
    container.appendChild(renderTarget);
  }
  renderTarget.innerHTML = '<div class="table-chart-loading">Loading chart\u2026</div>';

  return getChartJs()
    .then(({ Chart }) => {
      if (!container.isConnected) return null;

      renderTarget!.innerHTML = "";
      const canvasWrapper = document.createElement("div");
      canvasWrapper.className = "table-chart-canvas-container";

      // Size: split view uses full width, preview-only uses 50%
      const areaWidth = container.offsetWidth || 600;
      const defaultWidth = splitView ? areaWidth : Math.round(areaWidth * 0.5);
      const defaultHeight = Math.round(defaultWidth * 10 / 16);
      canvasWrapper.style.width = `${defaultWidth}px`;
      canvasWrapper.dataset.defaultWidth = `${defaultWidth}`;
      canvasWrapper.style.height = `${defaultHeight}px`;
      canvasWrapper.style.maxWidth = `${areaWidth}px`;
      canvasWrapper.style.margin = "0 auto";

      const canvas = document.createElement("canvas");
      canvasWrapper.appendChild(canvas);
      renderTarget!.appendChild(canvasWrapper);

      const config = buildChartConfig(data, chartType, dark, labels);
      return new Chart(canvas, config);
    })
    .catch((e) => {
      if (!container.isConnected) return null;
      const rt = container.querySelector(".table-chart-render-target");
      if (rt) rt.innerHTML = `<div class="table-chart-error">Chart error: ${e instanceof Error ? e.message : String(e)}</div>`;
      return null;
    });
}

/**
 * Ref-based table chart toggle component.
 * Wraps an existing table element with a toolbar for switching to chart view.
 */
export function TableChart(props: {
  tableNode: Table;
  span: string;
  tableElement: unknown;
}) {
  return (
    <div
      class="table-chart-wrapper"
      data-span={props.span}
      ref={(el) => {
        if (!el) return;
        cleanup(el);

        const storageKey = `table-chart-view:${props.span}`;
        const sizeKey = `table-chart-size:${props.span}`;
        let currentView: "table" | ChartType = "table";
        let chartInstance: Chart | null = null;
        let chartContainer: HTMLElement | null = null;
        let tableContainer: HTMLElement | null = null;
        let buttons: Record<string, HTMLButtonElement> = {};

        const data = extractChartData(props.tableNode);
        if (!data) return; // not chartable — table renders as-is, no toolbar

        // Create toolbar
        const toolbar = document.createElement("div");
        toolbar.className = "table-chart-toolbar";

        function setActive(view: "table" | ChartType) {
          for (const [key, btn] of Object.entries(buttons)) {
            btn.classList.toggle("active", key === view);
          }
        }

        // Compute default widths once at init (independent of each other)
        const isSplitView = !!el.closest(".view-split");
        const defaultTableWidth = "";  // CSS default (80%)
        const defaultChartWidth = isSplitView ? "" : "100%";
        let savedTableWidth = defaultTableWidth;
        let savedChartWidth = defaultChartWidth;

        function showTable() {
          if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
          }
          if (currentView !== "table") {
            savedChartWidth = el.style.width || savedChartWidth;
            saveCanvasSize();
          }
          if (configPanel) { configPanel.remove(); configPanel = null; }
          if (chartContainer) chartContainer.style.display = "none";
          if (tableContainer) tableContainer.style.display = "";
          el.style.resize = "horizontal";
          el.style.width = savedTableWidth;
          el.prepend(toolbar);
          currentView = "table";
          setActive("table");
          localStorage.setItem(storageKey, "table");
        }

        function showChart(type: ChartType) {
          if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
          }
          if (!skipSizeRestore && currentView !== "table") saveCanvasSize();
          if (currentView === "table") savedTableWidth = el.style.width || savedTableWidth;
          if (tableContainer) tableContainer.style.display = "none";
          el.style.resize = "none";
          el.style.width = savedChartWidth;
          if (!chartContainer) {
            chartContainer = document.createElement("div");
            chartContainer.className = "table-chart-chart-area";
            el.appendChild(chartContainer);
          }
          chartContainer.style.display = "";
          currentView = type;
          setActive(type);
          localStorage.setItem(storageKey, type);

          const dark = document.documentElement.getAttribute("data-theme") === "dark";
          renderChart(chartContainer, data!, type, dark, tableContainer, labelConfig, isSplitView).then((chart) => {
            chartInstance = chart;
            // Wrap canvas in a fit-content container, put toolbar above it
            const canvasContainer = chartContainer!.querySelector(".table-chart-canvas-container") as HTMLElement | null;
            if (canvasContainer) {
              // Restore saved size (skip on reset)
              if (!skipSizeRestore) {
                const saved = localStorage.getItem(sizeKey);
                if (saved) {
                  try {
                    const { w, h } = JSON.parse(saved);
                    if (w) canvasContainer.style.width = w;
                    if (h) canvasContainer.style.height = h;
                  } catch {}
                }
              }
              skipSizeRestore = false;

              const chartGroup = document.createElement("div");
              chartGroup.className = "table-chart-group";
              canvasContainer.replaceWith(chartGroup);
              // Reset toolbar to static flow
              toolbar.style.position = "";
              toolbar.style.transform = "";
              toolbar.style.top = "";
              toolbar.style.right = "";
              chartGroup.appendChild(toolbar);
              chartGroup.appendChild(canvasContainer);
            }
            updateConfigPanel();
          });
        }

        function saveCanvasSize() {
          if (!chartContainer) return;
          const cc = chartContainer.querySelector(".table-chart-canvas-container") as HTMLElement | null;
          if (cc) {
            localStorage.setItem(sizeKey, JSON.stringify({ w: cc.style.width, h: cc.style.height }));
          }
        }

        let skipSizeRestore = false;

        function resetCanvasSize() {
          localStorage.removeItem(sizeKey);
          if (currentView !== "table") {
            skipSizeRestore = true;
            showChart(currentView as ChartType);
          }
        }

        // Label config (all hidden by default)
        const labelConfig = defaultLabelConfig(data!);
        let configPanel: HTMLElement | null = null;

        function rebuildChart() {
          if (currentView === "table" || !chartInstance) return;
          // Update chart options in place instead of re-rendering
          const dark = document.documentElement.getAttribute("data-theme") === "dark";
          const newConfig = buildChartConfig(data!, currentView as ChartType, dark, labelConfig);
          chartInstance.options = newConfig.options!;
          chartInstance.update();
        }

        function updateConfigPanel() {
          if (configPanel) {
            configPanel.remove();
            configPanel = null;
          }
          if ((currentView === "bar" || currentView === "line") && chartContainer) {
            const group = chartContainer.querySelector(".table-chart-group");
            if (group) {
              configPanel = createConfigPopover(labelConfig, rebuildChart);
              const canvas = group.querySelector(".table-chart-canvas-container") as HTMLElement | null;
              const dw = canvas?.dataset.defaultWidth;
              if (dw) configPanel.style.width = `${dw}px`;
              configPanel.style.margin = "8px auto 0";
              group.appendChild(configPanel);
            }
          }
        }

        buttons.table = createBtn(ICONS.table, "Table view", true, showTable);
        buttons.bar = createBtn(ICONS.bar, "Bar chart", false, () => showChart("bar"));
        buttons.line = createBtn(ICONS.line, "Line chart", false, () => showChart("line"));
        buttons.pie = createBtn(ICONS.pie, "Pie chart", false, () => showChart("pie"));
        buttons.reset = createBtn(ICONS.reset, "Reset size", false, resetCanvasSize);

        toolbar.appendChild(buttons.table);
        toolbar.appendChild(buttons.bar);
        toolbar.appendChild(buttons.line);
        toolbar.appendChild(buttons.pie);
        toolbar.appendChild(buttons.reset);

        el.appendChild(toolbar);

        // Luna renders children asynchronously — defer table lookup and restore saved view
        requestAnimationFrame(() => {
          tableContainer = el.querySelector("table");
          const saved = localStorage.getItem(storageKey);
          if (saved === "bar" || saved === "line" || saved === "pie") {
            showChart(saved);
          }
        });

        // Cleanup
        cleanupMap.set(el, () => {
          if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
          }
        });
      }}
    >
      {props.tableElement}
    </div>
  );
}
