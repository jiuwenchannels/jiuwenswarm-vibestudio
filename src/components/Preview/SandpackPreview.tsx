/**
 * SandpackPreview — the live preview (offline) + optional code editor.
 *
 * The live preview is bundled locally by the Vite dev server
 * (POST /api/preview → esbuild, resolving React from local node_modules), so
 * it works without reaching CodeSandbox/unpkg. The code editor still uses
 * Sandpack (its CodeMirror editor runs fully offline).
 *
 * Layout: the preview is the hero surface; the code editor (when enabled) is a
 * resizable drawer at the bottom — a vertical split — so it never squeezes the
 * preview sideways. Clicking a file in the tree opens it in the editor.
 */
import {
  SandpackProvider,
  SandpackCodeEditor,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useProjectStore } from "../../store/project";
import { useThemeStore } from "../../store/theme";
import { Resizer } from "../Resizer";
import { FileTree } from "../FileExplorer/FileTree";

interface Props {
  showEditor?: boolean;
  /** Height of the bottom code drawer in px. */
  editorHeight?: number;
  /** Called with a pixel delta while the user drags the drawer resize handle. */
  onEditorResize?: (delta: number) => void;
  /** Hide the preview pane entirely (used by the mobile Code tab). */
  hidePreview?: boolean;
}

/**
 * Bridges the project store's activeFile (driven by the FileTree) into
 * Sandpack's internal store, so clicking a file in the tree opens it in the
 * editor. Sandpack keys are rooted with a leading slash.
 *
 * The `sandpack` object identity changes on every Sandpack render, so it is
 * kept in a ref rather than the dependency array — otherwise the effect would
 * re-run and call setActiveFile forever.
 */
function SyncActiveFile(): null {
  const activeFile = useProjectStore((s) => s.activeFile);
  const { sandpack } = useSandpack();
  const sandpackRef = useRef(sandpack);
  sandpackRef.current = sandpack;

  useEffect(() => {
    if (!activeFile) return;
    const sp = sandpackRef.current;
    const key = activeFile.startsWith("/") ? activeFile : `/${activeFile}`;
    if (sp.activeFile !== key && key in sp.files) sp.setActiveFile(key);
  }, [activeFile]);

  return null;
}

type PreviewState =
  | { kind: "loading" }
  | { kind: "ready"; srcdoc: string }
  | { kind: "error"; message: string };

function wrapBundle(bundle: string): string {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8" /><style>html,body,#root{height:100%;margin:0;}</style></head><body><div id="root"></div><script>' +
    bundle +
    "</scr" +
    "ipt></body></html>"
  );
}

/**
 * Offline live preview. React projects are POSTed to the dev server and
 * bundled with esbuild (resolving React from local node_modules); static
 * HTML projects are rendered directly with their assets inlined. The result
 * runs inside an iframe — no internet needed.
 */
function OfflinePreview({
  files,
  entry,
  staticHtml,
}: {
  files: Record<string, string>;
  entry: string;
  staticHtml?: string;
}): ReactNode {
  const [state, setState] = useState<PreviewState>({ kind: "loading" });

  useEffect(() => {
    if (staticHtml != null) {
      setState({ kind: "ready", srcdoc: staticHtml });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    void (async () => {
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files, entry }),
        });
        if (!res.ok) {
          const detail = (await res.text()).trim();
          throw new Error(detail || `Bundle failed (HTTP ${res.status})`);
        }
        const bundle = await res.text();
        if (!cancelled) setState({ kind: "ready", srcdoc: wrapBundle(bundle) });
      } catch (err) {
        if (!cancelled) setState({ kind: "error", message: String(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, entry, staticHtml]);

  if (state.kind === "loading") {
    return (
      <div className="h-full flex items-center justify-center gap-3 text-sm text-vs-muted">
        <span className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
        Bundling preview…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md text-center text-sm">
          <p className="font-semibold text-vs-text mb-1">Preview failed to build</p>
          <p className="text-vs-muted break-words">{state.message}</p>
          <p className="mt-3 text-xs text-vs-faint">
            The preview bundles locally with esbuild and should not need the
            internet. If this persists, check the generated code for errors.
          </p>
        </div>
      </div>
    );
  }

  return <iframe title="Preview" className="h-full w-full border-0 bg-white" srcDoc={state.srcdoc} />;
}

/** Minimal placeholder shown before the first generation. */
const PLACEHOLDER_FILES = {
  "/App.tsx": {
    code: `export default function App() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      fontFamily: "sans-serif",
      color: "#6b7280",
      flexDirection: "column",
      gap: "1rem",
    }}>
      <p style={{ fontSize: "2rem" }}>✨</p>
      <p>Your app will appear here.</p>
      <p style={{ fontSize: "0.875rem" }}>
        Describe what you want to build in the chat panel.
      </p>
    </div>
  );
}`,
  },
};

/** File paths treated as a valid entry point. */
const ENTRY_CANDIDATES = [
  "/index.tsx",
  "/index.jsx",
  "/index.js",
  "/src/index.tsx",
  "/src/index.jsx",
  "/src/index.js",
  "/src/main.tsx",
  "/src/main.jsx",
  "/src/main.ts",
  "/src/main.js",
  "/main.tsx",
  "/main.jsx",
  "/main.ts",
  "/main.js",
];

function hasEntry(files: Record<string, unknown>): boolean {
  return ENTRY_CANDIDATES.some((p) => p in files);
}

function detectEntry(files: Record<string, unknown>): string {
  for (const p of ENTRY_CANDIDATES) if (p in files) return p;
  return "/index.tsx";
}

/** Hidden support files we inject so the editor shows proper syntax + tabs. */
const SUPPORT_FILES: Record<string, { code: string; hidden: boolean }> = {
  "/tsconfig.json": {
    code: JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
        esModuleInterop: true,
        strict: false,
        lib: ["dom", "es2015"],
      },
      include: ["./**/*"],
    }),
    hidden: true,
  },
};

