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
  | { kind: "ready"; bundle: string }
  | { kind: "error"; message: string };

/**
 * Offline live preview. POSTs the project files to the dev server, which
 * bundles them with esbuild (resolving React from local node_modules), then
 * runs the returned IIFE bundle inside an iframe.
 */
function OfflinePreview({
  files,
  entry,
}: {
  files: Record<string, string>;
  entry: string;
}): ReactNode {
  const [state, setState] = useState<PreviewState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    void (async () => {
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files, entry }),
        });
        if (!res.ok) throw new Error(`Bundle failed (HTTP ${res.status})`);
        const bundle = await res.text();
        if (!cancelled) setState({ kind: "ready", bundle });
      } catch (err) {
        if (!cancelled) setState({ kind: "error", message: String(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, entry]);

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

  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8" /><style>html,body,#root{height:100%;margin:0;}</style></head><body><div id="root"></div><script>' +
    state.bundle +
    "</scr" +
    "ipt></body></html>";

  return <iframe title="Preview" className="h-full w-full border-0 bg-white" srcDoc={html} />;
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
} {
  const sandpack: Record<string, { code: string; hidden?: boolean }> = {};
  for (const [path, code] of Object.entries(projectFiles)) {
    sandpack[path.startsWith("/") ? path : `/${path}`] = { code };
  }

  if (!hasEntry(sandpack)) {
    const appPath = "/src/App.tsx" in sandpack ? "/src/App.tsx" : "/App.tsx";
    const importPath = appPath.startsWith("/src/") ? "./src/App" : "./App";
    sandpack["/index.tsx"] = {
      code: `import React from "react";
import { createRoot } from "react-dom/client";
import App from "${importPath}";

createRoot(document.getElementById("root")!).render(<App />);`,
    };
  }

  for (const [path, support] of Object.entries(SUPPORT_FILES)) {
    if (!(path in sandpack)) sandpack[path] = support;
  }

  const code: Record<string, string> = {};
  for (const [path, file] of Object.entries(sandpack)) code[path] = file.code;

  const visible = Object.keys(sandpack).filter((p) => !sandpack[p].hidden);
  return { sandpack, code, visible, entry: detectEntry(sandpack) };
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
        template="react-ts"
        theme={isDark ? "dark" : "light"}
        options={{ visibleFiles: setup.visible }}
      >
        <SyncActiveFile />
        {hidePreview ? (
          <div className="h-full">
            <SandpackCodeEditor
              showLineNumbers
              showTabs
              style={{ height: "100%" }}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
              <OfflinePreview files={setup.code} entry={setup.entry} />
            </div>
            {showEditor && (
              <>
                <Resizer direction="vertical" onDrag={onEditorResize ?? (() => {})} />
                <div
                  className="shrink-0 border-t border-vs-border bg-vs-surface"
                  style={{ height: editorHeight }}
                >
                  <SandpackCodeEditor
                    showLineNumbers
                    showTabs
                    style={{ height: "100%" }}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </SandpackProvider>
    </div>
  );
}
