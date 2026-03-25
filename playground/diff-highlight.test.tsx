import { describe, it, expect } from "vitest";
import { escapeHtml, renderDiffPlain, applyDiffHighlighting } from "./diff-highlight";

describe("escapeHtml", () => {
  it("passes through plain text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("escapes &, <, >, \"", () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot;"
    );
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("renderDiffPlain", () => {
  it("wraps + lines with diff-line-add class", () => {
    const html = renderDiffPlain("+added line");
    expect(html).toContain('class="line diff-line diff-line-add"');
    expect(html).toContain("+added line");
  });

  it("wraps - lines with diff-line-remove class", () => {
    const html = renderDiffPlain("-removed line");
    expect(html).toContain('class="line diff-line diff-line-remove"');
    expect(html).toContain("-removed line");
  });

  it("wraps context lines with just diff-line class", () => {
    const html = renderDiffPlain(" context line");
    expect(html).toContain('class="line diff-line"');
    expect(html).not.toContain("diff-line-add");
    expect(html).not.toContain("diff-line-remove");
  });

  it("handles mixed content with all line types", () => {
    const code = "@@ -1,3 +1,3 @@\n-old\n+new\n context";
    const html = renderDiffPlain(code);
    expect(html).toContain('class="line diff-line"'); // @@ header
    expect(html).toContain('class="line diff-line diff-line-remove"');
    expect(html).toContain('class="line diff-line diff-line-add"');
  });

  it("escapes HTML entities in code", () => {
    const html = renderDiffPlain("+<div>&</div>");
    expect(html).toContain("&lt;div&gt;&amp;&lt;/div&gt;");
  });

  it("handles empty input", () => {
    const html = renderDiffPlain("");
    expect(html).toContain("<pre");
    expect(html).toContain("</pre>");
  });

  it("wraps output in pre > code structure", () => {
    const html = renderDiffPlain("+line");
    expect(html).toMatch(/^<pre class="highlight".*<code>.*<\/code><\/pre>$/s);
  });
});

describe("applyDiffHighlighting", () => {
  // Simulates syntree output format
  const makeSyntreeHtml = (lines: string[]) => {
    const lineSpans = lines
      .map((l) => `<span class="line"><span style="color: #c9d1d9">${l}</span></span>`)
      .join("\n");
    return `<pre class="highlight" style="background-color: #0d1117; color: #c9d1d9"><code>${lineSpans}</code></pre>`;
  };

  it("adds diff-line-add class to lines whose text starts with +", () => {
    const html = makeSyntreeHtml(["+added"]);
    const result = applyDiffHighlighting(html);
    expect(result).toContain('class="line diff-line diff-line-add"');
  });

  it("adds diff-line-remove class to lines whose text starts with -", () => {
    const html = makeSyntreeHtml(["-removed"]);
    const result = applyDiffHighlighting(html);
    expect(result).toContain('class="line diff-line diff-line-remove"');
  });

  it("leaves non-diff lines with just diff-line class", () => {
    const html = makeSyntreeHtml(["context"]);
    const result = applyDiffHighlighting(html);
    expect(result).toContain('class="line diff-line"');
    expect(result).not.toContain("diff-line-add");
    expect(result).not.toContain("diff-line-remove");
  });

  it("handles mixed lines correctly", () => {
    const html = makeSyntreeHtml(["+add", "-remove", " context"]);
    const result = applyDiffHighlighting(html);
    expect(result).toContain('class="line diff-line diff-line-add"');
    expect(result).toContain('class="line diff-line diff-line-remove"');
    // The context line should have just diff-line
    const lines = result.split("\n");
    expect(lines[2]).toContain('class="line diff-line"');
    expect(lines[2]).not.toContain("diff-line-add");
    expect(lines[2]).not.toContain("diff-line-remove");
  });

  it("preserves existing HTML structure (nested spans)", () => {
    const html = makeSyntreeHtml(["+added"]);
    const result = applyDiffHighlighting(html);
    expect(result).toContain('<span style="color: #c9d1d9">+added</span>');
  });

  it("returns unchanged HTML if no <code> found", () => {
    const html = "<div>no code here</div>";
    const result = applyDiffHighlighting(html);
    expect(result).toBe(html);
  });

  it("handles nested spans with HTML entities", () => {
    const lineSpans = `<span class="line"><span style="color: #ff7b72">+</span><span style="color: #c9d1d9">&lt;div&gt;</span></span>`;
    const html = `<pre class="highlight"><code>${lineSpans}</code></pre>`;
    const result = applyDiffHighlighting(html);
    expect(result).toContain('class="line diff-line diff-line-add"');
  });
});
