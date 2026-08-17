/**
 * ChatPanel — the primary chat interface for VibeStudio.
 *
 * Changes from Phase 1:
 * - Messages are owned by the project store (so Studio can export them).
 * - Quick-action pill buttons below the input (Stage 2.2).
 * - Reads initialPrompt from the project store and auto-sends it on mount,
 *   enabling the template picker to pre-populate the first generation.
 * - Appends agent statuses to the agentLog and renders them inline via
 *   SwarmActivity — the activity lives in the chat window it belongs to
 *   instead of a separate side panel.
 */
import { useRef, useEffect, useCallback, useState, type FormEvent } from "react";
import { MessageBubble } from "./MessageBubble";
import { SwarmActivity } from "../Swarm/SwarmActivity";
import type { ChatMessage } from "../../store/project";
import { getClient } from "../../lib/client";
import { buildStreamOptions, inferIntent } from "../../lib/agentMode";
import { parseGenerationResult, collapseFileBlocks } from "../../lib/streamParser";
import { useProjectStore } from "../../store/project";
import { useSessionStore } from "../../store/session";

let _msgCounter = 0;
const uid = (): string => `msg-${++_msgCounter}`;

const QUICK_ACTIONS: { label: string; prefix: string }[] = [
  { label: "Generate", prefix: "" },
  { label: "Fix",      prefix: "Fix: " },
  { label: "Explain",  prefix: "Explain: " },
  { label: "Refactor", prefix: "Refactor: " },
];

