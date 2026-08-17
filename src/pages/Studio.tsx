/**
 * Studio — the main workspace page.
 *
 * Layout principles:
 * - Chat is the driver, Preview is the hero. The preview always gets the
 *   remaining space; code opens as a resizable drawer at its bottom (vertical
 *   split) instead of squeezing it sideways.
 * - Files is a collapsible left drawer. Selecting a file opens it in the code
 *   drawer (and auto-opens the drawer).
 * - The chat column is resizable via a drag handle; sizes persist in the
 *   layout store.
 * - Swarm activity lives inline inside the chat panel.
 *
 * Mobile layout (< 768 px):
 *   Full-width tab switcher: Chat | Preview | Code
 *
 * Phase 2 additions:
 * - ReconnectToast (2.12)
 * - Resizable layout + drawers (redesigned)
 * - Chat export to Markdown (2.11)
 * - Mobile tab layout (2.10)
 * - Wrapped in ErrorBoundary (1.16)
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChatPanel } from "../components/Chat/ChatPanel";
import { SandpackPreview } from "../components/Preview/SandpackPreview";
import { FileTree } from "../components/FileExplorer/FileTree";
import { Resizer } from "../components/Resizer";
import { ReconnectToast } from "../components/ReconnectToast";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { getClient, connectClient } from "../lib/client";
import { downloadProjectZip, exportChatMarkdown } from "../lib/export";
import { useSessionStore } from "../store/session";
import { useProjectStore } from "../store/project";
import { useThemeStore } from "../store/theme";
import {
  useLayoutStore,
  CHAT_WIDTH_MIN,
  CHAT_WIDTH_MAX,
  CODE_HEIGHT_MIN,
  CODE_HEIGHT_MAX,
} from "../store/layout";

// Mobile tab options.
type MobileTab = "chat" | "preview" | "code";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function StudioInner(): React.ReactNode {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { setActive, activeProject, projects } = useSessionStore();
  const {
    generation, rewindStack, files, messages,
    loadFiles, popRewindSnapshot, restoreSnapshot,
  } = useProjectStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const {
    chatWidth, codeHeight, setChatWidth, setCodeHeight,
  } = useLayoutStore();

  const [showFiles, setShowFiles] = useState(false);
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

  const mobileTabs: MobileTab[] = ["chat", "preview", "code"];

  const handleChatResize = (delta: number): void => {
    setChatWidth(clamp(chatWidth + delta, CHAT_WIDTH_MIN, CHAT_WIDTH_MAX));
  };

  const handleCodeResize = (delta: number): void => {
    setCodeHeight(clamp(codeHeight + delta, CODE_HEIGHT_MIN, CODE_HEIGHT_MAX));
  };

  // Clicking a file opens it in the code drawer.
  const handleFileSelect = (): void => setShowCode(true);

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

          {/* Files drawer toggle */}
          <button
            onClick={() => setShowFiles((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
                        transition-colors border
                        ${showFiles
                          ? "bg-brand-900 border-brand-700 text-brand-300"
                          : "bg-vs-raised border-vs-border text-vs-muted hover:text-vs-text hover:bg-vs-border"
                        }`}
            title={showFiles ? "Hide file explorer" : "Show file explorer"}
          >
            Files
          </button>

          {/* Code drawer toggle */}
          <button
            onClick={() => setShowCode((v) => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
                        transition-colors border
                        ${showCode
                          ? "bg-brand-900 border-brand-700 text-brand-300"
                          : "bg-vs-raised border-vs-border text-vs-muted hover:text-vs-text hover:bg-vs-border"
                        }`}
            title={showCode ? "Hide code editor" : "Show code editor"}
          >
            {"</>"}
          </button>

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
        {showFiles && (
          <div className="w-56 shrink-0 border-r border-vs-border">
            <FileTree onSelect={handleFileSelect} />
          </div>
        )}

        <div
          style={{ width: chatWidth }}
          className="shrink-0 border-r border-vs-border min-w-0"
        >
          <ChatPanel />
        </div>

        <Resizer direction="horizontal" onDrag={handleChatResize} />

        <div className="flex-1 overflow-hidden min-w-0">
          <SandpackPreview
            showEditor={showCode}
            editorHeight={codeHeight}
            onEditorResize={handleCodeResize}
          />
        </div>
      </div>

      {/* ── Mobile layout (< md) ──────────────────────────── */}
      <div className="md:hidden flex-1 overflow-hidden">
        <div className={`h-full ${mobileTab === "chat" ? "block" : "hidden"}`}>
          <ChatPanel />
        </div>
        <div className={`h-full ${mobileTab === "preview" ? "block" : "hidden"}`}>
          <SandpackPreview />
        </div>
        <div className={`h-full flex flex-col ${mobileTab === "code" ? "block" : "hidden"}`}>
          <div className="shrink-0 max-h-48 overflow-y-auto border-b border-vs-border">
            <FileTree onSelect={() => setMobileTab("code")} />
          </div>
          <div className="flex-1 min-h-0">
            <SandpackPreview showEditor hidePreview />
          </div>
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
