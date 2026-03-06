import { render, createSignal, createEffect, createMemo, onMount, onCleanup, Show, batch } from "@luna_ui/luna";
import { parse } from "../js/api.js";
import type { Root } from "mdast";
import { MarkdownRenderer, RawHtml, sanitizeSvg, type RendererCallbacks, type RendererOptions } from "./ast-renderer";
import { SyntaxHighlightEditor, type SyntaxHighlightEditorHandle } from "./SyntaxHighlightEditor";
import { MoonlightEditor } from "./MoonlightEditor";
import { handlePasteAsLink } from "./paste-url-as-link";
import { MermaidDiagram } from "./MermaidDiagram";

// IndexedDB for content (reliable async storage)
const IDB_NAME = "markdown-editor";
const IDB_STORE = "documents";
const IDB_KEY = "current";

// localStorage for UI state (sync access for initial render)
const UI_STATE_KEY = "markdown-editor-ui";
const DEBOUNCE_DELAY = 300;

const initialMarkdown = `# markdown.mbt Playground

A high-performance Markdown parser written in [MoonBit](https://www.moonbitlang.com/), compiled to WebAssembly.

## Features

- **Blazing Fast**: MoonBit compiles to efficient WASM for near-native performance
- **Syntax Highlighting**: Integrated code highlighting powered by Lezer
- **Live Preview**: Real-time Markdown rendering as you type
- **Auto Save**: Your content is automatically saved to browser storage (IndexedDB)

## Code Example

\`\`\`typescript
// Syntax highlighting works for multiple languages
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

\`\`\`rust
fn main() {
    println!("Hello from Rust!");
}
\`\`\`

## Markdown Support

- **Bold** and *italic* text
- [Links](https://github.com/y4mau/markdown.mbt)
- \`inline code\`
- > Blockquotes

## SVG Preview

Edit the SVG below and see live preview:

\`\`\`svg
<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="80" height="80" fill="#4a90d9" rx="8"/>
  <circle cx="150" cy="50" r="40" fill="#e74c3c"/>
  <text x="100" y="95" text-anchor="middle" fill="#333" font-size="12">Edit me!</text>
</svg>
\`\`\`

## Moonlight SVG Editor

Interactive SVG editing with [Moonlight](https://github.com/mizchi/moonlight):

\`\`\`moonlight-svg
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="120" height="80" fill="#3498db" rx="10"/>
  <circle cx="280" cy="90" r="50" fill="#e74c3c"/>
  <polygon points="200,200 150,280 250,280" fill="#2ecc71"/>
</svg>
\`\`\`

## Mermaid Diagram

\`\`\`mermaid
graph TD
    A[Parse Markdown] --> B{Block or Inline?}
    B -- Block --> C[Block Parser]
    B -- Inline --> D[Inline Parser]
    C --> E[CST Node]
    D --> E
\`\`\`

## Interactive Task List

Click the checkboxes below - they update the source in real-time!

- [ ] Try clicking this checkbox
- [x] This one is already checked
- [ ] Interactive editing from preview

---

Source: [github.com/y4mau/markdown.mbt](https://github.com/y4mau/markdown.mbt)
`;

// IndexedDB helpers
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

async function saveToIDB(content: string): Promise<number> {
  const db = await openDB();
  const timestamp = Date.now();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const request = store.put({ content, timestamp }, IDB_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(timestamp);
    tx.oncomplete = () => db.close();
  });
}

