/**
 * SandpackPreview — live preview + Monaco code editor.
 *
 * The live preview is bundled locally by the Vite dev server
 * (POST /api/preview → esbuild, resolving React from local node_modules), so
 * it works without reaching CodeSandbox/unpkg. The code editor is Monaco
 * (lazy-loaded, Stages 2.3 + 2.4), replacing the former Sandpack CodeMirror.
 *
 * Layout: the preview is the hero surface; the code editor (when enabled) is a
 * resizable drawer at the bottom — a vertical split — so it never squeezes the
 * preview sideways. Clicking a file in the tree or a tab in the editor opens it.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useProjectStore } from "../../store/project";
import { Resizer } from "../Resizer";
import { MonacoEditorPanel } from "../Editor/MonacoEditorPanel";

interface Props {
  showEditor?: boolean;
  /** Height of the bottom code drawer in px. */
  editorHeight?: number;
  /** Called with a pixel delta while the user drags the drawer resize handle. */
  onEditorResize?: (delta: number) => void;
  /** Hide the preview pane entirely (used by the mobile Code tab). */
  hidePreview?: boolean;
}

// ---------------------------------------------------------------------------
// Offline preview (unchanged from Phase 1)
// ---------------------------------------------------------------------------

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

/** Resolve a relative href against a project path (e.g. "/index.html"). */
function resolvePath(base: string, href: string): string {
  if (href.startsWith("/")) return href;
  const dir = base.slice(0, base.lastIndexOf("/") + 1);
  const joined = dir + href;
  const parts = joined.split("/");
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return "/" + stack.join("/");
}

