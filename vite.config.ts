import { defineConfig, type Plugin } from "vite";
import path from "path";
import fs from "fs";

const ASSET_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
};

function localFilePlugin(): Plugin {
  const projectRoot = __dirname;
  const ALLOWED_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
  const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB

  // Track paths that have been served via GET (only allow POST to these)
  const servedPaths = new Set<string>();

  function validatePath(filePath: string | null): { resolved: string } | { error: string; status: number } {
    if (!filePath || !filePath.trim() || filePath.includes("\0")) {
      return { error: "Missing or invalid path parameter", status: 400 };
    }
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(projectRoot, filePath);
    const ext = path.extname(resolved).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return { error: "Forbidden: extension not allowed", status: 403 };
    }
    return { resolved };
  }

  return {
    name: "local-file-server",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        if (url.pathname !== "/__local-file") return next();

        if (req.method === "GET") {
          const result = validatePath(url.searchParams.get("path"));
          if ("error" in result) {
            res.statusCode = result.status;
            res.end(result.error);
            return;
          }
          try {
            const content = fs.readFileSync(result.resolved, "utf-8");
            servedPaths.add(result.resolved);
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.statusCode = 200;
            res.end(content);
          } catch {
            res.statusCode = 404;
            res.end("File not found");
          }
          return;
        }

        if (req.method === "POST") {
          // Origin check
          const origin = req.headers.origin;
          const expected = `http://${req.headers.host}`;
          if (!origin || origin !== expected) {
            res.statusCode = 403;
            res.end("Forbidden: origin mismatch");
            return;
          }

          // Content-Type check
          const ct = req.headers["content-type"] || "";
          if (!ct.startsWith("application/json")) {
            res.statusCode = 415;
            res.end("Unsupported Media Type");
            return;
          }

          // Read body with size limit
          const chunks: Buffer[] = [];
          let size = 0;
          req.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BODY_SIZE) {
              res.statusCode = 413;
              res.end("Payload too large");
              req.destroy();
              return;
            }
            chunks.push(chunk);
          });
          req.on("end", () => {
            if (res.writableEnded) return;
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
              const { path: filePath, content } = body;
              if (typeof filePath !== "string" || typeof content !== "string") {
                res.statusCode = 400;
                res.end("Invalid body: path and content required");
                return;
              }
              const result = validatePath(filePath);
              if ("error" in result) {
                res.statusCode = result.status;
                res.end(result.error);
                return;
              }
              if (!servedPaths.has(result.resolved)) {
                res.statusCode = 403;
                res.end("Forbidden: path not previously served");
                return;
              }
              // Atomic write: tmp file + rename
              const tmpPath = `${result.resolved}.tmp~`;
              try {
                fs.writeFileSync(tmpPath, content, "utf-8");
                fs.renameSync(tmpPath, result.resolved);
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ ok: true }));
              } catch (err: any) {
                // Clean up tmp file on failure
                try { fs.unlinkSync(tmpPath); } catch {}
                const code = err?.code;
                if (code === "EACCES" || code === "EROFS") {
                  res.statusCode = 403;
                  res.end("Forbidden: cannot write to file");
                } else if (code === "ENOSPC") {
                  res.statusCode = 507;
                  res.end("Insufficient storage");
                } else {
                  res.statusCode = 500;
                  res.end("Internal server error");
                }
              }
            } catch {
              res.statusCode = 400;
              res.end("Invalid JSON");
            }
          });
          return;
        }

        // Method not allowed
        res.statusCode = 405;
        res.setHeader("Allow", "GET, POST");
        res.end("Method not allowed");
      });

      // Tab reuse: broadcast HMR event to open a file in existing tab
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        if (url.pathname !== "/__open" || req.method !== "GET") return next();

        const result = validatePath(url.searchParams.get("file"));
        if ("error" in result) {
          res.statusCode = result.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ delivered: false, error: result.error }));
          return;
        }
        if (!fs.existsSync(result.resolved)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ delivered: false, error: "File not found" }));
          return;
        }
        const name = path.basename(result.resolved);
        if (server.ws.clients.size > 0) {
          server.ws.send("markdown:open-file", { path: result.resolved, name });
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(JSON.stringify({ delivered: true }));
        } else {
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(JSON.stringify({ delivered: false }));
        }
      });

      // Serve local image assets referenced by markdown files
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        if (url.pathname !== "/__local-asset" || req.method !== "GET") return next();

        const filePath = url.searchParams.get("path");
        if (!filePath || !filePath.trim() || filePath.includes("\0")) {
          res.statusCode = 400;
          res.end("Missing or invalid path parameter");
          return;
        }
        const resolved = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(projectRoot, filePath);
        const ext = path.extname(resolved).toLowerCase();
        const mime = ASSET_MIME_TYPES[ext];
        if (!mime) {
          res.statusCode = 403;
          res.end("Forbidden: file type not allowed");
          return;
        }
        try {
          const data = fs.readFileSync(resolved);
          res.setHeader("Content-Type", mime);
          res.setHeader("Cache-Control", "public, max-age=300");
          res.statusCode = 200;
          res.end(data);
        } catch {
          res.statusCode = 404;
          res.end("File not found");
        }
      });
    },
  };
}

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "@luna_ui/luna",
  },
  root: "playground",
  server: {
    fs: {
      allow: [__dirname],
    },
  },
  resolve: {
    alias: {
      "@mizchi/moonlight": path.resolve(__dirname, "playground/moonlight-stub.ts"),
    },
  },
  plugins: [localFilePlugin()],
});
