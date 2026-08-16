/**
 * Studio — the main workspace page.
 *
 * Default layout (Base44-style):
 *   [ChatPanel ~40%] | [SandpackPreview ~60%]
 *
 * With code panel open:
 *   [FileTree 180px] | [ChatPanel ~40%] | [SandpackPreview with editor ~60%]
 *
 * Features:
 * - Restores persisted files on mount (Stage 1.12 / 1.13).
 * - Full rewind cycle via rewind_done event (Stage 1.14).
 * - ZIP download button (Stage 1.11).
 * - Wrapped in ErrorBoundary (Stage 1.16).
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChatPanel } from "../components/Chat/ChatPanel";
import { SandpackPreview } from "../components/Preview/SandpackPreview";
import { FileTree } from "../components/FileExplorer/FileTree";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { getClient, connectClient } from "../lib/client";
import { downloadProjectZip } from "../lib/export";
import { useSessionStore } from "../store/session";
import { useProjectStore } from "../store/project";
import { useThemeStore } from "../store/theme";

function StudioInner(): React.ReactNode {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { setActive, activeProject, projects } = useSessionStore();
  const {
    generation, rewindStack, files,
    loadFiles, popRewindSnapshot, restoreSnapshot,
  } = useProjectStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const [showCode, setShowCode] = useState(false);

  // Connect, activate session, and restore persisted files.
  useEffect(() => {
    if (!sessionId) return;
    setActive(sessionId);

    connectClient()
      .then(() => {
        const client = getClient();
        client.sessions.setActive(sessionId);
      })
      .catch(console.error);

    // Restore the last-known file map from the persisted session store (Stage 1.12/1.13).
    const meta = useSessionStore.getState().projects.find((p) => p.sessionId === sessionId);
    if (meta?.files && Object.keys(meta.files).length > 0) {
      loadFiles(meta.files);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Listen for rewind_done — pop snapshot and restore files (Stage 1.14).
  useEffect(() => {
    const client = getClient();
    // Cast needed because the SDK's event typings don't enumerate every event name.
    const onRewindDone = (): void => {
      const snapshot = popRewindSnapshot();
      if (snapshot !== null) restoreSnapshot(snapshot);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).on("rewind_done", onRewindDone);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).off("rewind_done", onRewindDone);
    };
  }, [popRewindSnapshot, restoreSnapshot]);

  const project = activeProject() ?? projects.find((p) => p.sessionId === sessionId);

  const handleRewind = (): void => {
    const latest = rewindStack[rewindStack.length - 1];
    if (latest) getClient().rewind(latest.msgId);
  };

  const handleDownload = (): void => {
    downloadProjectZip(files, project?.title ?? "project");
  };

  return (
    <div className="h-screen flex flex-col bg-vs-bg overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-vs-border bg-vs-surface shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-xs text-vs-muted hover:text-vs-text transition-colors"
          >
            ← Dashboard
          </Link>
          <span className="text-vs-faint">|</span>
          <span className="text-sm font-medium text-vs-text truncate max-w-xs">
            {project?.title ?? sessionId ?? "Loading…"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Agent status badge */}
          {generation.isGenerating && (
            <span className="flex items-center gap-1.5 text-xs text-brand-500">
              <span className="animate-spin w-3 h-3 border border-brand-500 border-t-transparent rounded-full" />
              {generation.activeAgent ?? "Generating…"}
            </span>
          )}

          {/* Rewind / Undo — only when there's something to undo */}
          {rewindStack.length > 0 && !generation.isGenerating && (
            <button
              onClick={handleRewind}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                         bg-vs-raised hover:bg-vs-border text-vs-muted hover:text-vs-text
                         transition-colors border border-vs-border"
              title="Undo last generation"
            >
              ↩ Undo
            </button>
          )}

          {/* Download ZIP — only when files exist */}
          {Object.keys(files).length > 0 && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                         bg-vs-raised hover:bg-vs-border text-vs-muted hover:text-vs-text
                         transition-colors border border-vs-border"
              title="Download project as ZIP"
            >
              ↓ ZIP
            </button>
          )}

          {/* Code toggle */}
          <button
            onClick={() => setShowCode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                        transition-colors border
                        ${showCode
                          ? "bg-brand-900 border-brand-700 text-brand-300"
                          : "bg-vs-raised border-vs-border text-vs-muted hover:text-vs-text hover:bg-vs-border"
                        }`}
            title={showCode ? "Hide file explorer and editor" : "Show file explorer and editor"}
          >
            {"</>"}  {showCode ? "Hide code" : "Code"}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="px-3 py-1.5 rounded-lg text-xs border border-vs-border
                       bg-vs-raised hover:bg-vs-border text-vs-muted hover:text-vs-text
                       transition-colors"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
      </header>

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {showCode && (
          <div className="w-44 shrink-0 border-r border-vs-border">
            <FileTree />
          </div>
        )}

        <div className="w-[38%] shrink-0 border-r border-vs-border">
          <ChatPanel />
        </div>

        <div className="flex-1 overflow-hidden">
          <SandpackPreview showEditor={showCode} />
        </div>
      </div>
    </div>
  );
}

export function Studio(): React.ReactNode {
  return (
    <ErrorBoundary context="Studio">
      <StudioInner />
    </ErrorBoundary>
  );
}
