///| Chart.js lazy loader, data extraction from mdast tables, and config builders

import type { PhrasingContent, Table } from "mdast";
import type { ChartConfiguration } from "chart.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChartData {
  labels: string[];
  series: { name: string; values: number[] }[];
  xLabel: string;
  yLabel: string | null;
  yUnit: string | null;
  caption: string;
}

export type ChartType = "bar" | "line" | "pie";

// ---------------------------------------------------------------------------
// Inline text flattening
// ---------------------------------------------------------------------------

/** Recursively extract plain text from mdast PhrasingContent nodes */
export function flattenInlineText(children: PhrasingContent[]): string {
  let result = "";
  for (const node of children) {
    if (node.type === "text") {
      result += node.value;
    } else if (node.type === "inlineCode") {
      result += node.value;
    } else if ("children" in node && Array.isArray(node.children)) {
      result += flattenInlineText(node.children as PhrasingContent[]);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Chartability detection
// ---------------------------------------------------------------------------

function parseNumeric(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  // Strip trailing % for percentage values
  const cleaned = trimmed.endsWith("%") ? trimmed.slice(0, -1) : trimmed;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Extract unit from header text like "Revenue ($)" → { name: "Revenue", unit: "$" } */
function parseHeaderUnit(header: string): { name: string; unit: string | null } {
  const match = header.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { name: match[1].trim(), unit: match[2].trim() };
  }
  return { name: header, unit: null };
}

/** Quick check: table has ≥2 rows (header + ≥1 body), ≥2 columns, ≥1 numeric cell in body */
export function isChartable(table: Table): boolean {
  const rows = table.children;
  if (rows.length < 2) return false; // need header + at least 1 body row

  const headerCells = rows[0].children;
  if (headerCells.length < 2) return false; // need at least 2 columns

  // Scan body rows for at least one numeric cell
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r].children;
    for (const cell of cells) {
      const text = flattenInlineText(cell.children);
      if (parseNumeric(text) !== null) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Data extraction
// ---------------------------------------------------------------------------

/** Extract chart data from an mdast Table node. Returns null if not chartable. */
export function extractChartData(table: Table): ChartData | null {
  if (!isChartable(table)) return null;

  const rows = table.children;
  const headerRow = rows[0];
  const bodyRows = rows.slice(1);
  const colCount = headerRow.children.length;

  // Extract header texts
  const headers = headerRow.children.map((c) => flattenInlineText(c.children));

  // Determine which columns (1..n) are numeric (have at least one parseable number)
  const numericCols: boolean[] = new Array(colCount).fill(false);
  for (const bodyRow of bodyRows) {
    for (let c = 0; c < Math.min(bodyRow.children.length, colCount); c++) {
      if (numericCols[c]) continue;
      const text = flattenInlineText(bodyRow.children[c].children);
      if (parseNumeric(text) !== null) numericCols[c] = true;
    }
  }

  // Check if first column is all-numeric — if so, it's still used as labels (as strings)
  // but we include it in the numeric series detection to decide data columns
  const firstColNumeric = numericCols[0];

  // Labels come from first column
  const labels = bodyRows.map((r) => {
    if (r.children.length > 0) {
      return flattenInlineText(r.children[0].children);
    }
    return "";
  });

  // Data series come from columns 1..n that are numeric
  // If first column is numeric, we still use columns 1+ as data series
  const series: ChartData["series"] = [];
  for (let c = 1; c < colCount; c++) {
    if (!numericCols[c]) continue;
    const values = bodyRows.map((r) => {
      if (c < r.children.length) {
        const text = flattenInlineText(r.children[c].children);
        return parseNumeric(text) ?? 0;
      }
      return 0;
    });
    const parsed = parseHeaderUnit(headers[c]);
    series.push({ name: parsed.name, values });
  }

  // If first column is numeric and there are no other numeric columns, use col 0 as single series
  if (series.length === 0 && firstColNumeric) {
    const values = bodyRows.map((r) => {
      if (r.children.length > 0) {
        const text = flattenInlineText(r.children[0].children);
        return parseNumeric(text) ?? 0;
      }
      return 0;
    });
    const parsed = parseHeaderUnit(headers[0]);
    series.push({ name: parsed.name, values });
  }

  if (series.length === 0) return null;

  // Extract x-axis label from first column header
  const xLabel = headers[0];

  // Extract y-axis unit — use shared unit if all numeric columns have the same one
  const units = series.map((_, i) => {
    // Find the original column index for this series
    let seriesIdx = 0;
    for (let c = 1; c < colCount; c++) {
      if (!numericCols[c]) continue;
      if (seriesIdx === i) {
        return parseHeaderUnit(headers[c]).unit;
      }
      seriesIdx++;
    }
    return null;
  });
  const nonNullUnits = units.filter((u): u is string => u !== null);
  const allSameUnit = nonNullUnits.length > 0 && nonNullUnits.every((u) => u === nonNullUnits[0]);
  const yUnit = allSameUnit ? nonNullUnits[0] : null;

  // Y-axis label — use series name when single series, otherwise null
  const yLabel = series.length === 1 ? series[0].name : null;

  // Caption from series names
  const caption = series.map((s) => s.name).join(" / ");

  return { labels, series, xLabel, yLabel, yUnit, caption };
}

// ---------------------------------------------------------------------------
// Chart.js configuration builder
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  "rgba(88, 166, 255, 0.7)",   // blue
  "rgba(63, 185, 80, 0.7)",    // green
  "rgba(210, 153, 34, 0.7)",   // yellow
  "rgba(248, 81, 73, 0.7)",    // red
  "rgba(188, 140, 255, 0.7)",  // purple
  "rgba(255, 166, 87, 0.7)",   // orange
  "rgba(110, 198, 200, 0.7)",  // teal
  "rgba(219, 109, 176, 0.7)",  // pink
];

const CHART_COLORS_SOLID = CHART_COLORS.map((c) => c.replace("0.7)", "1)"));

export interface ChartLabelConfig {
  caption: { show: boolean; text: string };
  xAxis: { show: boolean; text: string };
  yAxis: { show: boolean; text: string };
}

/** Build default label config from chart data (all hidden by default) */
export function defaultLabelConfig(data: ChartData): ChartLabelConfig {
  const yParts = [data.yLabel, data.yUnit ? `(${data.yUnit})` : null].filter(Boolean);
  return {
    caption: { show: false, text: data.caption },
    xAxis: { show: false, text: data.xLabel },
    yAxis: { show: false, text: yParts.join(" ") || "" },
  };
}

export function buildChartConfig(
  data: ChartData,
  chartType: ChartType,
  dark: boolean,
  labels?: ChartLabelConfig,
): ChartConfiguration {
  const textColor = dark ? "#c9d1d9" : "#1f2328";
  const gridColor = dark ? "rgba(110, 118, 129, 0.3)" : "rgba(208, 215, 222, 0.5)";
  const lbl = labels ?? defaultLabelConfig(data);

  const titlePlugin = lbl.caption.show && lbl.caption.text
    ? { title: { display: true, text: lbl.caption.text, color: textColor } }
    : {};

  if (chartType === "pie") {
    return {
      type: "pie",
      data: {
        labels: data.labels,
        datasets: [
          {
            data: data.series[0].values,
            backgroundColor: CHART_COLORS,
            borderColor: dark ? "#0d1117" : "#ffffff",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          ...titlePlugin,
          legend: {
            position: "right",
            labels: { color: textColor },
          },
          tooltip: { enabled: true },
        },
      },
    };
  }

  // bar or line
  const datasets = data.series.map((s, i) => ({
    label: s.name,
    data: s.values,
    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
    borderColor: CHART_COLORS_SOLID[i % CHART_COLORS_SOLID.length],
    borderWidth: chartType === "line" ? 2 : 1,
    ...(chartType === "line" ? { tension: 0.3, fill: false } : {}),
  }));

  return {
    type: chartType,
    data: { labels: data.labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor },
          title: lbl.xAxis.show && lbl.xAxis.text
            ? { display: true, text: lbl.xAxis.text, color: textColor }
            : { display: false },
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor },
          beginAtZero: true,
          position: "left" as const,
          title: lbl.yAxis.show && lbl.yAxis.text
            ? { display: true, text: lbl.yAxis.text, color: textColor, align: "center" as const }
            : { display: false },
        },
      },
      plugins: {
        ...titlePlugin,
        legend: {
          labels: { color: textColor },
        },
        tooltip: { enabled: true },
      },
    },
  } as ChartConfiguration;
}

// ---------------------------------------------------------------------------
// Lazy loading Chart.js
// ---------------------------------------------------------------------------

let chartJsPromise: Promise<typeof import("chart.js")> | null = null;

export function getChartJs() {
  if (!chartJsPromise) {
    chartJsPromise = import("chart.js")
      .then((m) => {
        m.Chart.register(
          m.CategoryScale,
          m.LinearScale,
          m.BarController,
          m.BarElement,
          m.LineController,
          m.LineElement,
          m.PointElement,
          m.PieController,
          m.ArcElement,
          m.Title,
          m.Tooltip,
          m.Legend,
          m.Filler,
        );
        return m;
      })
      .catch((e) => {
        chartJsPromise = null;
        throw e;
      });
  }
  return chartJsPromise;
}
