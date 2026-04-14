/**
 * Diff-style line highlighting for code blocks.
 *
 * Supports:
 * - ```diff         — plain text with line-type coloring
 * - ```lang:diff    — syntax highlighted code with line-type coloring
 *
 * Line types: add (+), remove (-), hunk (@@), header (---/+++/Index:), context
 */

type DiffLineType = "add" | "remove" | "hunk" | "header" | "context";

export function classifyDiffLine(text: string): DiffLineType {
  if (text.startsWith("@@") && text.includes("@@", 2)) return "hunk";
  if (text.startsWith("Index: ")) return "header";
  if (text.startsWith("===")) return "header";
  if (text.startsWith("diff --git")) return "header";
  if (text.startsWith("--- ")) return "header";
  if (text.startsWith("+++ ")) return "header";
  if (text.startsWith("+")) return "add";
  if (text.startsWith("-")) return "remove";
  return "context";
}

function diffLineCssClass(type: DiffLineType): string {
  switch (type) {
    case "add":
      return "line diff-line diff-line-add";
    case "remove":
      return "line diff-line diff-line-remove";
    case "hunk":
      return "line diff-line diff-line-hunk";
    case "header":
      return "line diff-line diff-line-header";
    case "context":
      return "line diff-line";
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render plain diff code (no syntax highlighting) with diff line classes.
 * Used for standalone ```diff blocks.
 */
export function renderDiffPlain(code: string): string {
  const lines = code.split("\n");
  const lineSpans = lines.map((line) => {
    const type = classifyDiffLine(line);
    const cls = diffLineCssClass(type);
    const escaped = escapeHtml(line);
    return `<span class="${cls}"><span>${escaped}</span></span>`;
  });
  return `<pre class="highlight" style="background-color: #0d1117; color: #c9d1d9"><code>${lineSpans.join("")}</code></pre>`;
}

/**
 * Post-process syntax-highlighted HTML to add diff line classes.
 * Used for ```lang:diff blocks where syntree already highlighted the code.
 */
export function applyDiffHighlighting(html: string): string {
  const codeMatch = html.match(
    /^([\s\S]*<code>)([\s\S]*?)(<\/code>[\s\S]*)$/,
  );
  if (!codeMatch) return html;

  const [, prefix, codeContent, suffix] = codeMatch;

  const lines = codeContent!.split("\n");
  const processedLines = lines.map((line) => {
    if (!line.startsWith('<span class="line">')) return line;

    const textContent = line.replace(/<[^>]+>/g, "");
    const type = classifyDiffLine(textContent);
    const cls = diffLineCssClass(type);
    return line.replace('<span class="line">', `<span class="${cls}">`);
  });

  return prefix + processedLines.join("") + suffix;
}