/** Conventional component entry points, in preference order. */
const APP_CANDIDATES = [
  "/src/App.tsx",
  "/src/App.jsx",
  "/App.tsx",
  "/App.jsx",
  "/src/App.ts",
  "/src/App.js",
  "/App.ts",
  "/App.js",
];

/** Find a runnable React component to mount, or null if there is none. */
function findAppFile(files: Record<string, unknown>): string | null {
  for (const p of APP_CANDIDATES) if (p in files) return p;
  // Fall back to any .tsx/.jsx file (best effort).
  return Object.keys(files).find((p) => /\.(tsx|jsx)$/.test(p)) ?? null;
}

/** Relative import specifier from `/index.tsx` to an absolute app path. */
function importSpecifier(appFile: string): string {
  const rel = appFile.replace(/^\//, "").replace(/\.(tsx|jsx|ts|js)$/, "");
  return `./${rel}`;
}

/** Conventional HTML entry points, in preference order. */
const HTML_CANDIDATES = ["/index.html", "/public/index.html", "/src/index.html"];

function findHtmlFile(files: Record<string, unknown>): string | null {
  for (const p of HTML_CANDIDATES) if (p in files) return p;
  return Object.keys(files).find((p) => /\.html?$/.test(p)) ?? null;
}

/** Entry that renders a friendly message when the project has no component. */
function placeholderEntry(files: string[]): string {
  const list = JSON.stringify(files);
  return `const root = document.getElementById("root");
if (root) {
  const files = ${list};
  root.innerHTML = '<div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:system-ui,sans-serif;color:#6b7280;text-align:center;padding:0 24px"><p style="font-size:1.5rem;margin:0">No runnable app yet</p><p style="font-size:0.875rem;margin:0;max-width:360px">Ask the swarm to build a React component (e.g. src/App.tsx) or an index.html, and a live preview will appear here.</p><p style="font-size:0.75rem;margin:0;color:#9ca3af;word-break:break-all">Files: ' + files.join(", ") + '</p></div>';
}`;
}

/**
 * Inline a static HTML page's local assets (`<link rel="stylesheet">` and
 * `<script src>`), resolving relative paths against the project file map.
 */
function inlineHtml(
  htmlPath: string,
  html: string,
  files: Record<string, string>,
): string {
  const baseDir = htmlPath.replace(/\/[^/]*$/, "");

  const resolve = (ref: string): string | null => {
    if (/^(https?:|data:|#|\/\/)/.test(ref)) return null;
    const clean = ref.split(/[?#]/)[0];
    const joined = (baseDir ? `${baseDir}/` : "") + clean;
    const parts = joined.split("/");
    const stack: string[] = [];
    for (const p of parts) {
      if (p === "" || p === ".") continue;
      if (p === "..") stack.pop();
      else stack.push(p);
    }
    const key = `/${stack.join("/")}`;
    return files[key] ?? null;
  };

  let out = html;

  // <link rel="stylesheet" href="x.css"> → <style>…</style>
  out = out.replace(
    /<link\b[^>]*\brel=["']?stylesheet["']?[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi,
    (tag, href: string) => {
      const css = resolve(href);
      return css !== null ? `<style>${css}</style>` : tag;
    },
  );

  // <script src="x.js"></script> and <script src="x.js" /> → inline
  out = out.replace(
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (tag, src: string) => {
      const js = resolve(src);
      return js !== null ? `<script>${js}</script>` : tag;
    },
  );
  out = out.replace(
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*\/>/gi,
    (tag, src: string) => {
      const js = resolve(src);
      return js !== null ? `<script>${js}</script>` : tag;
    },
  );

  return out;
}

/**
 * Build the full file set for a project (single-file apps get an injected
 * `/index.tsx` entry). Returns the Sandpack file map (for the editor) plus a
 * plain code map (for offline bundling) and the visible editor tabs.
 */
function buildSetup(
  projectFiles: Record<string, string>,
): {
  sandpack: Record<string, { code: string; hidden?: boolean }>;
  code: Record<string, string>;
  visible: string[];
  entry: string;
  staticHtml?: string;
} {
  const sandpack: Record<string, { code: string; hidden?: boolean }> = {};
  for (const [path, code] of Object.entries(projectFiles)) {
    sandpack[path.startsWith("/") ? path : `/${path}`] = { code };
  }

  const htmlFile = findHtmlFile(sandpack);

  if (!htmlFile && !hasEntry(sandpack)) {
    const appFile = findAppFile(sandpack);
    if (appFile) {
      sandpack["/index.tsx"] = {
        code: `import React from "react";
import { createRoot } from "react-dom/client";
import App from "${importSpecifier(appFile)}";

createRoot(document.getElementById("root")!).render(<App />);`,
      };
    } else {
      sandpack["/index.tsx"] = {
        code: placeholderEntry(
          Object.keys(sandpack).filter((p) => !p.startsWith("/index.")),
        ),
      };
    }
  }

  for (const [path, support] of Object.entries(SUPPORT_FILES)) {
    if (!(path in sandpack)) sandpack[path] = support;
  }

  const code: Record<string, string> = {};
  for (const [path, file] of Object.entries(sandpack)) code[path] = file.code;

  const visible = Object.keys(sandpack).filter((p) => !sandpack[p].hidden);

  let staticHtml: string | undefined;
  if (htmlFile) {
    staticHtml = inlineHtml(htmlFile, code[htmlFile], code);
  }

  return {
    sandpack,
    code,
    visible,
    entry: htmlFile ?? detectEntry(sandpack),
    staticHtml,
  };
}

export function SandpackPreview({
  showEditor = false,
  editorHeight = 320,
  onEditorResize,
  hidePreview = false,
}: Props): React.ReactNode {
  const files = useProjectStore((s) => s.files);
  const isGenerating = useProjectStore((s) => s.generation.isGenerating);
  const isDark = useThemeStore((s) => s.isDark);

  const hasFiles = Object.keys(files).length > 0;

  const setup = useMemo(
    () =>
      buildSetup(
        hasFiles ? files : { "/App.tsx": PLACEHOLDER_FILES["/App.tsx"].code },
      ),
    [files, hasFiles],
  );

  return (
    <div className="relative h-full">
      {/* First generation — block the placeholder while the app is built */}
      {isGenerating && !hasFiles && (
        <div className="absolute inset-0 z-10 bg-vs-bg/60 flex items-center justify-center gap-3 text-sm text-vs-text">
          <span className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
          Generating…
        </div>
      )}

      {/* Regeneration — non-blocking pill so the running app stays usable */}
      {isGenerating && hasFiles && !hidePreview && (
        <div className="absolute top-3 right-3 z-10 pointer-events-none flex items-center gap-2
                        px-3 py-1.5 rounded-full bg-vs-surface/90 border border-vs-border
                        shadow text-xs text-vs-muted">
          <span className="animate-spin w-3 h-3 border border-brand-500 border-t-transparent rounded-full" />
          Regenerating…
        </div>
      )}

      <SandpackProvider
        files={setup.sandpack}
        customSetup={{ entry: setup.entry }}
        theme={isDark ? "dark" : "light"}
        options={{ visibleFiles: setup.visible }}
      >
        <SyncActiveFile />
        {hidePreview ? (
          <CodeEditorPanel />
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
              <OfflinePreview
                files={setup.code}
                entry={setup.entry}
                staticHtml={setup.staticHtml}
              />
            </div>
            {showEditor && (
              <>
                <Resizer direction="vertical" onDrag={onEditorResize ?? (() => {})} />
                <div
                  className="shrink-0 border-t border-vs-border bg-vs-surface"
                  style={{ height: editorHeight }}
                >
                  <CodeEditorPanel />
                </div>
              </>
            )}
          </div>
        )}
      </SandpackProvider>
    </div>
  );
}

/**
 * The code drawer combines a file explorer and the code editor side-by-side
 * (like VS Code), so a single "Code" toggle gives both navigation and editing.
 */
function CodeEditorPanel(): ReactNode {
  return (
    <div className="flex h-full">
      <div className="w-44 shrink-0 border-r border-vs-border bg-vs-surface">
        <FileTree />
      </div>
      <div className="flex-1 min-w-0">
        <SandpackCodeEditor
          showLineNumbers
          showTabs
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );
}
