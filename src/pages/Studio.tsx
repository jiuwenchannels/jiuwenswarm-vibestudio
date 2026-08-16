/**
 * Studio — the main workspace page.
 *
 * Default layout (Base44-style):
 *   [ChatPanel ~40%] | [SandpackPreview ~60%]
 *
 * With code panel open:
 *   [FileTree 180px] | [ChatPanel ~40%] | [SandpackPreview ~60%]
 *
 * The session ID comes from the URL param (:sessionId).  On mount we
 * ensure the SDK's active session is set accordingly.
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChatPanel } from "../components/Chat/ChatPanel";
import { SandpackPreview } from "../components/Preview/SandpackPreview";
import { FileTree } from "../components/FileExplorer/FileTree";
import { getClient, connectClient } from "../lib/client";
import { useSessionStore } from "../store/session";
import { useProjectStore } from "../store/project";
import { useThemeStore } from "../store/theme";

export function Studio(): React.ReactNode {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { setActive, activeProject, projects } = useSessionStore();
  const { generation, rewindStack } = useProjectStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const [showCode, setShowCode] = useState(false);

  // Ensure the session is active in the SDK and in our store.
  useEffect(() => {
    if (!sessionId) return;
    setActive(sessionId);

    connectClient()
      .then(() => {
        const client = getClient();
        client.sessions.setActive(sessionId);
      })
      .catch(console.error);
  }, [sessionId, setActive]);

  const project = activeProject() ?? projects.find((p) => p.sessionId === sessionId);

  const handleRewind = (): void => {
    const messageId = rewindStack[rewindStack.length - 1];
    if (messageId) {
      getClient().rewind(messageId);
    }
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

          {/* Rewind button — only visible when there's something to undo */}
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

          {/* Code toggle */}
          <button
            onClick={() => setShowCode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                        transition-colors border
                        ${showCode
                          ? "bg-brand-900 border-brand-700 text-brand-300"
                          : "bg-vs-raised border-vs-border text-vs-muted hover:text-vs-text hover:bg-vs-border"
                        }`}
            title={showCode ? "Hide file explorer" : "Show file explorer"}
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
        {/* File tree — hidden by default, shown when user toggles Code */}
        {showCode && (
          <div className="w-44 shrink-0 border-r border-vs-border">
            <FileTree />
          </div>
        )}

        {/* Chat */}
        <div className="w-[38%] shrink-0 border-r border-vs-border">
          <ChatPanel />
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-hidden">
          <SandpackPreview />
        </div>
      </div>
    </div>
  );
}
