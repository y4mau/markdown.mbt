///| Luna UI renderer for mdast AST

import type {
  Root,
  RootContent,
  PhrasingContent,
  ListItem,
  TableCell,
  AlignType,
} from "mdast";
import type { Position } from "unist";
// @ts-ignore - no type declarations for syntree_api.js
import { highlight } from "../js/syntree_api.js";
// @ts-ignore - no type declarations for api.js
import { parse } from "../js/api.js";

// =============================================================================
// SVG Sanitizer
// =============================================================================

// Event handler attribute patterns to remove
const EVENT_HANDLER_PATTERN = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// Dangerous elements to remove entirely
const DANGEROUS_ELEMENTS = /<script[^>]*>[\s\S]*?<\/script>/gi;

// javascript: and data: URLs in attributes
const DANGEROUS_URL_PATTERN = /\s+(href|xlink:href|src)\s*=\s*["']?\s*(javascript:|data:text\/html)/gi;

/**
 * Sanitize SVG content by removing event handlers, scripts, and dangerous URLs.
 * This is a lightweight sanitizer for preview purposes.
 */
export function sanitizeSvg(svg: string): string {
  return svg
    // Remove <script> elements
    .replace(DANGEROUS_ELEMENTS, "")
    // Remove event handlers (onclick, onload, etc.)
    .replace(EVENT_HANDLER_PATTERN, "")
    // Remove dangerous URLs
    .replace(DANGEROUS_URL_PATTERN, "");
}

// =============================================================================
// Code Block Language Parser
// =============================================================================

/**
 * Parse language string that may include a mode suffix.
 * e.g., "svg:preview" -> { lang: "svg", mode: "preview" }
 * e.g., "typescript" -> { lang: "typescript", mode: undefined }
 */
export function parseCodeBlockLang(langString: string): { lang: string; mode?: string } {
  const colonIndex = langString.indexOf(":");
  if (colonIndex === -1) {
    return { lang: langString };
  }
  return {
    lang: langString.slice(0, colonIndex),
    mode: langString.slice(colonIndex + 1),
  };
}

// =============================================================================
// Renderer Types
// =============================================================================

// Callbacks for interactive preview (optional - works without callbacks for static rendering)
export interface RendererCallbacks {
  // Task list checkbox toggle
  onTaskToggle?: (span: string, checked: boolean) => void;
  // Element click (future extension)
  onElementClick?: (span: string, nodeType: string) => void;
  // Code block action (future extension: execute, copy, etc.)
  onCodeAction?: (span: string, lang: string, action: string) => void;
}

// Code block handler for custom rendering (e.g., SVG, mermaid, moonlight)
// Return null to fall through to default syntax highlighting
export interface CodeBlockHandler {
  render: (code: string, span: string, key?: string | number, mode?: string, options?: RendererOptions) => JSX.Element | null;
}

// Section range for a heading (used internally)
interface HeadingSectionRange {
  sectionStart: number;
  sectionEnd: number;
}

// Renderer options for customizing rendering behavior
export interface RendererOptions {
  // Custom handlers for specific code block languages
  codeBlockHandlers?: Record<string, CodeBlockHandler>;
  // Raw source text for copy-to-clipboard features
  sourceText?: string;
  // Internal: heading section ranges keyed by span string
  _headingSections?: Map<string, HeadingSectionRange>;
  // Internal: current nesting depth for rendered markdown code blocks
  _markdownNestDepth?: number;
}

// Rewrite relative src/href attributes in raw HTML to use the local asset endpoint
function rewriteRelativeUrls(html: string): string {
  if (!_currentFilePath) return html;
  return html.replace(
    /(\s(?:src|href)=["'])(\.[^"']*)(["'])/gi,
    (_, prefix, url, suffix) => {
      const resolved = resolveAssetUrl(url);
      return `${prefix}${resolved}${suffix}`;
    }
  );
}

// Helper component to render raw HTML using ref callback (exported for custom handlers)
export function RawHtml({ html, ...props }: { html: string } & Record<string, unknown>) {
  return (
    <div
      {...props}
      ref={(el) => {
        if (el) el.innerHTML = rewriteRelativeUrls(html);
      }}
    />
  );
}

// Shared copy button SVG content
const COPY_BTN_SVG =
  '<svg class="icon-copy" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>' +
  '<svg class="icon-check" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

// Generic copy button handler
function handleCopyClick(text: string, e: MouseEvent) {
  e.stopPropagation();
  navigator.clipboard.writeText(text);
  const btn = e.currentTarget as HTMLElement;
  btn.classList.add("copied");
  setTimeout(() => btn.classList.remove("copied"), 2000);
}

// Code block wrapper with copy button
function CodeBlock({ code, children }: { code: string; children: JSX.Element }) {
  return (
    <div class="code-block-wrapper">
      {children}
      <button
        class="copy-btn"
        onMouseDown={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e: MouseEvent) => handleCopyClick(code, e)}
        title="Copy code"
        ref={(el) => { if (el) el.innerHTML = COPY_BTN_SVG; }}
      />
    </div>
  );
}

