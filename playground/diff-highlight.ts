/**
 * Diff-style line highlighting for code blocks.
 *
 * Supports:
 * - ```diff — plain text with +/- line coloring
 * - ```lang:diff — syntax highlighted code with +/- line coloring
 */

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
    const escaped = escapeHtml(line);
    const cls = diffLineClass(line);
    return `<span class="${cls}"><span>${escaped}</span></span>`;
  });
  return `<pre class="highlight" style="background-color: #0d1117; color: #c9d1d9"><code>${lineSpans.join("\n")}</code></pre>`;
}

/**
 * Post-process syntax-highlighted HTML to add diff line classes.
 * Used for ```lang:diff blocks where syntree already highlighted the code.
 */
export function applyDiffHighlighting(html: string): string {
  const codeMatch = html.match(/^([\s\S]*<code>)([\s\S]*?)(<\/code>[\s\S]*)$/);
  if (!codeMatch) return html;

  const [, prefix, codeContent, suffix] = codeMatch;

  const lines = codeContent.split("\n");
  const processedLines = lines.map((line) => {
    if (!line.startsWith('<span class="line">')) return line;

    const textContent = line.replace(/<[^>]+>/g, "");
    const cls = diffLineClass(textContent);
    return line.replace('<span class="line">', `<span class="${cls}">`);
  });

  return prefix + processedLines.join("\n") + suffix;
}

function diffLineClass(text: string): string {
  const first = text.charAt(0);
  if (first === "+") return "line diff-line diff-line-add";
  if (first === "-") return "line diff-line diff-line-remove";
  return "line diff-line";
}
