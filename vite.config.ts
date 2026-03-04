import { defineConfig, type Plugin } from "vite";
import path from "path";
import fs from "fs";

function localFilePlugin(): Plugin {
  const projectRoot = __dirname;
  const ALLOWED_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

  return {
    name: "local-file-server",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        if (url.pathname !== "/__local-file") return next();

        const filePath = url.searchParams.get("path");

        // Reject empty/whitespace path
        if (!filePath || !filePath.trim()) {
          res.statusCode = 400;
          res.end("Missing path parameter");
          return;
        }

        // Reject absolute paths and null bytes
        if (path.isAbsolute(filePath) || filePath.includes("\0")) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }

        const resolved = path.resolve(projectRoot, filePath);

        // Check extension allowlist
        const ext = path.extname(resolved).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          res.statusCode = 403;
          res.end("Forbidden: extension not allowed");
          return;
        }

        // Resolve real paths to block symlink escape
        let realRoot: string;
        let realResolved: string;
        try {
          realRoot = fs.realpathSync(projectRoot);
          realResolved = fs.realpathSync(resolved);
        } catch {
          res.statusCode = 404;
          res.end("File not found");
          return;
        }

        if (!realResolved.startsWith(realRoot + path.sep) && realResolved !== realRoot) {
          res.statusCode = 403;
          res.end("Forbidden: path traversal detected");
          return;
        }

        try {
          const content = fs.readFileSync(realResolved, "utf-8");
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.statusCode = 200;
          res.end(content);
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
  resolve: {
    alias: {
      "@mizchi/moonlight": path.resolve(__dirname, "playground/moonlight-stub.ts"),
    },
  },
  plugins: [localFilePlugin()],
});