async function loadFromIDB(): Promise<{ content: string; timestamp: number } | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const request = store.get(IDB_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

// Mobile detection
function isMobile(): boolean {
  return window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// UI State helpers (localStorage for sync access)
interface UIState {
  viewMode: "split" | "editor" | "preview";
  editorMode: "highlight" | "simple";
  cursorPosition: number;
}

function loadUIState(): UIState {
  const mobile = isMobile();
  try {
    const saved = localStorage.getItem(UI_STATE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // On mobile, force editor-only mode if split was saved
      const viewMode = mobile && parsed.viewMode === "split" ? "editor" : (parsed.viewMode || (mobile ? "editor" : "split"));
      // On mobile, default to simple editor
      const editorMode = parsed.editorMode || (mobile ? "simple" : "highlight");
      return {
        viewMode,
        editorMode,
        cursorPosition: parsed.cursorPosition || 0,
      };
    }
  } catch {
    // ignore parse errors
  }
  // Default: mobile uses editor-only + simple, desktop uses split + highlight
  return {
    viewMode: mobile ? "editor" : "split",
    editorMode: mobile ? "simple" : "highlight",
    cursorPosition: 0,
  };
}

function saveUIState(state: Partial<UIState>): void {
  try {
    const current = loadUIState();
    const updated = { ...current, ...state };
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

// Find block element at cursor position
function findBlockAtPosition(ast: Root, position: number): number | null {
  for (let i = 0; i < ast.children.length; i++) {
    const block = ast.children[i]!;
    const start = block.position?.start?.offset ?? 0;
    const end = block.position?.end?.offset ?? 0;
    if (position >= start && position <= end) {
      return i;
    }
  }
  // If position is beyond all blocks, return the last block
  const lastBlock = ast.children[ast.children.length - 1];
  const lastEnd = lastBlock?.position?.end?.offset ?? 0;
  if (ast.children.length > 0 && lastBlock && position >= lastEnd) {
    return ast.children.length - 1;
  }
  return null;
}

type ViewMode = "split" | "editor" | "preview";
type EditorMode = "highlight" | "simple";

// Simple editor component (created once, updated via effect)
function SimpleEditor(props: {
  value: () => string;
  onChange: (value: string) => void;
  onCursorChange?: (position: number) => void;
  ref?: (el: HTMLTextAreaElement) => void;
}) {
  let textareaRef: HTMLTextAreaElement | null = null;

  const setupTextarea = (el: HTMLTextAreaElement) => {
    textareaRef = el;
    el.value = props.value();
    props.ref?.(el);
  };

  createEffect(() => {
    const value = props.value();
    if (textareaRef && textareaRef.value !== value) {
      textareaRef.value = value;
    }
  });

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    props.onChange(target.value);
    props.onCursorChange?.(target.selectionStart);
  };

  const handleCursorUpdate = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    props.onCursorChange?.(target.selectionStart);
  };

  const handlePaste = (e: ClipboardEvent) => {
    const target = e.target as HTMLTextAreaElement;
    if (handlePasteAsLink(e, target)) {
      props.onChange(target.value);
      props.onCursorChange?.(target.selectionStart);
    }
  };

  return (
    <textarea
      ref={setupTextarea}
      class="simple-editor"
      onInput={handleInput}
      onPaste={handlePaste}
      onKeyUp={handleCursorUpdate}
      onClick={handleCursorUpdate}
      spellcheck={false}
    />
  );
}

// SVG Icons
function Icon(props: { svg: string }) {
  return <span dangerouslySetInnerHTML={{ __html: props.svg }} style={{ display: "flex", alignItems: "center" }} />;
}

const SPLIT_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
  <rect x="1" y="2" width="8" height="16" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
  <rect x="11" y="2" width="8" height="16" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
</svg>`;

const EDITOR_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
  <rect x="2" y="2" width="16" height="16" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
  <line x1="5" y1="6" x2="15" y2="6" stroke="currentColor" stroke-width="1.5"/>
  <line x1="5" y1="10" x2="12" y2="10" stroke="currentColor" stroke-width="1.5"/>
  <line x1="5" y1="14" x2="14" y2="14" stroke="currentColor" stroke-width="1.5"/>
</svg>`;

const PREVIEW_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
  <rect x="2" y="2" width="16" height="16" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
  <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/>
  <path d="M4 10 Q7 5, 10 5 Q13 5, 16 10 Q13 15, 10 15 Q7 15, 4 10" stroke="currentColor" stroke-width="1.5" fill="none"/>
</svg>`;

const HIGHLIGHT_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none">
  <text x="2" y="14" font-size="12" fill="#d73a49" font-family="monospace" font-weight="bold">&lt;</text>
  <text x="8" y="14" font-size="12" fill="#22863a" font-family="monospace">/</text>
  <text x="12" y="14" font-size="12" fill="#0366d6" font-family="monospace" font-weight="bold">&gt;</text>
</svg>`;

const SIMPLE_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
  <rect x="2" y="2" width="16" height="16" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
  <line x1="5" y1="6" x2="15" y2="6" stroke="currentColor" stroke-width="1" opacity="0.5"/>
  <line x1="5" y1="9" x2="13" y2="9" stroke="currentColor" stroke-width="1" opacity="0.5"/>
  <line x1="5" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1" opacity="0.5"/>
  <line x1="5" y1="15" x2="10" y2="15" stroke="currentColor" stroke-width="1" opacity="0.5"/>
</svg>`;

const COPY_ALL_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
  <rect x="6" y="6" width="11" height="12" rx="1"/>
  <path d="M4 14V4a1 1 0 0 1 1-1h8"/>
</svg>`;

const FILE_OPEN_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
  <path d="M3 17V3a1 1 0 0 1 1-1h5l2 2h5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>
  <path d="M8 10v4m-2-2h4" stroke-linecap="round"/>
</svg>`;

const SUN_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
  <circle cx="10" cy="10" r="4"/>
  <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke-linecap="round"/>
</svg>`;

const MOON_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
  <path d="M17 12.5A7.5 7.5 0 0 1 7.5 3 7.5 7.5 0 1 0 17 12.5z"/>
</svg>`;

const GITHUB_ICON = `<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
</svg>`;



function App() {
  // Load UI state synchronously for initial render
  const initialUIState = loadUIState();
  const mobile = isMobile();

  const [source, setSource] = createSignal("");
  const [ast, setAst] = createSignal<Root | null>(null);
  const [cursorPosition, setCursorPosition] = createSignal(initialUIState.cursorPosition);
  const [isInitialized, setIsInitialized] = createSignal(false);
  const [isDark, setIsDark] = createSignal((() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  })());
  const [saveStatus, setSaveStatus] = createSignal<"saved" | "saving" | "idle" | "error">("idle");
  const [filePath, setFilePath] = createSignal<string | null>(null);
  const [isDirty, setIsDirty] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<ViewMode>(initialUIState.viewMode);
  const [editorMode, setEditorMode] = createSignal<EditorMode>(initialUIState.editorMode);

  // Memoized class names for reactivity
  const containerClass = createMemo(() => `container view-${viewMode()} editor-mode-${editorMode()}`);
  const splitBtnClass = createMemo(() => `view-mode-btn ${viewMode() === "split" ? "active" : ""}`);
  const editorBtnClass = createMemo(() => `view-mode-btn ${viewMode() === "editor" ? "active" : ""}`);
  const previewBtnClass = createMemo(() => `view-mode-btn ${viewMode() === "preview" ? "active" : ""}`);
  const highlightBtnClass = createMemo(() => `view-mode-btn ${editorMode() === "highlight" ? "active" : ""}`);
  const simpleBtnClass = createMemo(() => `view-mode-btn ${editorMode() === "simple" ? "active" : ""}`);
  const saveStatusClass = createMemo(() => `save-status ${saveStatus()}`);
  const [saveStatusText, setSaveStatusText] = createSignal("");

  // Refs
  let editorRef: SyntaxHighlightEditorHandle | null = null;
  let simpleEditorRef: HTMLTextAreaElement | null = null;
  let previewRef: HTMLDivElement | null = null;
  let fileInputRef: HTMLInputElement | null = null;
  let saveStatusRef: HTMLSpanElement | null = null;

  // Track if content has been modified since load
  let hasModified = false;
  let lastSyncedTimestamp = 0;
  let isSaving = false;
  let loadedFromQuery = false;

  // Revision counter for preventing save races
  let saveRevision = 0;
  let savedStatusTimer: number | undefined;

  // Debounced source for saving
  const [debouncedSource, setDebouncedSource] = createSignal("");
  let debounceTimer: number | undefined;

  createEffect(() => {
    const value = source();
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      setDebouncedSource(value);
    }, DEBOUNCE_DELAY);
  });

  // Derived filename for toolbar display
  const fileName = createMemo(() => {
    const fp = filePath();
    if (!fp) return null;
    return fp.split("/").pop() || fp;
  });

  // Save content to local file via dev server endpoint
  async function saveLocalFile(fp: string, content: string): Promise<void> {
    const res = await fetch("/__local-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fp, content }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Save failed (${res.status}): ${text}`);
    }
  }

  // AST parsing moved to handleChange with batch() for efficiency

  const toggleDark = () => {
    setIsDark((v) => !v);
  };

  // Apply dark mode
  createEffect(() => {
    const dark = isDark();
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    saveUIState({ viewMode: mode });
  };

  const handleEditorModeChange = (mode: EditorMode) => {
    const currentMode = editorMode();
    if (currentMode === mode) return;

    // Get cursor position and scroll from current editor
    let cursorPos = 0;
    let scrollTop = 0;

    if (currentMode === "highlight" && editorRef) {
      cursorPos = editorRef.getCursorPosition();
      scrollTop = editorRef.getScrollTop();
    } else if (currentMode === "simple" && simpleEditorRef) {
      cursorPos = simpleEditorRef.selectionStart;
      scrollTop = simpleEditorRef.scrollTop;
    }

    setEditorMode(mode);
    saveUIState({ editorMode: mode });

    // Apply cursor position and scroll to new editor after mode switch
    requestAnimationFrame(() => {
      if (mode === "highlight" && editorRef) {
        editorRef.setCursorPosition(cursorPos);
        editorRef.setScrollTop(scrollTop);
      } else if (mode === "simple" && simpleEditorRef) {
        simpleEditorRef.setSelectionRange(cursorPos, cursorPos);
        simpleEditorRef.scrollTop = scrollTop;
        simpleEditorRef.focus();
      }
      // Update cursor position signal for preview sync
      setCursorPosition(cursorPos);
    });
  };

  // Keyboard shortcuts for view mode
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "1") {
          e.preventDefault();
          handleViewModeChange("split");
        } else if (e.key === "2") {
          e.preventDefault();
          handleViewModeChange("editor");
        } else if (e.key === "3") {
          e.preventDefault();
          handleViewModeChange("preview");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  // Load initial content: query param > IndexedDB > default
  onMount(async () => {
    let content = initialMarkdown;
    let timestamp = 0;

    // Check for ?file= query parameter (dev server only)
    const fileParam = new URLSearchParams(window.location.search).get("file");
    if (fileParam && fileParam.trim()) {
      const url = new URL("/__local-file", location.origin);
      url.searchParams.set("path", fileParam);
      try {
        const res = await fetch(url.href);
        if (res.ok) {
          content = await res.text();
          loadedFromQuery = true;
          setFilePath(fileParam);
          document.title = fileParam.split("/").pop() || fileParam;
        } else {
          console.warn(`Failed to load file "${fileParam}": ${res.status} ${res.statusText}`);
        }
      } catch (e) {
        console.warn(`Failed to fetch local file "${fileParam}":`, e);
      }
    }

    if (!loadedFromQuery) {
      try {
        const idbData = await loadFromIDB();
        if (idbData && idbData.content) {
          content = idbData.content;
          timestamp = idbData.timestamp;
        }
      } catch (e) {
        console.error("Failed to load from IndexedDB:", e);
      }
    }

    setSource(content);
    lastSyncedTimestamp = timestamp;
    // Set initialized first so Show renders and refs are set
    setIsInitialized(true);

    // Parse AST after next frame to ensure previewRef is ready
    requestAnimationFrame(() => {
      setAst(parse(content));
      editorRef?.focus();
      if (loadedFromQuery) {
        setSaveStatus("saved");
        setSaveStatusText("Synced");
      }
    });
  });

  // Handle tab focus / visibility change for sync
  onMount(() => {
    async function syncFromDisk() {
      if (isSaving) return;

      const fp = filePath();
      if (fp) {
        if (hasModified) return;
        try {
          const url = new URL("/__local-file", location.origin);
          url.searchParams.set("path", fp);
          const res = await fetch(url.href);
          if (res.ok) {
            const diskContent = await res.text();
            if (diskContent !== source()) {
              hasModified = false;
              batch(() => {
                setSource(diskContent);
                setAst(parse(diskContent));
              });
              setSaveStatus("saved");
              setSaveStatusText("Synced");
              if (editorMode() === "highlight" && editorRef) {
                editorRef.setValue(diskContent);
              } else if (simpleEditorRef) {
                simpleEditorRef.value = diskContent;
              }
            }
          }
        } catch (e) {
          console.error("Failed to sync from disk:", e);
        }
        return;
      }

      // IDB mode: sync from IndexedDB
      if (hasModified) return;
      try {
        const idbData = await loadFromIDB();
        if (!idbData) return;

        if (idbData.timestamp > lastSyncedTimestamp) {
          setSource(idbData.content);
          lastSyncedTimestamp = idbData.timestamp;
        }
      } catch (e) {
        console.error("Failed to sync from IndexedDB:", e);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") syncFromDisk();
    }
    function handleFocus() {
      syncFromDisk();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    onCleanup(() => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    });
  });

  // Save content: IDB first, then local file if in file mode
  createEffect(() => {
    const debounced = debouncedSource();
    if (!isInitialized()) return;
    if (!hasModified) return;

    const currentRevision = ++saveRevision;
    const fp = filePath();

    isSaving = true;
    setSaveStatus("saving");
    setSaveStatusText("Saving...");

    // Always save to IDB first
    saveToIDB(debounced)
      .then(async (timestamp) => {
        lastSyncedTimestamp = timestamp;

        // If in file mode, also save to local file
        if (fp) {
          try {
            await saveLocalFile(fp, debounced);
          } catch (e) {
            console.error("Failed to save local file:", e);
            // Only update status if this is still the latest save
            if (currentRevision === saveRevision) {
              isSaving = false;
              hasModified = false;
              setSaveStatus("error");
              setSaveStatusText("Save failed");
            }
            return;
          }
        }

        // Only clear dirty if this is still the latest revision
        if (currentRevision === saveRevision) {
          hasModified = false;
          setIsDirty(false);
          isSaving = false;
          setSaveStatus("saved");
          setSaveStatusText(fp ? "Synced" : "Saved");
          if (!fp) {
            clearTimeout(savedStatusTimer);
            savedStatusTimer = window.setTimeout(() => {
              setSaveStatus("idle");
              setSaveStatusText("");
            }, 2000);
          }
        }
      })
      .catch((e) => {
        console.error("Failed to save to IndexedDB:", e);
        if (currentRevision === saveRevision) {
          isSaving = false;
          setSaveStatus("error");
          setSaveStatusText("Save failed");
          clearTimeout(savedStatusTimer);
          savedStatusTimer = window.setTimeout(() => {
            setSaveStatus("idle");
            setSaveStatusText("");
          }, 3000);
        }
      });
  });

  // Sync save status text to DOM imperatively
  createEffect(() => {
    const text = saveStatusText();
    const status = saveStatus();
    if (saveStatusRef) {
      saveStatusRef.textContent = text;
      saveStatusRef.className = `save-status ${status}`;
    }
  });

  // Track last rendered AST version for scroll synchronization
  let lastRenderedAst: Root | null = null;

  // Handle task checkbox toggle from preview
  const handleTaskToggle = (span: string, checked: boolean) => {
    const [startStr, endStr] = span.split("-");
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);

    const currentSource = source();
    const itemText = currentSource.slice(start, end);

    // Toggle [ ] <-> [x]
    const newText = checked
      ? itemText.replace(/\[ \]/, "[x]")
      : itemText.replace(/\[x\]/i, "[ ]");

    const newSource = currentSource.slice(0, start) + newText + currentSource.slice(end);

    // Update source and AST synchronously (bypass debounce for immediate feedback)
    hasModified = true;
    setIsDirty(true);
    setSource(newSource);
    setAst(parse(newSource));

    // Sync editor text with targeted update using span
    if (editorMode() === "highlight" && editorRef) {
      editorRef.setValue(newSource, { start, end });
    } else if (simpleEditorRef) {
      simpleEditorRef.value = newSource;
    }

    // Move cursor to the toggled checkbox position and focus editor
    requestAnimationFrame(() => {
      // Find the checkbox position (the '[' in '- [x]')
      const checkboxPos = newSource.indexOf("[", start);
      if (checkboxPos !== -1) {
        setCursorPosition(checkboxPos);
        if (editorMode() === "highlight" && editorRef) {
          editorRef.setCursorPosition(checkboxPos);
          editorRef.focus();
        } else if (simpleEditorRef) {
          simpleEditorRef.setSelectionRange(checkboxPos, checkboxPos);
          simpleEditorRef.focus();
        }
      }
    });
  };

  // Handle SVG change from Moonlight editor
  // Note: We only update the source text, NOT the AST, to avoid re-rendering
  // the preview and losing focus on the MoonlightEditor
  const handleSvgChange = (newSvg: string, span: string) => {
    const [startStr, endStr] = span.split("-");
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);

    const currentSource = source();

    // Find the code block content boundaries (skip ```moonlight-svg\n and \n```)
    // The span includes the entire code block, we need to find the actual content
    const blockText = currentSource.slice(start, end);
    const contentStart = blockText.indexOf("\n") + 1;
    const contentEnd = blockText.lastIndexOf("\n```");

    if (contentStart > 0 && contentEnd > contentStart) {
      const prefix = currentSource.slice(0, start + contentStart);
      const suffix = currentSource.slice(start + contentEnd);
      const newSource = prefix + newSvg + suffix;

      // Update source only (skip AST re-parse to prevent re-render and focus loss)
      hasModified = true;
      setIsDirty(true);
      setSource(newSource);
      // Don't call setAst() here - AST will be updated on next text editor change

      // Sync editor text
      if (editorMode() === "highlight" && editorRef) {
        editorRef.setValue(newSource);
      } else if (simpleEditorRef) {
        simpleEditorRef.value = newSource;
      }
    }
  };

  // Callbacks for interactive preview
  const rendererCallbacks: RendererCallbacks = {
    onTaskToggle: handleTaskToggle,
  };

  // Options for custom code block rendering (sourceText added reactively in render effect)
  const rendererOptions: RendererOptions = {
    codeBlockHandlers: {
      // Render ```svg or ```svg:preview blocks as inline SVG
      // Mode: "preview" (default) = inline preview, "code" = syntax highlighted
      svg: {
        render: (code, span, key, mode) => {
          // If mode is "code", fall through to default syntax highlighting
          if (mode === "code") {
            return null;
          }
          // Default: render as inline SVG (sanitized for safety)
          return <RawHtml key={key} data-span={span} html={sanitizeSvg(code)} />;
        },
      },
      // Render ```moonlight-svg blocks as interactive Moonlight editor
      "moonlight-svg": {
        render: (code, span, key) => (
          <MoonlightEditor
            key={key}
            initialSvg={code}
            span={span}
            onSvgChange={handleSvgChange}
            width={400}
            height={300}
            theme={isDark() ? "dark" : "light"}
          />
        ),
      },
      // Render ```mermaid blocks as live diagrams
      // ```mermaid:code falls through to syntax highlighting
      mermaid: {
        render: (code, span, key, mode) => {
          if (mode === "code") return null;
          return <MermaidDiagram key={key} code={code} span={span} />;
        },
      },
    },
  };

  // Track last rendered AST for scroll syncing
  createEffect(() => {
    const currentAst = ast();
    if (currentAst) {
      lastRenderedAst = currentAst;
    }
  });

  // Suppress preview scroll when cursor change originated from preview click
  let suppressPreviewScroll = false;

  // Sync preview scroll with cursor position (debounced to avoid excessive scrolling)
  let scrollTimer: number | undefined;
  createEffect(() => {
    const pos = cursorPosition();
    const currentAst = ast();
    if (!previewRef || !currentAst) return;

    if (suppressPreviewScroll) {
      suppressPreviewScroll = false;
      return;
    }

    // Debounce scroll updates to avoid jittery scrolling during fast typing
    clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      // Use requestAnimationFrame to ensure DOM is ready after render
      requestAnimationFrame(() => {
        if (!previewRef || !lastRenderedAst) return;

        const blockIndex = findBlockAtPosition(lastRenderedAst, pos);
        if (blockIndex === null) return;

        const block = lastRenderedAst.children[blockIndex]!;
        const start = block.position?.start?.offset ?? 0;
        const end = block.position?.end?.offset ?? 0;
        const selector = `[data-span="${start}-${end}"]`;
        const element = previewRef.querySelector(selector);

        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }, 150); // Small delay to let render complete first
  });


  // Preview → source click handler
  const handlePreviewClick = (e: MouseEvent) => {
    // If user selected text in preview, don't steal focus to editor
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;

    let target = e.target as HTMLElement | null;
    while (target && target !== previewRef) {
      const span = target.getAttribute("data-span");
      if (span) {
        const start = parseInt(span.split("-")[0]!, 10);
        if (!isNaN(start)) {
          suppressPreviewScroll = true;
          setCursorPosition(start);
          if (editorMode() === "highlight" && editorRef) {
            editorRef.setCursorPosition(start);
            editorRef.focus();
          } else if (simpleEditorRef) {
            const text = simpleEditorRef.value;
            let line = 0;
            for (let i = 0; i < start && i < text.length; i++) {
              if (text[i] === "\n") line++;
            }
            const totalLines = text.split("\n").length || 1;
            const lineHeight = simpleEditorRef.scrollHeight / totalLines;
            const targetTop = Math.max(0, line * lineHeight - simpleEditorRef.clientHeight / 3);
            simpleEditorRef.setSelectionRange(start, start);
            simpleEditorRef.focus({ preventScroll: true });
            simpleEditorRef.scrollTop = targetTop;
          }
        }
        return;
      }
      target = target.parentElement;
    }
  };

  // File open handlers
  const handleFileOpen = () => {
    fileInputRef?.click();
  };

  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Clear file-mode to prevent overwriting the original ?file= path
    setFilePath(null);
    loadedFromQuery = false;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      hasModified = true;
      setIsDirty(true);
      batch(() => {
        setSource(content);
        setAst(parse(content));
      });
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    input.value = "";
  };

  // Debounced AST parsing - separate from source updates for better input responsiveness
  let astParseTimer: number | undefined;
  const AST_PARSE_DELAY = 100; // ms - delay AST parsing to not block input

  const handleChange = (newSource: string) => {
    hasModified = true;
    setIsDirty(true);
    if (filePath()) {
      setSaveStatus("idle");
      setSaveStatusText("Modified");
    }
    // Update source immediately for responsive input
    setSource(newSource);

    // Debounce AST parsing - preview doesn't need to update on every keystroke
    clearTimeout(astParseTimer);
    astParseTimer = window.setTimeout(() => {
      setAst(parse(newSource));
    }, AST_PARSE_DELAY);
  };

  // Debounce cursor position saving
  let cursorSaveTimer: number | undefined;
  const handleCursorChange = (position: number) => {
    setCursorPosition(position);
    // Debounce localStorage write - don't need to save every keystroke
    clearTimeout(cursorSaveTimer);
    cursorSaveTimer = window.setTimeout(() => {
      saveUIState({ cursorPosition: position });
    }, 500);
  };

  return (
    <Show when={isInitialized}>
      {() => (
        <div class="app-container">
          <header class="toolbar">
            <div class="toolbar-left">
              <div class="view-mode-buttons">
                {!mobile && (
                  <button
                    class={splitBtnClass}
                    onClick={() => handleViewModeChange("split")}
                    title="Split view (Ctrl+1)"
                  >
                    <Icon svg={SPLIT_ICON} />
                  </button>
                )}
                <button
                  class={editorBtnClass}
                  onClick={() => handleViewModeChange("editor")}
                  title="Editor only (Ctrl+2)"
                >
                  <Icon svg={EDITOR_ICON} />
                </button>
                <button
                  class={previewBtnClass}
                  onClick={() => handleViewModeChange("preview")}
                  title="Preview only (Ctrl+3)"
                >
                  <Icon svg={PREVIEW_ICON} />
                </button>
              </div>
              <div class="editor-mode-buttons">
                <button
                  class={highlightBtnClass}
                  onClick={() => handleEditorModeChange("highlight")}
                  title="Syntax highlight editor"
                >
                  <Icon svg={HIGHLIGHT_ICON} />
                </button>
                <button
                  class={simpleBtnClass}
                  onClick={() => handleEditorModeChange("simple")}
                  title="Simple text editor"
                >
                  <Icon svg={SIMPLE_ICON} />
                </button>
              </div>
              {fileName() ? <span class="file-name">{fileName()}</span> : null}
              <span class="save-status" ref={(el: HTMLSpanElement) => { saveStatusRef = el; }}></span>
            </div>
            <div class="toolbar-actions">
              <button
                class="toolbar-copy-all toolbar-action-btn"
                title="Copy all markdown"
                onClick={(e: MouseEvent) => {
                  navigator.clipboard.writeText(source());
                  const btn = e.currentTarget as HTMLElement;
                  btn.classList.add("copied");
                  setTimeout(() => btn.classList.remove("copied"), 2000);
                }}
              >
                <Icon svg={COPY_ALL_ICON} />
              </button>
              <button onClick={handleFileOpen} class="toolbar-action-btn" title="Open file">
                <Icon svg={FILE_OPEN_ICON} />
              </button>
              <button onClick={toggleDark} class="toolbar-action-btn" title="Toggle dark mode"
                ref={(el) => {
                  createEffect(() => {
                    el.innerHTML = `<span style="display:flex;align-items:center">${isDark() ? SUN_ICON : MOON_ICON}</span>`;
                  });
                }}
              />
              <button onClick={() => window.open("https://github.com/y4mau/markdown.mbt", "_blank", "noopener,noreferrer")} class="toolbar-action-btn" title="View on GitHub">
                <Icon svg={GITHUB_ICON} />
              </button>
            </div>
            <input
              type="file"
              ref={(el) => { fileInputRef = el; }}
              accept=".md,.markdown,.txt"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
          </header>
          <div class={containerClass}>
            {/* Editor panel - visibility controlled by CSS class */}
            <div class="editor">
              {/* Syntax highlight editor - always mounted, visibility controlled by CSS */}
              <div class="editor-highlight-wrapper">
                <SyntaxHighlightEditor
                  ref={(el) => { editorRef = el; }}
                  value={() => source()}
                  onChange={handleChange}
                  onCursorChange={handleCursorChange}
                  initialCursorPosition={initialUIState.cursorPosition}
                />
              </div>
              {/* Simple editor - always mounted, visibility controlled by CSS */}
              <div class="editor-simple-wrapper">
                <SimpleEditor
                  value={() => source()}
                  onChange={handleChange}
                  onCursorChange={handleCursorChange}
                  ref={(el) => { simpleEditorRef = el; }}
                />
              </div>
            </div>
            {/* Preview panel - imperative re-render via createEffect + render */}
            <div class="preview" ref={(el) => {
              previewRef = el;
              createEffect(() => {
                const currentAst = ast();
                if (!currentAst) return;
                el.innerHTML = "";
                const opts = { ...rendererOptions, sourceText: source() };
                render(el, <MarkdownRenderer ast={currentAst} callbacks={rendererCallbacks} options={opts} />);
              });
            }} onClick={handlePreviewClick}></div>
          </div>
        </div>
      )}
    </Show>
  );
}

render(document.getElementById("app")!, <App />);
