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

        // Reject empty/whitespace path or null bytes
        if (!filePath || !filePath.trim() || filePath.includes("\0")) {
          res.statusCode = 400;
          res.end("Missing or invalid path parameter");
          return;
        }

        // Resolve: absolute paths used as-is, relative resolved from project root
        const resolved = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(projectRoot, filePath);

        // Check extension allowlist
        const ext = path.extname(resolved).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          res.statusCode = 403;
          res.end("Forbidden: extension not allowed");
          return;
        }

        try {
          const content = fs.readFileSync(resolved, "utf-8");
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