export const MAX_MARKDOWN_NEST_DEPTH = 3;

// Rendered markdown code block — parses inner content as markdown and renders recursively
export function RenderedMarkdownBlock({
  code,
  span,
  key,
  options,
}: {
  code: string;
  span: string;
  key?: string | number;
  options?: RendererOptions;
}): JSX.Element | null {
  const currentDepth = options?._markdownNestDepth ?? 0;

  let ast: Root;
  try {
    ast = parse(code);
  } catch {
    return null;
  }

  const { sourceText: _, _headingSections: __, ...rest } = options ?? {};
  const nestedOptions: RendererOptions = {
    ...rest,
    _markdownNestDepth: currentDepth + 1,
  };

  return (
    <div class="rendered-markdown-block" data-span={span} data-nest-depth={currentDepth} key={key}>
      {ast.children.map((child: RootContent, i: number) =>
        renderBlock(child, `${key}-nested-${i}`, undefined, nestedOptions)
      ).filter(Boolean)}
      <button
        class="copy-btn"
        onMouseDown={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e: MouseEvent) => handleCopyClick(code, e)}
        title="Copy code"
        ref={(el) => { if (el) el.innerHTML = COPY_BTN_SVG; }}
      />
    </div>
  );
}

// Heading with section copy button
function HeadingWithCopy({
  tag: Tag,
  span,
  sourceText,
  sectionStart,
  sectionEnd,
  children,
  key,
}: {
  tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  span: string;
  sourceText: string;
  sectionStart: number;
  sectionEnd: number;
  children: (JSX.Element | string | null)[];
  key?: string | number;
}) {
  let headingRef: HTMLElement | null = null;
  const sectionText = () => sourceText.slice(sectionStart, sectionEnd);

  const highlightSection = () => {
    headingRef?.closest(".heading-section")?.classList.add("section-highlight");
  };

  const clearHighlight = () => {
    headingRef?.closest(".heading-section")?.classList.remove("section-highlight");
  };

  return (
    <Tag key={key} data-span={span} class="heading-with-copy" ref={(el: HTMLElement) => { headingRef = el; }}>
      {children}
      <button
        class="section-copy-btn"
        onMouseDown={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e: MouseEvent) => handleCopyClick(sectionText(), e)}
        onMouseEnter={highlightSection}
        onMouseLeave={clearHighlight}
        title="Copy section"
        ref={(el) => { if (el) el.innerHTML = COPY_BTN_SVG; }}
      />
    </Tag>
  );
}

// Helper component to render raw HTML in a span
function RawHtmlSpan({ html, ...props }: { html: string } & Record<string, unknown>) {
  return (
    <span
      {...props}
      ref={(el) => {
        if (el) el.innerHTML = rewriteRelativeUrls(html);
      }}
    />
  );
}

// Language alias mapping
const langMap: Record<string, string> = {
  js: "typescript",
  javascript: "typescript",
  ts: "typescript",
  tsx: "typescript",
  jsx: "typescript",
  mbt: "moonbit",
  md: "markdown",
  markdown: "markdown",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  rs: "rust",
  xml: "html",
  svg: "html",
  htm: "html",
};

