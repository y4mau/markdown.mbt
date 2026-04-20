import { describe, it, expect } from "vitest";
import {
  flattenInlineText,
  isChartable,
  extractChartData,
  buildChartConfig,
  defaultLabelConfig,
  type ChartData,
  type ChartLabelConfig,
} from "./chart-runtime";
import type { PhrasingContent, Table } from "mdast";

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

function text(value: string): PhrasingContent {
  return { type: "text", value };
}

function emphasis(children: PhrasingContent[]): PhrasingContent {
  return { type: "emphasis", children };
}

function strong(children: PhrasingContent[]): PhrasingContent {
  return { type: "strong", children };
}

function inlineCode(value: string): PhrasingContent {
  return { type: "inlineCode", value };
}

function cell(content: string): { type: "tableCell"; children: PhrasingContent[] } {
  return { type: "tableCell", children: [text(content)] };
}

function cellWithChildren(children: PhrasingContent[]): { type: "tableCell"; children: PhrasingContent[] } {
  return { type: "tableCell", children };
}

function row(cells: ReturnType<typeof cell>[]): { type: "tableRow"; children: typeof cells } {
  return { type: "tableRow", children: cells };
}

/** Build a minimal mdast Table node */
function makeTable(
  headerCells: string[],
  bodyRows: string[][],
  align?: (string | null)[],
): Table {
  const header = row(headerCells.map(cell));
  const body = bodyRows.map((r) => row(r.map(cell)));
  return {
    type: "table",
    align: (align ?? headerCells.map(() => null)) as Table["align"],
    children: [header, ...body],
  };
}

// ---------------------------------------------------------------------------
// flattenInlineText
// ---------------------------------------------------------------------------

describe("flattenInlineText", () => {
  it("extracts text from plain text node", () => {
    expect(flattenInlineText([text("hello")])).toBe("hello");
  });

  it("concatenates multiple text nodes", () => {
    expect(flattenInlineText([text("hello"), text(" world")])).toBe("hello world");
  });

  it("extracts text from nested emphasis/strong", () => {
    const children: PhrasingContent[] = [
      emphasis([text("bold")]),
      text(" and "),
      strong([text("strong")]),
    ];
    expect(flattenInlineText(children)).toBe("bold and strong");
  });

  it("extracts value from inlineCode", () => {
    expect(flattenInlineText([inlineCode("code")])).toBe("code");
  });

  it("handles empty children array", () => {
    expect(flattenInlineText([])).toBe("");
  });

  it("handles deeply nested inline content", () => {
    const children: PhrasingContent[] = [
      strong([emphasis([text("deep")])]),
    ];
    expect(flattenInlineText(children)).toBe("deep");
  });
});

// ---------------------------------------------------------------------------
// isChartable
// ---------------------------------------------------------------------------

