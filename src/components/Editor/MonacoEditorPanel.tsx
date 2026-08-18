/**
 * MonacoEditorPanel — lazy-loaded Monaco code editor synced with the project
 * store (Stages 2.3 + 2.4).
 *
 * Features:
 * - Lazy-loads @monaco-editor/react on first use (~4 MB, loaded from CDN).
 * - Scrollable tab strip showing all project files; dirty dot (●) on tabs with
 *   unsaved changes.
 * - Debounces user edits (800 ms) before writing back to the project store so
 *   the offline preview does not re-bundle every keystroke.
 * - Detects external file changes (from swarm generation) and updates the
 *   editor imperatively, suppressing the onChange callback to avoid loops.
 * - Flushes any pending debounced save before switching to a different file,
 *   so no edits are lost.
 * - Collapsible file tree toggle (same UX as the old Sandpack panel).
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { OnChange, OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useProjectStore } from "../../store/project";
import { useSessionStore } from "../../store/session";
import { useThemeStore } from "../../store/theme";
import { FileTree } from "../FileExplorer/FileTree";

// Monaco is large — load it only when the code drawer first opens.
const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.default })),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LANG_MAP: Record<string, string> = {
  ts: "typescript", tsx: "typescript",
  js: "javascript", jsx: "javascript",
  css: "css", scss: "css", less: "css",
  html: "html", htm: "html",
  json: "json",
  md: "markdown",
  py: "python",
  sh: "shell",
};

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANG_MAP[ext] ?? "plaintext";
}

/** Return both the slash-prefixed key and the raw key for a file path. */
function resolveKeys(path: string): { slashKey: string; rawKey: string } {
  const slashKey = path.startsWith("/") ? path : `/${path}`;
  return { slashKey, rawKey: slashKey.slice(1) };
}