const supportedLangs = ["typescript", "moonbit", "json", "html", "css", "bash", "rust"];

// Highlight code using syntree
function highlightCode(code: string, lang: string): string | null {
  const mappedLang = langMap[lang] || lang;
  if (!supportedLangs.includes(mappedLang)) {
    return null;
  }
  try {
    return highlight(code, mappedLang);
  } catch (e) {
    console.error("Code highlight error:", e);
    return null;
  }
}

// Helper to get position offset for data-span
function getSpan(node: { position?: Position | undefined }): string {
  const start = node.position?.start?.offset ?? 0;
  const end = node.position?.end?.offset ?? 0;
  return `${start}-${end}`;
}

// Block renderer
export function renderBlock(
  block: RootContent,
  key?: string | number,
  callbacks?: RendererCallbacks,
  options?: RendererOptions
): JSX.Element | null {
  switch (block.type) {
    case "paragraph":
      return (
        <p key={key} data-span={getSpan(block)}>
          {block.children.map((child, i) => renderInline(child, i)).filter(Boolean)}
        </p>
      );

    case "heading": {
      const Tag = `h${block.depth}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      const span = getSpan(block);
      const sectionRange = options?._headingSections?.get(span);
      if (sectionRange && options?.sourceText) {
        return (
          <HeadingWithCopy
            key={key}
            tag={Tag}
            span={span}
            sourceText={options.sourceText}
            sectionStart={sectionRange.sectionStart}
            sectionEnd={sectionRange.sectionEnd}
          >
            {block.children.map((child, i) => renderInline(child, i)).filter(Boolean)}
          </HeadingWithCopy>
        );
      }
      return (
        <Tag key={key} data-span={span}>
          {block.children.map((child, i) => renderInline(child, i)).filter(Boolean)}
        </Tag>
      );
    }

    case "code": {
      const langString = block.lang ?? "";
      const { lang, mode } = parseCodeBlockLang(langString);
      const span = getSpan(block);

      // Check for custom handler first (supports both "svg" and "svg:preview")
      // Handler can return null to fall through to default highlighting
      const handler = options?.codeBlockHandlers?.[lang];
      if (handler) {
        const result = handler.render(block.value, span, key, mode, options);
        if (result !== null) {
          return result;
        }
      }

      const highlighted = lang ? highlightCode(block.value, lang) : null;

      if (highlighted) {
        // Use highlighted HTML from syntree (highlight format)
        return (
          <CodeBlock code={block.value} key={key}>
            <RawHtml
              data-span={span}
              html={highlighted}
            />
          </CodeBlock>
        );
      }

      // Fallback for unsupported languages
      return (
        <CodeBlock code={block.value} key={key}>
          <pre data-span={span}>
            <code class={lang ? `language-${lang}` : undefined}>{block.value}</code>
          </pre>
        </CodeBlock>
      );
    }

    case "blockquote":
      return (
        <blockquote key={key} data-span={getSpan(block)}>
          {block.children.map((child, i) => renderBlock(child, i, callbacks, options)).filter(Boolean)}
        </blockquote>
      );

    case "list": {
      const hasTaskItems = block.children.some((item) => item.checked != null);
      if (block.ordered) {
        return (
          <ol
            key={key}
            start={block.start !== 1 ? block.start ?? undefined : undefined}
            class={hasTaskItems ? "contains-task-list" : undefined}
            data-span={getSpan(block)}
          >
            {block.children.map((item, i) => renderListItem(item, i, callbacks, options)).filter(Boolean)}
          </ol>
        );
      }
      return (
        <ul
          key={key}
          class={hasTaskItems ? "contains-task-list" : undefined}
          data-span={getSpan(block)}
        >
          {block.children.map((item, i) => renderListItem(item, i, callbacks, options)).filter(Boolean)}
        </ul>
      );
    }

    case "thematicBreak":
      return <hr key={key} data-span={getSpan(block)} />;

    case "html":
      return (
        <RawHtml
          key={key}
          data-span={getSpan(block)}
          html={block.value}
        />
      );

    case "table": {
      const [headerRow, ...bodyRows] = block.children;
      const align = block.align ?? [];
      return (
        <table key={key} data-span={getSpan(block)}>
          {headerRow && (
            <thead>
              <tr>
                {headerRow.children.map((cell, i) =>
                  renderTableCell(cell, i, "th", align[i])
                ).filter(Boolean)}
              </tr>
            </thead>
          )}
          {bodyRows.length > 0 && (
            <tbody>
              {bodyRows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.children.map((cell, i) =>
                    renderTableCell(cell, i, "td", align[i])
                  ).filter(Boolean)}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      );
    }

    case "footnoteDefinition":
      return (
        <div
          key={key}
          class="footnote-definition"
          id={`fn-${block.identifier}`}
          data-span={getSpan(block)}
        >
          <sup>{block.label ?? block.identifier}</sup>
          {block.children.map((child, i) => renderBlock(child, i, callbacks, options)).filter(Boolean)}
        </div>
      );

    case "definition":
      // Link definitions don't render visually
      return null;

    default:
      return null;
  }
}

// List item renderer
function renderListItem(
  item: ListItem,
  key: number,
  callbacks?: RendererCallbacks,
  options?: RendererOptions
): JSX.Element {
  const isTask = item.checked != null;

  if (isTask) {
    // Flatten children to avoid nested arrays which Luna doesn't handle well
    const children: JSX.Element[] = [];
    item.children.forEach((child, i) => {
      if (child.type === "paragraph") {
        // Inline the paragraph content for task items
        child.children.forEach((inline, j) => {
          const el = renderInline(inline, `${i}-${j}`);
          if (el) children.push(el);
        });
      } else {
        const el = renderBlock(child, i, callbacks, options);
        if (el) children.push(el);
      }
    });

    const span = getSpan(item);
    const handleChange = callbacks?.onTaskToggle
      ? (e: Event) => {
          const target = e.currentTarget as HTMLInputElement;
          callbacks.onTaskToggle!(span, target.checked);
        }
      : undefined;

    return (
      <li key={key} class="task-list-item" data-span={span}>
        <input
          type="checkbox"
          checked={item.checked ?? false}
          disabled={!callbacks?.onTaskToggle}
          onChange={handleChange}
        />
        {children}
      </li>
    );
  }

  return (
    <li key={key} data-span={getSpan(item)}>
      {item.children.map((child, i) => renderBlock(child, i, callbacks, options)).filter(Boolean)}
    </li>
  );
}

// Table cell renderer
function renderTableCell(
  cell: TableCell,
  key: number,
  Tag: "th" | "td",
  align: AlignType | undefined
): JSX.Element {
  const style = align ? { textAlign: align } : undefined;
  return (
    <Tag key={key} style={style}>
      {cell.children.map((child, i) => renderInline(child, i)).filter(Boolean)}
    </Tag>
  );
}

// Module-level current file path for resolving relative URLs
let _currentFilePath: string | null = null;

export function setCurrentFilePath(fp: string | null): void {
  _currentFilePath = fp;
}

// Resolve a relative URL against the current file's directory via the local asset endpoint
function resolveAssetUrl(url: string): string {
  if (!_currentFilePath) return url;
  if (/^(https?:\/\/|data:|blob:|#|\/)/.test(url)) return url;
  const dir = _currentFilePath.substring(0, _currentFilePath.lastIndexOf("/"));
  const parts = `${dir}/${url}`.split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") { resolved.pop(); continue; }
    resolved.push(part);
  }
  const absolutePath = "/" + resolved.join("/");
  return `/__local-asset?path=${encodeURIComponent(absolutePath)}`;
}

// Inline renderer
export function renderInline(inline: PhrasingContent, key?: string | number): JSX.Element | string | null {
  switch (inline.type) {
    case "text":
      // Check for newline (soft break representation)
      if (inline.value === "\n") {
        return " ";
      }
      return <span key={key}>{inline.value}</span>;

    case "break":
      return <br key={key} />;

    case "emphasis":
      return (
        <em key={key}>
          {inline.children.map((child, i) => renderInline(child, i)).filter(Boolean)}
        </em>
      );

    case "strong":
      return (
        <strong key={key}>
          {inline.children.map((child, i) => renderInline(child, i)).filter(Boolean)}
        </strong>
      );

    case "delete":
      return (
        <del key={key}>
          {inline.children.map((child, i) => renderInline(child, i)).filter(Boolean)}
        </del>
      );

    case "inlineCode":
      return <code key={key}>{inline.value}</code>;

    case "link":
      return (
        <a key={key} href={inline.url} {...(inline.title ? { title: inline.title } : {})}>
          {inline.children.map((child, i) => renderInline(child, i)).filter(Boolean)}
        </a>
      );

    case "linkReference":
      // Reference links should be resolved; for now render as text
      return (
        <span key={key}>
          {inline.children.map((child, i) => renderInline(child, i)).filter(Boolean)}
        </span>
      );

    case "image":
      return (
        <img
          key={key}
          src={resolveAssetUrl(inline.url)}
          alt={inline.alt ?? ""}
          {...(inline.title ? { title: inline.title } : {})}
        />
      );

    case "imageReference":
      // Reference images should be resolved; for now render alt text
      return <span key={key}>[{inline.alt}]</span>;

    case "html":
      return (
        <RawHtmlSpan key={key} html={inline.value} />
      );

    case "footnoteReference":
      return (
        <sup key={key}>
          <a href={`#fn-${inline.identifier}`}>[{inline.label ?? inline.identifier}]</a>
        </sup>
      );

    default:
      return null;
  }
}

