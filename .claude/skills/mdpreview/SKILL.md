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
```bash
cd ~/ghq/github.com/y4mau/markdown.mbt && pnpm vite
```

## Steps

1. Resolve the file path to an absolute path
2. Verify the file exists and has a markdown extension (`.md`, `.markdown`, `.txt`)
3. Check that the markdown.mbt dev server is running:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
```

   - If the server responds with HTTP 200, proceed to the next step
   - If the server is not reachable, inform the user and start it in the background:

```bash
cd ~/ghq/github.com/y4mau/markdown.mbt && nohup pnpm vite > /dev/null 2>&1 &
```

   Then wait a few seconds and retry the health check. If it still fails, ask the user to start the server manually.

4. Try to reuse an existing playground tab first:

```bash
curl -s "http://localhost:5173/__open?file=<absolute-path>"
```

   - If the response contains `"delivered":true`, the file was opened in the existing tab — done.
   - If `"delivered":false` or curl fails, fall back to opening a new tab:

```bash
# WSL
cmd.exe /c start "" "http://localhost:5173/?file=<absolute-path>"
# Linux
xdg-open "http://localhost:5173/?file=<absolute-path>"
```

If `$ARGUMENTS` is empty, search the current directory for markdown files and ask the user which one to open.

## Notes

- The playground supports any file on the local filesystem (absolute paths)
- The browser tab title updates to the filename
- Extension allowlist on the server: `.md`, `.markdown`, `.txt`
