/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { build, type Plugin as EsbuildPlugin } from "esbuild";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync } from "fs";
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

/** MIME types for common static assets inlined as data URLs. */
const ASSET_MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

/**
 * Inlines CSS and static assets so esbuild can emit a single self-contained JS
 * bundle. CSS becomes a <style> tag; images/fonts become data URLs. Also
 * remaps Vite public-dir absolute imports ("/vite.svg") to the project root.
 */
function inlineAssetsPlugin(root: string): EsbuildPlugin {
  return {
    name: "vibestudio-inline-assets",
    setup(build) {
      build.onResolve({ filter: /^\// }, (args) => ({
        path: join(root, args.path.replace(/^\/+/, "")),
      }));
      build.onLoad({ filter: /\.css$/ }, (args) => {
        const css = readFileSync(args.path, "utf8");
        return {
          contents: `if (typeof document !== "undefined"){var s=document.createElement("style");s.textContent=${JSON.stringify(
            css,
          )};document.head.appendChild(s);}`,
          loader: "js",
        };
      });
      build.onLoad(
        { filter: /\.(svg|png|jpe?g|gif|webp|ico|woff2?|ttf|otf)$/ },
        (args) => {
          const ext = "." + args.path.split(".").pop();
          const mime = ASSET_MIME[ext] ?? "application/octet-stream";
          const data = readFileSync(args.path).toString("base64");
          return { contents: `export default "data:${mime};base64,${data}"`, loader: "js" };
        },
      );
    },
  };
}

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
      plugins: [inlineAssetsPlugin(dir)],
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