// Compute section range for each heading: from heading start to next same-or-higher level heading (or document end)
function computeHeadingSections(children: RootContent[]): Map<string, HeadingSectionRange> {
  const headings: { span: string; depth: number; startOffset: number }[] = [];
  for (const block of children) {
    if (block.type === "heading") {
      const start = block.position?.start?.offset ?? 0;
      const end = block.position?.end?.offset ?? 0;
      headings.push({ span: `${start}-${end}`, depth: block.depth, startOffset: start });
    }
  }

  const lastBlock = children[children.length - 1];
  const docEnd = lastBlock?.position?.end?.offset ?? 0;

  const result = new Map<string, HeadingSectionRange>();
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]!;
    let sectionEnd = docEnd;
    // Find next heading with same or higher (lower number) level
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j]!.depth <= h.depth) {
        sectionEnd = headings[j]!.startOffset;
        break;
      }
    }
    result.set(h.span, { sectionStart: h.startOffset, sectionEnd });
  }
  return result;
}

// Render a block or a <details> group, advancing the index as needed
// Returns [rendered element or null, next index to process]
function renderBlockOrDetails(
  children: RootContent[],
  i: number,
  callbacks: RendererCallbacks | undefined,
  options: RendererOptions | undefined,
): [JSX.Element | null, number] {
  const block = children[i]!;
  if (block.type === "html" && /^<details[\s>]/i.test(block.value.trim())) {
    const endIdx = findDetailsEnd(children, i);
    if (endIdx !== -1) {
      return [renderDetailsGroup(children, i, endIdx, i, callbacks, options), endIdx];
    }
  }
  return [renderBlock(block, i, callbacks, options), i + 1];
}

