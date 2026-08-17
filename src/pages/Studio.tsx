/**
 * Studio — the main workspace page.
 *
 * Desktop layout (≥ 768 px):
 *   [ChatPanel ~38%] | [SandpackPreview ~62%]
 *   With code:   [FileTree 176px] | [Chat] | [Sandpack with editor]
 *
 * Swarm activity is NOT a separate column — it renders inline inside the
 * chat panel as a collapsible section, so the user's attention stays in the
 * conversation while the agents work.
 *
 * Mobile layout (< 768 px):
 *   Full-width tab switcher: Chat | Preview
 *
 * Phase 2 additions:
 * - ReconnectToast (2.12)
 * - Swarm activity inline in the chat (2.5, redesigned)
 * - Chat export to Markdown (2.11)
 * - Mobile tab layout (2.10)
 * - Wrapped in ErrorBoundary (1.16)
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChatPanel } from "../components/Chat/ChatPanel";
import { SandpackPreview } from "../components/Preview/SandpackPreview";
import { FileTree } from "../components/FileExplorer/FileTree";
import { ReconnectToast } from "../components/ReconnectToast";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { getClient, connectClient } from "../lib/client";
import { downloadProjectZip, exportChatMarkdown } from "../lib/export";
import { useSessionStore } from "../store/session";
import { useProjectStore } from "../store/project";
import { useThemeStore } from "../store/theme";

// Mobile tab options.
type MobileTab = "chat" | "preview";

function StudioInner(): React.ReactNode {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { setActive, activeProject, projects } = useSessionStore();
  const {
    generation, rewindStack, files, messages,
    loadFiles, popRewindSnapshot, restoreSnapshot,
  } = useProjectStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();

  const [showCode, setShowCode] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

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

    // Restore the last-known file map from the persisted session store.
    const meta = useSessionStore.getState().projects.find((p) => p.sessionId === sessionId);
    if (meta?.files && Object.keys(meta.files).length > 0) {
      loadFiles(meta.files);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Listen for rewind_done — pop snapshot and restore files.
  useEffect(() => {
    const client = getClient();
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

  const handleExportChat = (): void => {
    exportChatMarkdown(messages, project?.title ?? "project");
  };

  const hasFiles = Object.keys(files).length > 0;
  const hasMessages = messages.some((m) => m.role !== "status");

  const mobileTabs: MobileTab[] = ["chat", "preview"];

  return (
    <div className="h-screen flex flex-col bg-vs-bg overflow-hidden">
      {/* Reconnect toast (floats over everything) */}
      <ReconnectToast />

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-vs-border bg-vs-surface shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="text-xs text-vs-muted hover:text-vs-text transition-colors shrink-0"
          >
            ← Dashboard
          </Link>
          <span className="text-vs-faint shrink-0">|</span>
          <span className="text-sm font-medium text-vs-text truncate">
            {project?.title ?? sessionId ?? "Loading…"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {/* Agent status badge — hidden on very small screens */}
          {generation.isGenerating && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-brand-500 mr-1">
              <span className="animate-spin w-3 h-3 border border-brand-500 border-t-transparent rounded-full" />
              {generation.activeAgent ?? "Generating…"}
            </span>
          )}

          {/* Rewind */}
          {rewindStack.length > 0 && !generation.isGenerating && (
            <button
              onClick={handleRewind}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
                         bg-vs-raised hover:bg-vs-border text-vs-muted hover:text-vs-text
                         transition-colors border border-vs-border"
              title="Undo last generation"
            >
              ↩ Undo
            </button>
          )}

          {/* Download ZIP */}
          {hasFiles && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
                         bg-vs-raised hover:bg-vs-border text-vs-muted hover:text-vs-text
                         transition-colors border border-vs-border"
              title="Download project as ZIP"
            >
              ↓ ZIP
            </button>
          )}

          {/* Export chat as Markdown */}
          {hasMessages && (
            <button
              onClick={handleExportChat}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
                         bg-vs-raised hover:bg-vs-border text-vs-muted hover:text-vs-text
                         transition-colors border border-vs-border"
              title="Export chat as Markdown"
            >
              ↓ Chat
            </button>
          )}

          {/* Code toggle */}
          <button
            onClick={() => setShowCode((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
                        transition-colors border
                        ${showCode
                          ? "bg-brand-900 border-brand-700 text-brand-300"
                          : "bg-vs-raised border-vs-border text-vs-muted hover:text-vs-text hover:bg-vs-border"
                        }`}
            title={showCode ? "Hide file explorer and editor" : "Show file explorer and editor"}
          >
            {"</>"} {showCode ? "Hide" : "Code"}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="px-2.5 py-1.5 rounded-lg text-xs border border-vs-border
                       bg-vs-raised hover:bg-vs-border text-vs-muted hover:text-vs-text
                       transition-colors"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? "☀" : "☾"}
          </button>
        </div>
      </header>

      {/* Mobile tab bar (< md) */}
      <div className="md:hidden flex border-b border-vs-border bg-vs-surface shrink-0">
        {mobileTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors
                        ${mobileTab === tab
                          ? "text-brand-400 border-b-2 border-brand-500"
                          : "text-vs-muted hover:text-vs-text"
                        }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Desktop layout (≥ md) ─────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {showCode && (
          <div className="w-44 shrink-0 border-r border-vs-border">
            <FileTree />
          </div>
        )}

        <div className="w-[38%] shrink-0 border-r border-vs-border min-w-0">
          <ChatPanel />
        </div>

        <div className="flex-1 overflow-hidden min-w-0">
          <SandpackPreview showEditor={showCode} />
        </div>
      </div>

      {/* ── Mobile layout (< md) ──────────────────────────── */}
      <div className="md:hidden flex-1 overflow-hidden">
        <div className={`h-full ${mobileTab === "chat" ? "block" : "hidden"}`}>
          <ChatPanel />
        </div>
        <div className={`h-full ${mobileTab === "preview" ? "block" : "hidden"}`}>
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