/** Injected into static HTML so internal link clicks stay inside the preview. */
const NAV_SCRIPT = `<script>
(function () {
  function onClick(e) {
    var el = e.target;
    while (el && el !== document && el.nodeName !== "A") el = el.parentElement;
    if (!el || el.nodeName !== "A") return;
    var href = el.getAttribute("href");
    if (!href) return;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.slice(0, 2) === "//") return;

    // Same-page anchor — scroll, don't let the iframe navigate to the parent URL.
    if (href.charAt(0) === "#") {
      e.preventDefault();
      var id = decodeURIComponent(href.slice(1));
      var target = id ? document.getElementById(id) : null;
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Internal page link — hand the path to the parent.
    e.preventDefault();
    parent.postMessage({ vstudio: true, type: "navigate", path: href }, "*");
  }
  // Capture phase so it runs before the page's own click handlers.
  document.addEventListener("click", onClick, true);
})();
</script>`;

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
  const currentPathRef = useRef(entry);

  useEffect(() => {
    if (staticHtml != null) {
      currentPathRef.current = entry;
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

  // Static sites: handle internal link navigation (relative hrefs stay in the
  // preview instead of escaping to the dev server).
  useEffect(() => {
    if (staticHtml == null) return;
    const onMessage = (ev: MessageEvent): void => {
      const d = ev.data as { vstudio?: boolean; type?: string; path?: string } | null;
      if (!d || !d.vstudio || d.type !== "navigate" || !d.path) return;
      const resolved = resolvePath(currentPathRef.current, d.path);
      const content = files[resolved] ?? files[resolved.replace(/^\//, "")];
      if (content !== undefined) {
        currentPathRef.current = resolved;
        setState({ kind: "ready", srcdoc: inlineHtml(resolved, content, files) });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [staticHtml, files]);

  if (state.kind === "loading") {
    return (
      <div className="h-full flex items-center justify-center gap-3 text-sm text-vs-muted">
        <span className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
        Preparing preview…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-md text-center text-sm">
          <p className="font-semibold text-vs-text mb-1">Preview failed to build</p>
          <p className="text-vs-muted break-words">{state.message}</p>
          <button
            onClick={() =>
              useProjectStore.getState().setPendingPrompt(
                `The preview failed to build with this error:\n${state.message}\n\nPlease fix the code and rebuild.`,
              )
            }
            className="mt-4 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors"
          >
            Ask the swarm to fix
          </button>
          <p className="mt-3 text-xs text-vs-faint">
            The preview builds locally, so this is a code error — not a network
            issue.
          </p>
        </div>
      </div>
    );
  }

  return <iframe title="Preview" className="h-full w-full border-0 bg-vs-surface" srcDoc={state.srcdoc} />;
}

// ---------------------------------------------------------------------------
// Placeholder + entry-point detection (unchanged)
// ---------------------------------------------------------------------------

/** Minimal placeholder shown before the first generation. */
const PLACEHOLDER_FILES: Record<string, string> = {
  "/App.tsx": `export default function App() {
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
};

/**
 * File paths treated as a valid entry point. Matched by path suffix so that
 * projects nested under an arbitrary folder (e.g. "react-counter/src/main.jsx")
 * are still detected.
 */
const ENTRY_SUFFIXES = [
  "/index.tsx", "/index.jsx", "/index.js",
  "/src/index.tsx", "/src/index.jsx", "/src/index.js",
  "/src/main.tsx", "/src/main.jsx", "/src/main.ts", "/src/main.js",
  "/main.tsx", "/main.jsx", "/main.ts", "/main.js",
];

/** True when a path looks like an entry point (index.* / main.*), regardless of folder. */
function isEntryPath(path: string): boolean {
  return /(^|\/)(index|main)\.[tj]sx?$/.test(path);
}

function findEntry(files: Record<string, unknown>): string | null {
  for (const suffix of ENTRY_SUFFIXES) {
    for (const p of Object.keys(files)) {
      if (p.endsWith(suffix)) return p;
    }
  }
  return null;
}

const APP_CANDIDATES = [
  "/src/App.tsx", "/src/App.jsx", "/App.tsx", "/App.jsx",
  "/src/App.ts",  "/src/App.js",  "/App.ts",  "/App.js",
];

function findAppFile(files: Record<string, unknown>): string | null {
  for (const p of APP_CANDIDATES) if (p in files) return p;
  return (
    Object.keys(files).find(
      (p) => /\.(tsx|jsx)$/.test(p) && !isEntryPath(p),
    ) ?? null
  );
}

function importSpecifier(appFile: string): string {
  const rel = appFile.replace(/^\//, "").replace(/\.(tsx|jsx|ts|js)$/, "");
  return `./${rel}`;
}

const HTML_CANDIDATES = ["/index.html", "/public/index.html", "/src/index.html"];

function findHtmlFile(files: Record<string, unknown>): string | null {
  for (const p of HTML_CANDIDATES) if (p in files) return p;
  return Object.keys(files).find((p) => /\.html?$/.test(p)) ?? null;
}

function placeholderEntry(files: string[]): string {
  const list = JSON.stringify(files);
  return `const root = document.getElementById("root");
if (root) {
  const files = ${list};
  root.innerHTML = '<div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:system-ui,sans-serif;color:#6b7280;text-align:center;padding:0 24px"><p style="font-size:1.5rem;margin:0">No runnable app yet</p><p style="font-size:0.875rem;margin:0;max-width:360px">Ask the swarm to build a React component (e.g. src/App.tsx) or an index.html, and a live preview will appear here.</p><p style="font-size:0.75rem;margin:0;color:#9ca3af;word-break:break-all">Files: ' + files.join(", ") + '</p></div>';
}`;
}

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

  out = out.replace(
    /<link\b[^>]*\brel=["']?stylesheet["']?[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi,
    (tag, href: string) => {
      const css = resolve(href);
      return css !== null ? `<style>${css}</style>` : tag;
    },
  );

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

  // Keep internal link clicks inside the preview. Inject before </body> (or
  // </html>) so it reliably executes within the parsed document.
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, NAV_SCRIPT + "</body>");
  } else if (/<\/html>/i.test(out)) {
    out = out.replace(/<\/html>/i, NAV_SCRIPT + "</html>");
  } else {
    out += NAV_SCRIPT;
  }

  return out;
}

/**
 * Build the code map for the offline preview. Injects a minimal /index.tsx
 * entry-point shim if the project has a component but no index file, and
 * inlines HTML assets for static pages.
 */
function buildSetup(projectFiles: Record<string, string>): {
  code: Record<string, string>;
  entry: string;
  staticHtml?: string;
} {
  // Normalise all paths to have a leading slash.
  const code: Record<string, string> = {};
  for (const [path, content] of Object.entries(projectFiles)) {
    code[path.startsWith("/") ? path : `/${path}`] = content;
  }

  const htmlFile = findHtmlFile(code);

  // A project with TS/JSX sources needs esbuild bundling, even when it also
  // ships an index.html (a Vite/React scaffold). Only treat it as a static site
  // when the HTML has no bundler sources to compile.
  const hasBundleSource = Object.keys(code).some(
    (p) => /\.(tsx|jsx|ts)$/.test(p) && !p.endsWith(".d.ts"),
  );
  const isStatic = htmlFile !== null && !hasBundleSource;

  if (!isStatic && findEntry(code) === null) {
    const appFile = findAppFile(code);
    if (appFile) {
      code["/index.tsx"] = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "${importSpecifier(appFile)}";

createRoot(document.getElementById("root")!).render(<App />);`;
    } else {
      code["/index.tsx"] = placeholderEntry(
        Object.keys(code).filter((p) => !p.startsWith("/index.")),
      );
    }
  }

  const staticHtml = isStatic
    ? inlineHtml(htmlFile!, code[htmlFile!], code)
    : undefined;

  return { code, entry: isStatic ? htmlFile! : (findEntry(code) ?? "/index.tsx"), staticHtml };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SandpackPreview({
  showEditor = false,
  editorHeight = 320,
  onEditorResize,
  hidePreview = false,
}: Props): React.ReactNode {
  const files = useProjectStore((s) => s.files);

  const hasFiles = Object.keys(files).length > 0;

  const setup = useMemo(
    () => buildSetup(hasFiles ? files : PLACEHOLDER_FILES),
    [files, hasFiles],
  );

  return (
    <div className="relative h-full">
      {hidePreview ? (
        <MonacoEditorPanel />
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
                <MonacoEditorPanel />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
