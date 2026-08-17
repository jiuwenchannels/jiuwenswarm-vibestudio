/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { build } from "esbuild";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "fs";
import { dirname, join, resolve } from "path";
import { tmpdir } from "os";
import type { IncomingMessage, ServerResponse } from "http";

/**
 * Offline preview bundler.
 *
 * Sandpack's in-browser bundler needs to reach CodeSandbox/unpkg to fetch
 * React, which is blocked on some networks. This middleware bundles the
 * generated project server-side with esbuild (already available in
 * node_modules), resolving `react`/`react-dom` locally — no internet needed.
 *
 * Endpoint: POST /api/preview  { files: Record<string,string>, entry?: string }
 * Returns a self-contained IIFE JavaScript bundle.
 */
async function bundleProject(
  files: Record<string, string>,
  entry: string,
): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "vs-preview-"));
  try {
    for (const [rawPath, code] of Object.entries(files)) {
      const p = join(dir, rawPath.replace(/^\/+/, ""));
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, code);
    }

    const entryPath = join(dir, entry.replace(/^\/+/, ""));
    const result = await build({
      entryPoints: [entryPath],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      jsx: "automatic",
      minify: false,
      logLevel: "silent",
      nodePaths: [resolve(process.cwd(), "node_modules")],
    });
    return result.outputFiles[0].text;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function previewApiPlugin(): Plugin {
  return {
    name: "vibestudio-preview-api",
    configureServer(server) {
      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.url?.split("?")[0] !== "/api/preview" || req.method !== "POST") {
            next();
            return;
          }
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            void (async () => {
              try {
                const { files, entry } = JSON.parse(body) as {
                  files: Record<string, string>;
                  entry?: string;
                };
                const code = await bundleProject(files, entry ?? "/index.tsx");
                res.setHeader("Content-Type", "application/javascript");
                res.end(code);
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[preview] bundle error:", err);
                res.statusCode = 500;
                res.end(String((err as Error).message ?? err));
              }
            })();
          });
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), previewApiPlugin()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/main.tsx", "src/vite-env.d.ts"],
    },
  },
  server: {
    port: 5174,
  },
});
