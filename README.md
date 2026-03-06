# @y4mau/markdown

CST-based incremental Markdown parser for JavaScript/MoonBit.

> **Fork of [mizchi/markdown.mbt](https://github.com/mizchi/markdown.mbt)** with playground enhancements for local editing, preview, and Claude Code integration.

> 日本語版READMEは[こちら](./README.ja.md)

## Fork Features

This fork adds the following on top of upstream:

- **Playground with local file I/O** — Load local `.md` files via `?file=<path>`, auto-save with status indicator, sync on window focus
- **Copy-to-clipboard** — Copy entire document from toolbar, per-code-block copy, and per-heading section copy (hover heading to reveal, section highlights on hover)
- **Mermaid diagram rendering** — Fenced code blocks with `mermaid` language render as diagrams with zoom/pan controls
- **Details/summary toggle** — HTML `<details>` / `<summary>` blocks render as collapsible sections
- **Preview-to-source navigation** — Click preview elements to jump to the corresponding source position; text selection in preview is preserved
- **Paste URL as link** — Select text and paste a URL to create a `[text](url)` markdown link

## Quick Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
  - Linux / macOS: `curl -fsSL https://fnm.vercel.app/install | bash && fnm install --lts`
  - Windows: `winget install Schniz.fnm` then `fnm install --lts`
- [pnpm](https://pnpm.io/) — `npm install -g pnpm`
- [MoonBit](https://www.moonbitlang.com/download/)
  - Linux / macOS: `curl -fsSL https://cli.moonbitlang.com/install/unix.sh | bash`
  - Windows: `irm https://cli.moonbitlang.com/install/powershell.ps1 | iex`

### Bash (Linux / WSL / macOS)

```bash
git clone https://github.com/y4mau/markdown.mbt.git
cd markdown.mbt
pnpm install
moon build --target js
./scripts/install-mdpreview.sh                    # Install skill + shell function
source ~/.bashrc
pnpm exec vite &                                  # Start dev server in background
sleep 2
open http://localhost:5173/?file=$PWD/README.md   # Preview README
```

### PowerShell (Windows)

```powershell
git clone https://github.com/y4mau/markdown.mbt.git
cd markdown.mbt
pnpm install
moon build --target js
.\scripts\install-mdpreview.ps1                   # Install skill + shell function
Start-Process pnpm "exec vite"                    # Start dev server in background
Start-Sleep 2
Start-Process "http://localhost:5173/?file=$($PWD.Path)/README.md"  # Preview README
```

## Claude Code Integration

The `mdpreview` skill lets Claude Code open any local `.md` file in the playground browser preview.

### Setup

1. Copy the skill definition below to `~/.claude/skills/mdpreview/SKILL.md`
2. Start the dev server: `pnpm vite`
3. Use `/mdpreview <file>` or natural language prompts in Claude Code

### Sample Prompts

**English:**

```
Preview README.md
```
```
Show me docs/markdown.md in the playground
```
```
Open my-notes.md in the browser
```

**Japanese:**

```
README.md をプレビューして
```
```
docs/markdown.md をプレイグラウンドで表示して
```
```
my-notes.md をブラウザで開いて
```

### SKILL.md

<details>
<summary>Copy this to <code>~/.claude/skills/mdpreview/SKILL.md</code></summary>

```markdown
---
name: mdpreview
description: Open a markdown file in the markdown.mbt playground browser preview. Use when the user asks to show, preview, or view a markdown file.
argument-hint: <file-path>
allowed-tools: Bash, Glob, Read
---

# Open Markdown in Playground Preview

Open the specified markdown file in the markdown.mbt playground running at `http://localhost:5173/`.

## Prerequisites

The dev server must be running:

cd ~/ghq/github.com/y4mau/markdown.mbt && pnpm vite

## Steps

1. Resolve the file path to an absolute path
2. Verify the file exists and has a markdown extension (`.md`, `.markdown`, `.txt`)
3. Open in the browser:

# WSL
cmd.exe /c start "" "http://localhost:5173/?file=<absolute-path>"
# Linux
xdg-open "http://localhost:5173/?file=<absolute-path>"

If `$ARGUMENTS` is empty, search the current directory for markdown files and ask the user which one to open.

## Notes

- The playground supports any file on the local filesystem (absolute paths)
- The browser tab title updates to the filename
- Extension allowlist on the server: `.md`, `.markdown`, `.txt`
```

</details>

## Playground

```bash
pnpm install
moon build --target js
pnpm exec vite
```

## Upstream Features

For detailed API documentation (JavaScript, MoonBit, TypeScript, incremental parsing), see the upstream repository: [mizchi/markdown.mbt](https://github.com/mizchi/markdown.mbt)

Key highlights from upstream:

- **Fast incremental parsing** — Re-parses only changed blocks (up to 42x faster)
- **Lossless CST** — Preserves all whitespace, markers, and formatting
- **GFM support** — Tables, task lists, strikethrough
- **Cross-platform** — JS, WASM-GC, and native targets
- **mdast compatible** — AST follows [mdast](https://github.com/syntax-tree/mdast) specification

### Performance

| Document | Full Parse | Incremental | Speedup |
|----------|-----------|-------------|---------|
| 10 paragraphs | 68.89µs | 7.36µs | 9.4x |
| 50 paragraphs | 327.99µs | 8.67µs | 37.8x |
| 100 paragraphs | 651.14µs | 15.25µs | 42.7x |

## CommonMark Compatibility

This parser handles most common Markdown syntax correctly and works well for typical use cases like documentation, blog posts, and notes. Some edge cases are not fully CommonMark compliant — if you need strict compliance, consider [cmark.mbt](https://github.com/moonbit-community/cmark.mbt).

## Documentation

See [docs/markdown.md](./docs/markdown.md) for detailed architecture and design.

## License

MIT
