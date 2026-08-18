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
import { Resizer } from "../components/Resizer";
import { ReconnectToast } from "../components/ReconnectToast";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { getClient, connectClient } from "../lib/client";
import { downloadProjectZip } from "../lib/export";
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
    generation, rewindStack, files,
    loadFiles, loadMessages, popRewindSnapshot, restoreSnapshot,
  } = useProjectStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const {
    chatWidth, codeHeight, setChatWidth, setCodeHeight,
  } = useLayoutStore();

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

    // Restore the last-known file map and chat messages from the persisted session store.
    const meta = useSessionStore.getState().projects.find((p) => p.sessionId === sessionId);
    if (meta?.files && Object.keys(meta.files).length > 0) {
      loadFiles(meta.files);
    }
    if (meta?.messages && meta.messages.length > 0) {
      loadMessages(meta.messages as import("../store/project").ChatMessage[]);
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

  const hasFiles = Object.keys(files).length > 0;

  const mobileTabs: MobileTab[] = ["chat", "preview", "code"];

  const handleChatResize = (delta: number): void => {
    setChatWidth(clamp(chatWidth + delta, CHAT_WIDTH_MIN, CHAT_WIDTH_MAX));
  };

  const handleCodeResize = (delta: number): void => {
    setCodeHeight(clamp(codeHeight + delta, CODE_HEIGHT_MIN, CODE_HEIGHT_MAX));
  };

  return (
    <div className="h-screen flex flex-col bg-vs-bg overflow-hidden">
      {/* Reconnect toast (floats over everything) */}
      <ReconnectToast />

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-vs-border bg-vs-surface shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="shrink-0 group flex items-center gap-2"
            title="Back to dashboard"
          >
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-brand-500/30">
              V
            </span>
            <span className="hidden sm:block text-xs text-vs-muted group-hover:text-vs-text transition-colors">
              Dashboard
            </span>
          </Link>
          <span className="text-vs-faint shrink-0 select-none">/</span>
          <span className="text-sm font-semibold text-vs-text truncate tracking-tight">
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

          {/* Code drawer toggle (explorer + editor) */}
          <button
            onClick={() => setShowCode((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                        transition-all border
                        ${showCode
                          ? "bg-brand-500/15 border-brand-500/40 text-brand-300"
                          : "bg-vs-raised border-vs-border text-vs-muted hover:text-vs-text hover:border-vs-border-light"}`}
            title={showCode ? "Hide code" : "Show code (files + editor)"}
          >
            {"</>"} Code
          </button>

          {/* Rewind */}
          {rewindStack.length > 0 && !generation.isGenerating && (
            <button
              onClick={handleRewind}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                         bg-vs-raised hover:bg-vs-border text-vs-muted hover:text-vs-text
                         transition-colors border border-vs-border hover:border-vs-border-light"
              title="Undo last generation"
            >
              ↩ Undo
            </button>
          )}

          {/* Download ZIP */}
          {hasFiles && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                         bg-vs-raised hover:bg-vs-border text-vs-muted hover:text-vs-text
                         transition-colors border border-vs-border hover:border-vs-border-light"
              title="Download the project"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m7 10 5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
              Download
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
        <div className={`h-full ${mobileTab === "code" ? "block" : "hidden"}`}>
          <SandpackPreview showEditor hidePreview />
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