// Group blocks into heading sections for section-level highlighting
function groupIntoSections(
  children: RootContent[],
  headingSections: Map<string, HeadingSectionRange> | undefined,
  callbacks: RendererCallbacks | undefined,
  options: RendererOptions | undefined,
): JSX.Element[] {
  if (!headingSections || headingSections.size === 0) {
    const result: JSX.Element[] = [];
    let i = 0;
    while (i < children.length) {
      const [rendered, nextI] = renderBlockOrDetails(children, i, callbacks, options);
      if (rendered) result.push(rendered);
      i = nextI;
    }
    return result;
  }

  const result: JSX.Element[] = [];
  let currentSection: JSX.Element[] = [];
  let currentHeadingSpan: string | null = null;
  let sectionIdx = 0;

  const flushSection = () => {
    if (currentSection.length > 0) {
      if (currentHeadingSpan) {
        result.push(
          <div class="heading-section" key={`section-${sectionIdx}`}>
            {currentSection}
          </div>
        );
      } else {
        currentSection.forEach((el) => result.push(el));
      }
      sectionIdx++;
      currentSection = [];
      currentHeadingSpan = null;
    }
  };

  let i = 0;
  while (i < children.length) {
    const block = children[i]!;
    if (block.type === "heading") {
      const span = getSpan(block);
      if (headingSections.has(span)) {
        flushSection();
        currentHeadingSpan = span;
      }
    }
    const [rendered, nextI] = renderBlockOrDetails(children, i, callbacks, options);
    if (rendered) currentSection.push(rendered);
    i = nextI;
  }
  flushSection();

  return result;
}

