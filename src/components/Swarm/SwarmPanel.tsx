/**
 * SwarmPanel — collapsible panel showing live agent activity log.
 *
 * Reads agentLog from the project store; each entry is a status string emitted
 * by JiuwenSwarm agents during generation. The panel auto-scrolls to the
 * latest entry and displays a timestamp next to each item.
 *
 * Stage 2.5
 */
import { useEffect, useRef, type ReactNode } from "react";
import { useProjectStore } from "../../store/project";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function SwarmPanel(): ReactNode {
  const { agentLog, clearAgentLog, generation } = useProjectStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentLog.length]);

  return (
    <div className="flex flex-col h-full bg-vs-surface border-l border-vs-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-vs-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-vs-text uppercase tracking-wider">
            Swarm activity
          </span>
          {generation.isGenerating && (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
          )}
        </div>
        <button
          onClick={clearAgentLog}
          disabled={agentLog.length === 0}
          className="text-xs text-vs-faint hover:text-vs-muted transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
          title="Clear log"
        >
          Clear
        </button>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto py-3 space-y-0.5 font-mono text-xs">
        {agentLog.length === 0 ? (
          <p className="text-vs-faint italic px-4 mt-4 text-center text-xs">
            Agent activity will appear here during generation.
          </p>
        ) : (
          agentLog.map((entry, i) => (
            <div
              key={i}
              className="flex gap-3 px-4 py-0.5 hover:bg-vs-raised transition-colors"
            >
              <span className="text-vs-faint shrink-0 select-none">
                {formatTime(entry.time)}
              </span>
              <span className="text-vs-muted break-words">{entry.status}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Active agent footer badge */}
      {generation.activeAgent && (
        <div className="border-t border-vs-border px-4 py-2 shrink-0 flex items-center gap-2">
          <span className="animate-spin w-3 h-3 border border-brand-500 border-t-transparent rounded-full" />
          <span className="text-xs text-brand-400 truncate">{generation.activeAgent}</span>
        </div>
      )}
    </div>
  );
}