/** Look up a file's content, trying both with and without a leading slash. */
function getContent(files: Record<string, string>, path: string): string {
  const { slashKey, rawKey } = resolveKeys(path);
  return files[slashKey] ?? files[rawKey] ?? "";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MonacoEditorPanel(): ReactNode {
  const files      = useProjectStore((s) => s.files);
  const activeFile = useProjectStore((s) => s.activeFile);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const updateFile = useProjectStore((s) => s.updateFile);
  const isDark     = useThemeStore((s) => s.isDark);

  const persistFiles    = useSessionStore((s) => s.persistFiles);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [showTree, setShowTree]     = useState(false);

  // Refs — never stale in callbacks.
  const editorRef         = useRef<editor.IStandaloneCodeEditor | null>(null);
  const suppressChangeRef = useRef(false);
  const debounceRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFlushRef   = useRef<(() => void) | null>(null);
  const tabBarRef         = useRef<HTMLDivElement>(null);

  // Keep refs in sync so the stable callbacks always see current values.
  const activeFileRef     = useRef(activeFile);
  const filesRef          = useRef(files);
  const updateFileRef     = useRef(updateFile);
  const persistFilesRef   = useRef(persistFiles);
  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => { activeFileRef.current      = activeFile; },      [activeFile]);
  useEffect(() => { filesRef.current           = files; },           [files]);
  useEffect(() => { updateFileRef.current      = updateFile; },      [updateFile]);
  useEffect(() => { persistFilesRef.current    = persistFiles; },    [persistFiles]);
  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  // Derived keys from activeFile.
  const { slashKey: activeSlash, rawKey: activeRaw } = activeFile
    ? resolveKeys(activeFile)
    : { slashKey: "", rawKey: "" };

  // All user file paths, normalised to have a leading slash for display.
  const userFilePaths = Object.keys(files).map((p) =>
    p.startsWith("/") ? p : `/${p}`,
  );

  // Content of the active file according to the store (source of truth).
  const storeContent = activeFile ? getContent(files, activeFile) : "";
  const prevStoreContentRef = useRef(storeContent);

  // ── Scroll the active tab into view ──────────────────────────────────────
  useEffect(() => {
    if (!tabBarRef.current || !activeFile) return;
    const el = tabBarRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeFile]);

  // ── Flush pending debounced save on file switch ───────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        pendingFlushRef.current?.();
        pendingFlushRef.current = null;
      }
    };
  }, [activeFile]);

  // ── Sync generation overwrites into the editor ────────────────────────────
  useEffect(() => {
    if (!editorRef.current || !activeFile) return;
    if (storeContent === prevStoreContentRef.current) return;
    prevStoreContentRef.current = storeContent;

    const editorContent = editorRef.current.getModel()?.getValue() ?? "";
    if (editorContent === storeContent) return; // already in sync

    // External change (generation) — update editor without triggering onChange.
    suppressChangeRef.current = true;
    editorRef.current.setValue(storeContent);
    suppressChangeRef.current = false;

    // Clear dirty indicator — swarm overwrote this file.
    setDirtyFiles((prev) => {
      const n = new Set(prev);
      n.delete(activeSlash);
      n.delete(activeRaw);
      return n;
    });
  }, [storeContent, activeFile, activeSlash, activeRaw]);

  // ── Editor callbacks (stable — use refs internally) ───────────────────────
  const handleMount: OnMount = useCallback((editorInstance) => {
    editorRef.current = editorInstance;
    // Reset content tracking for the new instance.
    prevStoreContentRef.current = getContent(filesRef.current, activeFileRef.current ?? "");
  }, []); // stable

  const handleChange: OnChange = useCallback((value) => {
    if (suppressChangeRef.current || !activeFileRef.current || value === undefined) return;

    const af = activeFileRef.current;
    const { slashKey: as, rawKey: ar } = resolveKeys(af);
    const fs = filesRef.current;

    setDirtyFiles((prev) => new Set([...prev, as]));

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Determine which key format this file is stored under.
    const storeKey = af in fs ? af : ar in fs ? ar : af;
    const capturedValue = value;

    const doFlush = () => {
      updateFileRef.current(storeKey, capturedValue);
      const sid = activeSessionIdRef.current;
      if (sid) persistFilesRef.current(sid, useProjectStore.getState().files);
      prevStoreContentRef.current = capturedValue;
      setDirtyFiles((prev) => {
        const n = new Set(prev);
        n.delete(as);
        n.delete(ar);
        return n;
      });
      pendingFlushRef.current = null;
    };

    pendingFlushRef.current = doFlush;
    debounceRef.current = setTimeout(() => {
      doFlush();
      debounceRef.current = null;
    }, 800);
  }, []); // stable — reads everything from refs

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-vs-bg">

      {/* ── Tab strip ───────────────────────────────────────────────────── */}
      <div
        ref={tabBarRef}
        className="flex items-stretch border-b border-vs-border bg-vs-surface shrink-0 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {userFilePaths.length === 0 ? (
          <span className="px-4 py-1.5 text-xs text-vs-faint italic select-none">
            No files yet
          </span>
        ) : (
          userFilePaths.map((path) => {
            const { rawKey } = resolveKeys(path);
            const name     = path.split("/").pop() ?? path;
            const isActive = path === activeSlash || rawKey === activeRaw;
            const isDirty  = dirtyFiles.has(path) || dirtyFiles.has(rawKey);

            return (
              <button
                key={path}
                data-active={isActive ? "true" : undefined}
                onClick={() => setActiveFile(rawKey)}
                title={path}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs shrink-0",
                  "border-r border-vs-border transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-vs-bg text-vs-text border-b-2 border-b-brand-500"
                    : "text-vs-muted hover:text-vs-text hover:bg-vs-raised",
                ].join(" ")}
              >
                {isDirty && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0"
                    title="Unsaved changes"
                  />
                )}
                <span className="max-w-[140px] truncate">{name}</span>
              </button>
            );
          })
        )}
      </div>

      {/* ── Editor area ─────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 min-h-0">
        {showTree && (
          <div className="w-44 shrink-0 border-r border-vs-border bg-vs-surface overflow-y-auto">
            <FileTree />
          </div>
        )}

        <div className="flex-1 min-w-0 min-h-0">
          {activeFile ? (
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center gap-2 text-xs text-vs-muted">
                  <span className="animate-spin w-3 h-3 border border-brand-500 border-t-transparent rounded-full" />
                  Loading editor…
                </div>
              }
            >
              {/*
               * Keyed on activeSlash so Monaco remounts with the correct
               * defaultValue whenever the active file switches. The pending-
               * flush effect ensures the previous file's edits are saved first.
               */}
              <MonacoEditor
                key={activeSlash}
                height="100%"
                defaultValue={storeContent}
                language={detectLanguage(activeSlash)}
                theme={isDark ? "vs-dark" : "light"}
                onMount={handleMount}
                onChange={handleChange}
                options={{
                  fontSize: 13,
                  lineNumbers: "on",
                  minimap: { enabled: true },
                  wordWrap: "off",
                  scrollBeyondLastLine: false,
                  renderLineHighlight: "line",
                  overviewRulerLanes: 0,
                  padding: { top: 8 },
                  tabSize: 2,
                  insertSpaces: true,
                }}
              />
            </Suspense>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-vs-muted">
              Select a file to edit
            </div>
          )}
        </div>

        {/* File tree toggle */}
        <button
          onClick={() => setShowTree((v) => !v)}
          className={[
            "absolute top-1.5 right-1.5 z-10 flex items-center gap-1",
            "px-1.5 py-1 rounded-md text-[10px] font-medium border transition-colors shadow-sm",
            showTree
              ? "bg-brand-500/15 border-brand-500/40 text-brand-300"
              : "bg-vs-surface/90 border-vs-border text-vs-muted hover:text-vs-text backdrop-blur",
          ].join(" ")}
          title={showTree ? "Hide file list" : "Show file list"}
        >
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Files
        </button>
      </div>
    </div>
  );
}
