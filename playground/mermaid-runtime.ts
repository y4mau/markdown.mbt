///| Shared Mermaid render service with lazy loading, serialized queue, and cache

// Lazy-load Mermaid module (avoids ~2MB in initial bundle).
// Reset on failure so the next call retries the import.
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid")
      .then((m) => m.default)
      .catch((e) => {
        mermaidPromise = null; // Allow retry on next render
        throw e;
      });
  }
  return mermaidPromise;
}

// Serialize all renders to prevent concurrent mermaid.initialize() races
let renderQueue = Promise.resolve();
let lastTheme: string | null = null;

// Small cache keyed by "<theme>|<code>" to avoid re-rendering same content
const cache = new Map<string, string>();
const MAX_CACHE = 30;

export function renderMermaid(code: string, dark: boolean): Promise<string> {
  const theme = dark ? "dark" : "default";
  const cacheKey = `${theme}|${code}`;
  if (cache.has(cacheKey)) return Promise.resolve(cache.get(cacheKey)!);

  // Enqueue: each render waits for previous. Use separate Promise so the
  // queue chain always resolves even if an individual render throws.
  return new Promise<string>((resolve, reject) => {
    renderQueue = renderQueue.then(async () => {
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try {
        const mermaid = await getMermaid();
        if (lastTheme !== theme) {
          mermaid.initialize({
            startOnLoad: false,
            theme,
            securityLevel: "strict",
          });
          lastTheme = theme;
        }
        const { svg } = await mermaid.render(id, code);
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
        cache.set(cacheKey, svg);
        resolve(svg);
      } catch (e) {
        reject(e);
        // Do NOT re-throw: keeps renderQueue resolving for next enqueued render
      } finally {
        // Always clean up orphan element created by mermaid.render()
        document.getElementById(id)?.remove();
      }
    });
  });
}

/** Synchronous cache lookup — returns cached SVG or null */
export function getCachedMermaid(code: string, dark: boolean): string | null {
  const theme = dark ? "dark" : "default";
  return cache.get(`${theme}|${code}`) ?? null;
}

/** Clear the render cache (useful on theme change if needed) */
export function clearMermaidCache(): void {
  cache.clear();
}