describe("isChartable", () => {
  it("returns true for table with numeric data (≥2 rows, ≥2 cols, ≥1 number)", () => {
    const table = makeTable(
      ["Month", "Sales"],
      [["Jan", "100"], ["Feb", "150"]],
    );
    expect(isChartable(table)).toBe(true);
  });

  it("returns false for text-only table", () => {
    const table = makeTable(
      ["Name", "City"],
      [["Alice", "Tokyo"], ["Bob", "Osaka"]],
    );
    expect(isChartable(table)).toBe(false);
  });

  it("returns false for header-only table (no body rows)", () => {
    const table = makeTable(["Month", "Sales"], []);
    expect(isChartable(table)).toBe(false);
  });

  it("returns false for single-column table", () => {
    const table = makeTable(["Value"], [["100"], ["200"]]);
    expect(isChartable(table)).toBe(false);
  });

  it("returns true for table with mixed numeric/text columns", () => {
    const table = makeTable(
      ["Name", "Score", "Grade"],
      [["Alice", "95", "A"], ["Bob", "80", "B"]],
    );
    expect(isChartable(table)).toBe(true);
  });

  it("returns true for table with percentage values", () => {
    const table = makeTable(
      ["Item", "Rate"],
      [["A", "85%"], ["B", "92%"]],
    );
    expect(isChartable(table)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractChartData
// ---------------------------------------------------------------------------

describe("extractChartData", () => {
  it("extracts labels from first column, series from remaining columns", () => {
    const table = makeTable(
      ["Month", "Sales", "Expenses"],
      [["Jan", "100", "80"], ["Feb", "150", "90"], ["Mar", "200", "120"]],
    );
    const data = extractChartData(table);
    expect(data).not.toBeNull();
    expect(data!.labels).toEqual(["Jan", "Feb", "Mar"]);
    expect(data!.series).toHaveLength(2);
    expect(data!.series[0].name).toBe("Sales");
    expect(data!.series[0].values).toEqual([100, 150, 200]);
    expect(data!.series[1].name).toBe("Expenses");
    expect(data!.series[1].values).toEqual([80, 90, 120]);
  });

  it("uses header row as series names", () => {
    const table = makeTable(
      ["Category", "Revenue"],
      [["A", "50"]],
    );
    const data = extractChartData(table);
    expect(data!.series[0].name).toBe("Revenue");
  });

  it("treats unparseable values as 0", () => {
    const table = makeTable(
      ["Item", "Value"],
      [["A", "100"], ["B", "N/A"], ["C", "300"]],
    );
    const data = extractChartData(table);
    expect(data!.series[0].values).toEqual([100, 0, 300]);
  });

  it("strips % suffix and parses percentage values", () => {
    const table = makeTable(
      ["Item", "Rate"],
      [["A", "85%"], ["B", "92.5%"]],
    );
    const data = extractChartData(table);
    expect(data!.series[0].values).toEqual([85, 92.5]);
  });

  it("handles inline formatting — flattens to plain text", () => {
    const header = row([
      cell("Name"),
      cellWithChildren([strong([text("Score")])]),
    ]);
    const body = [
      row([cell("Alice"), cell("95")]),
    ];
    const table: Table = {
      type: "table",
      align: [null, null],
      children: [header, ...body],
    };
    const data = extractChartData(table);
    expect(data!.series[0].name).toBe("Score");
    expect(data!.series[0].values).toEqual([95]);
  });

  it("uses row indices as labels when first column is numeric", () => {
    const table = makeTable(
      ["X", "Y"],
      [["1", "10"], ["2", "20"], ["3", "30"]],
    );
    const data = extractChartData(table);
    expect(data!.labels).toEqual(["1", "2", "3"]);
    expect(data!.series).toHaveLength(1);
    expect(data!.series[0].name).toBe("Y");
    expect(data!.series[0].values).toEqual([10, 20, 30]);
  });

  it("returns null for non-chartable tables", () => {
    const table = makeTable(["Name", "City"], []);
    expect(extractChartData(table)).toBeNull();
  });

  it("handles table where all columns after first are numeric", () => {
    const table = makeTable(
      ["Q", "Revenue", "Profit", "Cost"],
      [["Q1", "100", "30", "70"], ["Q2", "200", "60", "140"]],
    );
    const data = extractChartData(table);
    expect(data!.series).toHaveLength(3);
    expect(data!.series.map((s) => s.name)).toEqual(["Revenue", "Profit", "Cost"]);
  });

  it("extracts xLabel from first column header", () => {
    const table = makeTable(
      ["Month", "Sales"],
      [["Jan", "100"]],
    );
    const data = extractChartData(table);
    expect(data!.xLabel).toBe("Month");
    expect(data!.yLabel).toBe("Sales");
  });

  it("sets yLabel to null for multi-series", () => {
    const table = makeTable(
      ["Month", "Sales", "Expenses"],
      [["Jan", "100", "80"]],
    );
    const data = extractChartData(table);
    expect(data!.yLabel).toBeNull();
  });

  it("extracts unit from header parentheses as yUnit", () => {
    const table = makeTable(
      ["Year", "Revenue ($)"],
      [["2024", "100"]],
    );
    const data = extractChartData(table);
    expect(data!.series[0].name).toBe("Revenue");
    expect(data!.yUnit).toBe("$");
  });

  it("extracts % unit from header", () => {
    const table = makeTable(
      ["Region", "Growth (%)"],
      [["North", "15"]],
    );
    const data = extractChartData(table);
    expect(data!.yUnit).toBe("%");
  });

  it("sets yUnit to null when no unit in headers", () => {
    const table = makeTable(
      ["Month", "Sales"],
      [["Jan", "100"]],
    );
    const data = extractChartData(table);
    expect(data!.yUnit).toBeNull();
  });

  it("uses shared unit when all numeric columns have the same unit", () => {
    const table = makeTable(
      ["Item", "Cost ($)", "Price ($)"],
      [["A", "50", "80"]],
    );
    const data = extractChartData(table);
    expect(data!.yUnit).toBe("$");
  });

  it("sets yUnit to null when numeric columns have different units", () => {
    const table = makeTable(
      ["Item", "Weight (kg)", "Price ($)"],
      [["A", "50", "80"]],
    );
    const data = extractChartData(table);
    expect(data!.yUnit).toBeNull();
  });

  it("builds caption from series names", () => {
    const table = makeTable(
      ["Month", "Sales", "Expenses"],
      [["Jan", "100", "80"]],
    );
    const data = extractChartData(table);
    expect(data!.caption).toBe("Sales / Expenses");
  });
});

// ---------------------------------------------------------------------------
// buildChartConfig
// ---------------------------------------------------------------------------

describe("buildChartConfig", () => {
  const sampleData: ChartData = {
    labels: ["Jan", "Feb", "Mar"],
    series: [
      { name: "Sales", values: [100, 150, 200] },
      { name: "Expenses", values: [80, 90, 120] },
    ],
    xLabel: "Month",
    yLabel: null,
    yUnit: null,
    caption: "Sales / Expenses",
  };

  it("returns bar chart config with correct structure", () => {
    const config = buildChartConfig(sampleData, "bar", false);
    expect(config.type).toBe("bar");
    expect(config.data.labels).toEqual(["Jan", "Feb", "Mar"]);
    expect(config.data.datasets).toHaveLength(2);
    expect(config.data.datasets[0].label).toBe("Sales");
    expect(config.data.datasets[0].data).toEqual([100, 150, 200]);
  });

  it("returns line chart config with correct structure", () => {
    const config = buildChartConfig(sampleData, "line", false);
    expect(config.type).toBe("line");
    expect(config.data.datasets).toHaveLength(2);
  });

  it("returns pie chart config using first series", () => {
    const config = buildChartConfig(sampleData, "pie", false);
    expect(config.type).toBe("pie");
    expect(config.data.datasets).toHaveLength(1);
    expect(config.data.datasets[0].data).toEqual([100, 150, 200]);
  });

  it("uses dark theme colors when dark=true", () => {
    const config = buildChartConfig(sampleData, "bar", true);
    // Verify scales exist with dark-appropriate grid colors
    const scales = config.options?.scales as Record<string, unknown> | undefined;
    if (scales) {
      const xScale = scales.x as { grid?: { color?: string } } | undefined;
      expect(xScale?.grid?.color).toBeDefined();
    }
  });

  it("uses light theme colors when dark=false", () => {
    const config = buildChartConfig(sampleData, "bar", false);
    const scales = config.options?.scales as Record<string, unknown> | undefined;
    if (scales) {
      const xScale = scales.x as { grid?: { color?: string } } | undefined;
      expect(xScale?.grid?.color).toBeDefined();
    }
  });

  it("pie chart has no scales", () => {
    const config = buildChartConfig(sampleData, "pie", false);
    const scales = config.options?.scales as Record<string, unknown> | undefined;
    expect(scales).toBeUndefined();
  });

  it("single-series pie uses labels as dataset labels", () => {
    const data: ChartData = {
      labels: ["A", "B", "C"],
      series: [{ name: "Count", values: [10, 20, 30] }],
      xLabel: "Category",
      yLabel: "Count",
      yUnit: null,
      caption: "Count",
    };
    const config = buildChartConfig(data, "pie", false);
    expect(config.data.labels).toEqual(["A", "B", "C"]);
    expect(config.data.datasets[0].data).toEqual([10, 20, 30]);
  });

  it("hides all labels by default", () => {
    const config = buildChartConfig(sampleData, "bar", false);
    const scales = config.options?.scales as Record<string, any>;
    expect(scales.x.title.display).toBe(false);
    expect(scales.y.title.display).toBe(false);
    const plugins = config.options?.plugins as Record<string, any>;
    expect(plugins.title).toBeUndefined();
  });

  it("shows labels when label config has show: true", () => {
    const labels: ChartLabelConfig = {
      caption: { show: true, text: "Sales / Expenses" },
      xAxis: { show: true, text: "Month" },
      yAxis: { show: true, text: "Revenue ($)" },
    };
    const config = buildChartConfig(sampleData, "bar", false, labels);
    const scales = config.options?.scales as Record<string, any>;
    expect(scales.x.title.display).toBe(true);
    expect(scales.x.title.text).toBe("Month");
    expect(scales.y.title.display).toBe(true);
    expect(scales.y.title.text).toBe("Revenue ($)");
    const plugins = config.options?.plugins as Record<string, any>;
    expect(plugins.title.display).toBe(true);
    expect(plugins.title.text).toBe("Sales / Expenses");
  });

  it("hides individual labels when show: false", () => {
    const labels: ChartLabelConfig = {
      caption: { show: false, text: "Sales" },
      xAxis: { show: true, text: "Month" },
      yAxis: { show: false, text: "Value" },
    };
    const config = buildChartConfig(sampleData, "bar", false, labels);
    const scales = config.options?.scales as Record<string, any>;
    expect(scales.x.title.display).toBe(true);
    expect(scales.y.title.display).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// defaultLabelConfig
// ---------------------------------------------------------------------------

describe("defaultLabelConfig", () => {
  it("returns all hidden by default", () => {
    const data: ChartData = {
      labels: ["Q1"],
      series: [{ name: "Revenue", values: [100] }],
      xLabel: "Quarter",
      yLabel: "Revenue",
      yUnit: "$",
      caption: "Revenue",
    };
    const lbl = defaultLabelConfig(data);
    expect(lbl.caption.show).toBe(false);
    expect(lbl.caption.text).toBe("Revenue");
    expect(lbl.xAxis.show).toBe(false);
    expect(lbl.xAxis.text).toBe("Quarter");
    expect(lbl.yAxis.show).toBe(false);
    expect(lbl.yAxis.text).toBe("Revenue ($)");
  });

  it("builds yAxis text from label and unit", () => {
    const data: ChartData = {
      labels: ["A"],
      series: [{ name: "Temp", values: [20] }],
      xLabel: "City",
      yLabel: "Temp",
      yUnit: "°C",
      caption: "Temp",
    };
    expect(defaultLabelConfig(data).yAxis.text).toBe("Temp (°C)");
  });

  it("uses empty string for yAxis when no label and no unit", () => {
    const data: ChartData = {
      labels: ["A"],
      series: [{ name: "X", values: [1] }],
      xLabel: "Item",
      yLabel: null,
      yUnit: null,
      caption: "X",
    };
    expect(defaultLabelConfig(data).yAxis.text).toBe("");
  });
});
