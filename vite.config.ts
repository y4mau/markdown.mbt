import { defineConfig } from "vite";
import path from "path";

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
});
