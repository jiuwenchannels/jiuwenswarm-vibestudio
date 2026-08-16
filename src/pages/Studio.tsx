/**
 * Studio — the main workspace page.
 *
 * Layout (three-column):
 *   [FileTree 180px] | [ChatPanel ~40%] | [SandpackPreview ~60%]
 *
 * The session ID comes from the URL param (:sessionId).  On mount we
 * ensure the SDK's active session is set accordingly.
 */
import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ChatPanel } from "../components/Chat/ChatPanel";
import { SandpackPreview } from "../components/Preview/SandpackPreview";
import { FileTree } from "../components/FileExplorer/FileTree";
import { getClient, connectClient } from "../lib/client";
import { useSessionStore } from "../store/session";
import { useProjectStore } from "../store/project";

export function Studio(): React.ReactNode {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { setActive, activeProject, projects } = useSessionStore();
  const { generation, rewindStack } = useProjectStore();

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
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Dashboard
          </Link>
          <span className="text-gray-700">|</span>
          <span className="text-sm font-medium text-gray-200 truncate max-w-xs">
            {project?.title ?? sessionId ?? "Loading…"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Agent status badge */}
          {generation.isGenerating && (
            <span className="flex items-center gap-1.5 text-xs text-brand-400">
              <span className="animate-spin w-3 h-3 border border-brand-400 border-t-transparent rounded-full" />
              {generation.activeAgent ?? "Generating…"}
            </span>
          )}

          {/* Rewind button — only visible when there's something to undo */}
          {rewindStack.length > 0 && !generation.isGenerating && (
            <button
              onClick={handleRewind}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                         bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200
                         transition-colors border border-gray-700"
              title="Undo last generation"
            >
              ↩ Undo
            </button>
          )}
        </div>
      </header>

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* File tree */}
        <div className="w-44 shrink-0">
          <FileTree />
        </div>

        {/* Chat */}
        <div className="w-[38%] shrink-0 border-x border-gray-800">
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
