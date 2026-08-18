/**
 * SwarmActivity — inline, collapsible agent-activity section inside the Chat
 * panel.
 *
 * Design decision: the swarm activity and the chat are two views of the same
 * event (the current generation), so they live in the same window instead of
 * splitting attention across a separate side panel.
 *
 * - Auto-opens when a generation starts (right where the user is looking).
 * - Auto-collapses to a compact header once generation finishes, so the chat
 *   returns to a clean conversation.
 * - Long reasoning text is truncated with a Show more/less toggle.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useProjectStore, type AgentLogEntry } from "../../store/project";

const PREVIEW_LIMIT = 160;

/** Colour-coded pill styles per known agent role. */
const AGENT_STYLES: Record<string, { pill: string; dot: string }> = {
  Architect: { pill: "bg-purple-500/15 text-purple-300 border-purple-500/30", dot: "bg-purple-400" },
  Frontend:  { pill: "bg-sky-500/15 text-sky-300 border-sky-500/30", dot: "bg-sky-400" },
  Backend:   { pill: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
  Database:  { pill: "bg-amber-500/15 text-amber-300 border-amber-500/30", dot: "bg-amber-400" },
  QA:        { pill: "bg-rose-500/15 text-rose-300 border-rose-500/30", dot: "bg-rose-400" },
};

const FALLBACK_STYLE = { pill: "bg-vs-raised text-vs-muted border-vs-border", dot: "bg-vs-muted" };

function formatRelative(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

interface ParsedEntry {
  agent: string | null;
  detail: string;
  kind: "reasoning" | "tool" | "agent" | "status";
}

/** Classify a raw log entry for rendering. */
function classify(entry: AgentLogEntry): ParsedEntry {
  if (entry.kind === "reasoning") {
    return { agent: entry.agent ?? null, detail: entry.status, kind: "reasoning" };
  }

  let agent = entry.agent ?? null;
  let detail = entry.status;

  // Team events arrive as "Architect: thinking" — split the member out, but
  // do not mistake tool calls or "Thinking…" for agent names.
  if (!agent && !/^(running tool|thinking)/i.test(entry.status)) {
    const m = /^([A-Za-z_][\w .-]*?):\s+(.*)$/.exec(entry.status);
    if (m) {
      agent = m[1];
      detail = m[2];
    }
  }

  if (entry.kind === "tool" || /^running tool:/i.test(entry.status)) {
    return { agent, detail, kind: "tool" };
  }
  return { agent, detail, kind: agent ? "agent" : "status" };
}

export function SwarmActivity(): ReactNode {
  const { agentLog, generation } = useProjectStore();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const prevGenerating = useRef(generation.isGenerating);

  // Collapse when a generation finishes so the chat returns to a clean state.
  // (It no longer auto-opens — the header phase label is the single signal.)
  useEffect(() => {
    if (!generation.isGenerating && prevGenerating.current) setOpen(false);
    prevGenerating.current = generation.isGenerating;
  }, [generation.isGenerating]);

  const toggleOpen = (): void => setOpen((v) => !v);

  const toggleDetail = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Hide trivial "Thinking…" noise so the timeline stays meaningful.
  const entries = agentLog.filter((e) => e.status !== "Thinking…");
  const stepCount = entries.length;
  const agentCount = new Set(entries.filter((e) => e.agent).map((e) => e.agent)).size;

  // Nothing to show — render nothing (no empty header / divider).
  if (stepCount === 0) return null;

  return (
    <div className="border-t border-vs-border shrink-0">
      {/* Header — always visible */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={toggleOpen}
          className="flex items-center gap-2 min-w-0 text-left group"
          title={open ? "Collapse activity" : "Expand activity"}
        >
          <span
            className={`text-vs-muted transition-transform group-hover:text-vs-text ${
              open ? "rotate-90" : ""
            }`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
          <span className="text-[11px] font-semibold text-vs-text uppercase tracking-wider">
            Swarm activity
          </span>
          {generation.isGenerating && (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
          )}
          {!generation.isGenerating && stepCount > 0 && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              title="Last generation complete"
            />
          )}
          {stepCount > 0 && (
            <span className="text-[10px] font-medium text-vs-muted bg-vs-raised border border-vs-border-light rounded-full px-2 py-0.5 leading-none">
              {agentCount > 0 ? `${agentCount} agent${agentCount === 1 ? "" : "s"} · ` : ""}
              {stepCount} steps
            </span>
          )}
        </button>
      </div>

      {/* Body — only when expanded */}
      {open && stepCount > 0 && (
        <div className="max-h-56 overflow-y-auto px-4 pb-3 space-y-1 text-xs border-t border-vs-border-light pt-2">
          {entries.map((entry, i) => {
            const parsed = classify(entry);
            const id = `${entry.time}-${i}`;
            const isExpanded = expanded.has(id);
            const style = parsed.agent
              ? AGENT_STYLES[parsed.agent] ?? FALLBACK_STYLE
              : FALLBACK_STYLE;

            // Reasoning can be very long — flatten + truncate until expanded.
            const flatPreview = parsed.detail.replace(/\s+/g, " ").trim();
            const needsToggle = parsed.kind === "reasoning" && flatPreview.length > PREVIEW_LIMIT;
            const visible = isExpanded
              ? parsed.detail
              : needsToggle
                ? `${flatPreview.slice(0, PREVIEW_LIMIT)}…`
                : parsed.detail;

            return (
              <div key={id} className="flex gap-2.5 py-0.5">
                <span className="text-vs-faint shrink-0 select-none tabular-nums leading-5">
                  {formatRelative(entry.time)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {parsed.kind === "reasoning" && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-brand-500/15 text-brand-300 border-brand-500/30 leading-none">
                        Thinking
                      </span>
                    )}
                    {parsed.kind === "tool" && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-sky-500/15 text-sky-300 border-sky-500/30 leading-none">
                        Tool
                      </span>
                    )}
                    {parsed.agent && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border leading-none ${style.pill}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {parsed.agent}
                      </span>
                    )}
                  </div>
                  <p
                    className={`break-words whitespace-pre-wrap leading-5 ${
                      parsed.kind === "status" ? "text-vs-faint" : "text-vs-muted"
                    }`}
                  >
                    {visible}
                  </p>
                  {needsToggle && (
                    <button
                      onClick={() => toggleDetail(id)}
                      className="text-brand-400 hover:text-brand-300 mt-0.5 text-[11px]"
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active agent footer while generating */}
      {generation.activeAgent && (
        <div className="flex items-center gap-2 px-4 pb-2.5">
          <span className="animate-spin w-3 h-3 border border-brand-500 border-t-transparent rounded-full" />
          <span className="text-xs text-brand-400 truncate">{generation.activeAgent}</span>
        </div>
      )}
    </div>
  );
}
