/**
 * SandpackPreview — live sandboxed preview (and optional code drawer) for the
 * generated project files, powered by @codesandbox/sandpack-react.
 *
 * Layout: the preview is the hero surface. The code editor (when enabled) is a
 * resizable drawer at the bottom — a vertical split — so it never squeezes the
 * preview sideways. The editor's active file is driven by the project store,
 * so clicking a file in the tree opens it here.
 *
 * The Sandpack theme tracks the global dark/light preference.
 * Note: the live preview runs in an iframe with its own document — its
 * background colour is determined by the generated app's own CSS, not by
 * VibeStudio's theme.
 */
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewPane,
  SandpackCodeEditor,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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

const STATUS_LABELS: Record<string, string> = {
  initializing: "Starting…",
  "installing-dependencies": "Installing dependencies…",
  transpiling: "Transpiling…",
  evaluating: "Running…",
  idle: "Idle",
  done: "",
};

/**
 * Surfaces Sandpack bundler state: a friendly loading pill while compiling,
 * and a clear error card instead of a silent white screen when the preview
 * fails to load (commonly a network issue reaching CodeSandbox).
 */
function PreviewStatusOverlay({ hidePreview }: { hidePreview: boolean }): ReactNode | null {
  const { sandpack } = useSandpack();
  const [showSlow, setShowSlow] = useState(false);

  // If the bundler hasn't finished after a while, surface a network hint
  // instead of an endless spinner / white screen.
  useEffect(() => {
    const t = setTimeout(() => setShowSlow(true), 20000);
    return () => clearTimeout(t);
  }, []);

  if (sandpack.error) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-vs-bg/80 p-6">
        <div className="max-w-md text-center text-sm">
          <p className="font-semibold text-vs-text mb-1">Preview failed to load</p>
          <p className="text-vs-muted break-words">{sandpack.error.message}</p>
          <p className="mt-3 text-xs text-vs-faint">
            Usually a network issue reaching CodeSandbox's bundler — the code in
            the editor is still saved.
          </p>
        </div>
      </div>
    );
  }

  if (!hidePreview && sandpack.status && sandpack.status !== "done" && sandpack.status !== "idle") {
    if (showSlow) {
      return (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-vs-bg/80 p-6">
          <div className="max-w-md text-center text-sm">
            <p className="font-semibold text-vs-text mb-1">Preview is taking a long time…</p>
            <p className="text-vs-muted">
              The bundler needs to reach CodeSandbox to fetch React. On this
              network it seems blocked — the code is fine, but the live preview
              can't start.
            </p>
            <p className="mt-3 text-xs text-vs-faint">
              Try the ↓ ZIP download to run the project locally.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="absolute top-3 right-3 z-10 pointer-events-none flex items-center gap-2
                      px-3 py-1.5 rounded-full bg-vs-surface/90 border border-vs-border
                      shadow text-xs text-vs-muted">
        <span className="animate-spin w-3 h-3 border border-brand-500 border-t-transparent rounded-full" />
        {STATUS_LABELS[sandpack.status] ?? sandpack.status}
      </div>
    );
  }

  return null;
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

/** File paths Sandpack treats as a valid entry point. */
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

/**
 * Ensure the project has an entry file Sandpack can mount. Generated apps are
 * often a single `src/App.tsx` with no `index.tsx`/`main.tsx` — without one,
 * Sandpack's react-ts template shows an error instead of the app. When no
 * known entry exists, inject a minimal `/index.tsx` that renders App.
 */
function withEntry(
  files: Record<string, string>,
): Record<string, { code: string }> {
  const sandpack = Object.fromEntries(
    Object.entries(files).map(([path, code]) => [path, { code }]),
  );

  if (ENTRY_CANDIDATES.some((path) => path in sandpack)) return sandpack;

  const appPath = "/src/App.tsx" in sandpack ? "/src/App.tsx" : "/App.tsx";
  const importPath = appPath.startsWith("/src/") ? "./src/App" : "./App";

  sandpack["/index.tsx"] = {
    code: `import React from "react";
import { createRoot } from "react-dom/client";
import App from "${importPath}";

createRoot(document.getElementById("root")!).render(<App />);`,
  };

  return sandpack;
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

  const sandpackFiles = withEntry(
    hasFiles
      ? Object.fromEntries(
          Object.entries(files).map(([path, code]) => [
            path.startsWith("/") ? path : `/${path}`,
            code,
          ]),
        )
      : { "/App.tsx": PLACEHOLDER_FILES["/App.tsx"].code },
  );

  // Only show the project's own files (plus the injected entry) in the editor —
  // the react-ts template otherwise merges in a default Hello-world App.tsx.
  const visibleFiles = Object.keys(sandpackFiles);

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
        files={sandpackFiles}
        template="react-ts"
        theme={isDark ? "dark" : "light"}
        options={{ visibleFiles }}
      >
        <SyncActiveFile />
        <PreviewStatusOverlay hidePreview={hidePreview} />
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
              <SandpackPreviewPane style={{ height: "100%" }} showNavigator={false} />
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