export function ChatPanel(): React.ReactNode {
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  const { activeSessionId, persistFiles } = useSessionStore();
  const {
    messages,
    generation,
    addChatMessage, updateLastAssistantMessage,
    applyDeltas, setGenerating, appendToken, clearStreamBuffer,
    pushRewindable, snapshotForRewind,
    appendAgentLog,
    initialPrompt, setInitialPrompt,
  } = useProjectStore();

  // Connect and listen for lifecycle events.
  useEffect(() => {
    const client = getClient();
    const onConnected  = (): void => setConnected(true);
    const onDisconnected = (): void => setConnected(false);
    const onRewindable = (msgId: string): void => pushRewindable(msgId);

    client.on("connected",    onConnected);
    client.on("disconnected", onDisconnected);
    client.on("rewindable",   onRewindable);

    if (!connected) client.connect().then(onConnected).catch(console.error);

    return () => {
      client.off("connected",    onConnected);
      client.off("disconnected", onDisconnected);
      client.off("rewindable",   onRewindable);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const runGeneration = useCallback(
    async (text: string): Promise<void> => {
      if (!text || !activeSessionId) return;
      // The RPC client only supports one active stream — never start a second
      // generation while one is already running.
      if (useProjectStore.getState().generation.isGenerating) return;

      snapshotForRewind();

      const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
      addChatMessage(userMsg);
      addChatMessage({ id: uid(), role: "assistant", content: "", isStreaming: true });

      const client = getClient();
      const opts = buildStreamOptions(inferIntent(text), activeSessionId);

      setGenerating(true);
      clearStreamBuffer();

      let accumulated = "";
      let questionAsked = false;

      try {
        for await (const event of client.streamEvents(text, opts)) {
          switch (event.kind) {
            case "delta":
              accumulated += event.text;
              appendToken(event.text);
              // Show a clean live view — file blocks collapse to one line each
              // instead of leaking raw @@FILE…@@END_FILE markup into the chat.
              updateLastAssistantMessage((m) => ({
                ...m,
                content: collapseFileBlocks(accumulated),
              }));
              break;

            case "status":
              // Short operational notes (agent state changes, tool calls) go to
              // the Swarm activity panel — NOT the chat, so the conversation
              // stays readable and never duplicates the activity feed.
              setGenerating(true, event.agent ?? "Thinking…");
              appendAgentLog({
                status: event.status,
                agent: event.agent,
                kind: event.status.startsWith("Running tool:") ? "tool" : "status",
                time: Date.now(),
              });
              break;

            case "reasoning":
              appendAgentLog({
                status: event.text,
                kind: "reasoning",
                time: Date.now(),
              });
              break;

            case "ask_user": {
              // The agent paused to ask a clarifying question — turn the
              // streaming bubble into an interactive answer card.
              questionAsked = true;
              setGenerating(true, "Awaiting your answer");
              updateLastAssistantMessage((m) => ({
                ...m,
                content: event.question,
                isStreaming: false,
                question: { requestId: event.requestId, text: event.question },
              }));
              break;
            }

            case "done": {
              if (questionAsked) {
                // The bubble is already the question card — do not overwrite it.
                clearStreamBuffer();
                setGenerating(false);
                break;
              }
              // The done event may carry the authoritative full response
              // (deltas are sometimes only a tail); prefer it over accumulated.
              const fullText = event.text ?? accumulated;
              const { deltas, prose } = parseGenerationResult(fullText);
              // eslint-disable-next-line no-console
              console.info("[VibeStudio] generation finished", {
                accumulatedLen: fullText.length,
                deltas: deltas.length,
                proseLen: prose.length,
              });
              if (deltas.length > 0) {
                applyDeltas(deltas);
                if (activeSessionId) {
                  persistFiles(activeSessionId, useProjectStore.getState().files);
                }
              }
              // Prefer real prose; if the agent only emitted file blocks, show a
              // short summary instead of raw sentinel markup.
              const summary =
                deltas.length > 0
                  ? `Generated ${deltas.length} file${deltas.length === 1 ? "" : "s"}.`
                  : fullText;
              const fallback =
                "The swarm finished without producing any files or text. Please try again.";
              updateLastAssistantMessage((m) => ({
                ...m,
                content: prose || summary || fallback,
                isStreaming: false,
              }));
              clearStreamBuffer();
              setGenerating(false);
              break;
            }

            case "error":
              updateLastAssistantMessage((m) => ({
                ...m,
                content: event.message,
                isStreaming: false,
                isError: true,
              }));
              setGenerating(false);
              break;
          }
        }
      } catch (err) {
        updateLastAssistantMessage((m) => ({
          ...m,
          content: `Connection error: ${String(err)}`,
          isStreaming: false,
          isError: true,
        }));
        setGenerating(false);
      }
    },
    [
      activeSessionId,
      addChatMessage, updateLastAssistantMessage,
      applyDeltas, setGenerating, appendToken, clearStreamBuffer,
      snapshotForRewind, persistFiles, appendAgentLog,
    ],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent, overrideText?: string): Promise<void> => {
      e.preventDefault();
      const text = (overrideText ?? input).trim();
      if (!text) return;
      if (!overrideText) {
        setInput("");
        inputRef.current?.focus();
      }
      await runGeneration(text);
    },
    [input, runGeneration],
  );

  /**
   * Answer an agent's clarifying question.
   *
   * Observed gateways END the turn after asking (is_complete arrives right
   * after the question), so the reliable path is to send the answer as a
   * normal chat message — the agent's question is already in the conversation
   * context, so the next message is read as the answer. The dedicated
   * `hitl.answer` method is tried first in case the gateway pauses instead.
   */
  const handleAnswer = useCallback(
    async (requestId: string, answer: string): Promise<void> => {
      const text = answer.trim();
      if (!text) return;
      try {
        await getClient().sendAnswer(requestId, { answer: text });
      } catch {
        // Fall back: send as a new user message so the swarm continues.
      }
      await runGeneration(text);
    },
    [runGeneration],
  );

  // Auto-send template prompt once connected.
  useEffect(() => {
    if (!initialPrompt || autoSentRef.current || !activeSessionId || !connected) return;
    autoSentRef.current = true;
    const prompt = initialPrompt;
    setInitialPrompt(null);
    setInput(prompt);
    setTimeout(() => {
      void handleSubmit({ preventDefault: () => {} } as FormEvent, prompt);
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, activeSessionId, connected]);

  const applyQuickAction = (label: string, prefix: string): void => {
    setInput((v) => {
      const clean = v.replace(/^(Fix|Explain|Refactor): /i, "");
      return prefix ? `${prefix}${clean}` : clean;
    });
    setActiveAction((cur) => (cur === label ? null : label));
  };

  return (
    <div className="flex flex-col h-full bg-vs-surface">
      {/* Connection indicator */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-vs-border-light text-xs text-vs-muted shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-rose-500"} ${connected ? "" : "animate-pulse"}`} />
        <span className="truncate">{connected ? "Connected" : "Reconnecting…"}</span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1.5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-vs-muted gap-5 px-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-lg shadow-brand-500/25">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-vs-text tracking-tight">
                What do you want to build?
              </p>
              <p className="text-sm mt-1.5 leading-relaxed">
                Describe your app in plain language. The swarm writes the code
                and shows a live preview.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onAnswer={handleAnswer} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Inline swarm activity — same window as the chat it belongs to */}
      <SwarmActivity />

      {/* Quick-action pills */}
      <div className="flex gap-1.5 px-4 pt-2.5 pb-1 shrink-0 flex-wrap">
        {QUICK_ACTIONS.map(({ label, prefix }) => (
          <button
            key={label}
            type="button"
            onClick={() => applyQuickAction(label, prefix)}
            disabled={!activeSessionId}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors
                        disabled:opacity-40 disabled:cursor-not-allowed
                        ${activeAction === label
                          ? "bg-brand-500/15 border-brand-500/40 text-brand-300"
                          : "border-vs-border bg-vs-raised text-vs-muted hover:border-brand-500/40 hover:text-vs-text"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        className="border-t border-vs-border p-3 shrink-0"
      >
        <div className="rounded-2xl border border-vs-border bg-vs-raised transition-all
                        focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e as unknown as FormEvent);
              }
            }}
            placeholder={
              activeSessionId
                ? "Describe what you want to build or change…"
                : "Create or open a project first"
            }
            disabled={!activeSessionId}
            rows={Math.min(8, Math.max(2, input.split("\n").length))}
            className="w-full resize-none bg-transparent px-4 pt-3 text-sm text-vs-text
                       placeholder-vs-muted focus:outline-none disabled:opacity-50
                       disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
            <span className="text-[10px] text-vs-faint pl-1.5 select-none">
              Enter to send · Shift+Enter for a new line
            </span>
            {generation.isGenerating ? (
              <button
                type="button"
                onClick={() => getClient().interrupt()}
                className="px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40
                           text-rose-300 hover:bg-rose-500/25 text-sm font-medium transition-colors"
                title="Stop the current generation"
              >
                ■ Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!activeSessionId || !input.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700
                           hover:from-brand-600 hover:to-brand-700 text-white text-sm font-medium
                           shadow-sm shadow-brand-500/30 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all disabled:shadow-none"
                title="Send message"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
