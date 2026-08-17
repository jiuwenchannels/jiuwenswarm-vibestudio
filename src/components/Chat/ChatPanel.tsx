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
  const bottomRef = useRef<HTMLDivElement>(null);
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

  const handleSubmit = useCallback(
    async (e: FormEvent, overrideText?: string): Promise<void> => {
      e.preventDefault();
      const text = (overrideText ?? input).trim();
      if (!text || !activeSessionId) return;
      // The RPC client only supports one active stream — never start a second
      // generation while one is already running.
      if (useProjectStore.getState().generation.isGenerating) return;
      if (!overrideText) setInput("");

      snapshotForRewind();

      const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
      addChatMessage(userMsg);
      addChatMessage({ id: uid(), role: "assistant", content: "", isStreaming: true });

      const client = getClient();
      const opts = buildStreamOptions(inferIntent(text), activeSessionId);

      setGenerating(true);
      clearStreamBuffer();

      let accumulated = "";

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

            case "done": {
              const { deltas, prose } = parseGenerationResult(accumulated);
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
                  : accumulated;
              updateLastAssistantMessage((m) => ({
                ...m,
                content: prose || summary,
                isStreaming: false,
              }));
              clearStreamBuffer();
              setGenerating(false);
              break;
            }

            case "error":
              updateLastAssistantMessage((m) => ({
                ...m,
                content: `Error: ${event.message}`,
                isStreaming: false,
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
        }));
        setGenerating(false);
      }
    },
    [
      input, activeSessionId,
      addChatMessage, updateLastAssistantMessage,
      applyDeltas, setGenerating, appendToken, clearStreamBuffer,
      snapshotForRewind, persistFiles, appendAgentLog,
    ],
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

  const applyQuickAction = (prefix: string): void => {
    setInput((v) => {
      const clean = v.replace(/^(Fix|Explain|Refactor): /i, "");
      return prefix ? `${prefix}${clean}` : clean;
    });
  };

  return (
    <div className="flex flex-col h-full bg-vs-surface">
      {/* Subtle connection indicator */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-vs-border text-xs text-vs-muted shrink-0">
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`} />
        {connected ? "Connected" : "Reconnecting…"}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-vs-muted gap-3 px-8 text-center">
            <p className="text-lg font-semibold text-vs-text">What do you want to build?</p>
            <p className="text-sm">
              Describe your app in plain language. JiuwenSwarm agents will write the code and
              show you a live preview.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Inline swarm activity — same window as the chat it belongs to */}
      <SwarmActivity />

      {/* Quick-action pills (Stage 2.2) */}
      <div className="flex gap-2 px-4 pt-3 pb-1 shrink-0 flex-wrap">
        {QUICK_ACTIONS.map(({ label, prefix }) => (
          <button
            key={label}
            type="button"
            onClick={() => applyQuickAction(prefix)}
            disabled={!activeSessionId}
            className="text-xs px-3 py-1 rounded-full border border-vs-border bg-vs-raised
                       hover:bg-vs-border text-vs-muted hover:text-vs-text transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        className="border-t border-vs-border p-4 flex gap-3 shrink-0"
      >
        <textarea
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
          rows={2}
          className="flex-1 resize-none rounded-xl bg-vs-raised border border-vs-border px-4 py-3
                     text-sm text-vs-text placeholder-vs-muted focus:outline-none
                     focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!activeSessionId || !input.trim() || generation.isGenerating}
          className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm
                     font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
          title={
            generation.isGenerating
              ? "Wait for the current generation to finish"
              : "Send message"
          }
        >
          {generation.isGenerating ? "Working…" : "Send"}
        </button>
      </form>
    </div>
  );
}
