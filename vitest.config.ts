import { defineConfig } from "vitest/config";
import svgr from "vite-plugin-svgr";
import path from "node:path";
export default defineConfig({
  plugins: [svgr()],
  resolve: { alias: { "@": path.resolve(__dirname, "src/ui"), "~": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom", setupFiles: ["test/setup.ts"], include: ["test/**/*.test.ts", "test/**/*.test.tsx"] },
});