// Detect <details> opening html block and find matching </details>
// Returns the index past the closing </details>, or -1 if not found
function findDetailsEnd(children: RootContent[], startIdx: number): number {
  let depth = 1;
  for (let j = startIdx + 1; j < children.length; j++) {
    const next = children[j]!;
    if (next.type === "html") {
      const trimmed = next.value.trim();
      if (/^<details[\s>]/i.test(trimmed)) depth++;
      if (/<\/details\s*>/i.test(trimmed)) depth--;
      if (depth === 0) return j + 1;
    }
  }
  return -1;
}

// Helper: render raw HTML as a <summary> element (must be direct child of <details>)
function RawSummary({ html, ...props }: { html: string } & Record<string, unknown>) {
  return (
    <summary
      {...props}
      ref={(el: HTMLElement) => {
        if (el) el.innerHTML = html;
      }}
    />
  );
}

// Render a <details> group: opening html + inner blocks + closing html
function renderDetailsGroup(
  children: RootContent[],
  startIdx: number,
  endIdx: number,
  keyPrefix: string | number,
  callbacks?: RendererCallbacks,
  options?: RendererOptions,
): JSX.Element {
  const openBlock = children[startIdx]!;
  const openHtml = (openBlock as { value: string }).value;

  // Extract <summary>...</summary> from the opening html
  const summaryMatch = openHtml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);

  // Check for open attribute on <details>
  const isOpen = /<details[^>]*\bopen\b/i.test(openHtml);

  // Inner blocks (between opening and closing html)
  const innerBlocks = children.slice(startIdx + 1, endIdx - 1);

  // Build the data-span covering the entire details range
  const startOffset = openBlock.position?.start?.offset ?? 0;
  const endOffset = children[endIdx - 1]!.position?.end?.offset ?? 0;
  const span = `${startOffset}-${endOffset}`;

  return (
    <details key={keyPrefix} data-span={span} open={isOpen || undefined}>
      {summaryMatch ? (
        <RawSummary html={summaryMatch[1]!} />
      ) : null}
      {(() => {
        const rendered: JSX.Element[] = [];
        let idx = 0;
        while (idx < innerBlocks.length) {
          const block = innerBlocks[idx]!;
          if (block.type === "html" && /^<details[\s>]/i.test(block.value.trim())) {
            // Adjust indices relative to innerBlocks array
            const endIdx = findDetailsEnd(innerBlocks, idx);
            if (endIdx !== -1) {
              const el = renderDetailsGroup(innerBlocks, idx, endIdx, `${keyPrefix}-inner-${idx}`, callbacks, options);
              rendered.push(el);
              idx = endIdx;
              continue;
            }
          }
          const el = renderBlock(block, `${keyPrefix}-inner-${idx}`, callbacks, options);
          if (el) rendered.push(el);
          idx++;
        }
        return rendered;
      })()}
    </details>
  );
}

// Document renderer component
export function MarkdownRenderer({
  ast,
  callbacks,
  options,
}: {
  ast: Root;
  callbacks?: RendererCallbacks;
  options?: RendererOptions;
}) {
  if (!ast) return null;

  const sourceText = options?.sourceText;

  const optionsWithSections = sourceText
    ? { ...options, _headingSections: computeHeadingSections(ast.children) }
    : options;

  return (
    <div class="markdown-body" data-span={getSpan(ast)}>
      {groupIntoSections(ast.children, optionsWithSections?._headingSections, callbacks, optionsWithSections)}
    </div>
  );
}
