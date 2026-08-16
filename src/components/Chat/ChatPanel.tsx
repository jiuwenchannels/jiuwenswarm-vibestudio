/**
 * ChatPanel — the primary chat interface for VibeStudio.
 *
 * Handles:
 * - Rendering the message list with streaming support.
 * - Sending user prompts via `client.streamEvents()`.
 * - Dispatching file deltas to the project store on completion.
 * - Forwarding status events to the message list for swarm visibility.
 */
import { useRef, useState, useEffect, useCallback, type FormEvent } from "react";
import { MessageBubble, type ChatMessage } from "./MessageBubble";
import { getClient } from "../../lib/client";
import { buildStreamOptions, inferIntent } from "../../lib/agentMode";
import { parseGenerationResult } from "../../lib/streamParser";
import { useProjectStore } from "../../store/project";
import { useSessionStore } from "../../store/session";

let _msgCounter = 0;
const uid = (): string => `msg-${++_msgCounter}`;

export function ChatPanel(): React.ReactNode {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { activeSessionId } = useSessionStore();
  const { applyDeltas, setGenerating, appendToken, clearStreamBuffer, pushRewindable } =
    useProjectStore();

  // Connect on mount.
  useEffect(() => {
    const client = getClient();
    const onConnected = (): void => setConnected(true);
    const onDisconnected = (): void => setConnected(false);
    const onRewindable = (msgId: string): void => pushRewindable(msgId);

    client.on("connected", onConnected);
    client.on("disconnected", onDisconnected);
    client.on("rewindable", onRewindable);

    if (!connected) {
      client.connect().then(onConnected).catch(console.error);
    }

    return () => {
      client.off("connected", onConnected);
      client.off("disconnected", onDisconnected);
      client.off("rewindable", onRewindable);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = useCallback((msg: ChatMessage): void => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateLastAssistant = useCallback(
    (updater: (msg: ChatMessage) => ChatMessage): void => {
      setMessages((prev) => {
        const idx = [...prev].reverse().findIndex((m) => m.role === "assistant");
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        const next = [...prev];
        next[realIdx] = updater(next[realIdx]);
        return next;
      });
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      const text = input.trim();
      if (!text || !activeSessionId) return;
      setInput("");

      addMessage({ id: uid(), role: "user", content: text });

      const assistantId = uid();
      addMessage({ id: assistantId, role: "assistant", content: "", isStreaming: true });

      const intent = inferIntent(text);
      const opts = buildStreamOptions(intent, activeSessionId);
      const client = getClient();

      setGenerating(true);
      clearStreamBuffer();

      let accumulated = "";

      try {
        for await (const event of client.streamEvents(text, opts)) {
          switch (event.kind) {
            case "delta":
              accumulated += event.text;
              appendToken(event.text);
              updateLastAssistant((m) => ({ ...m, content: accumulated }));
              break;

            case "status":
              setGenerating(true, event.status);
              addMessage({ id: uid(), role: "status", content: event.status });
              break;

            case "done": {
              const { deltas, prose } = parseGenerationResult(accumulated);
              if (deltas.length > 0) applyDeltas(deltas);
              updateLastAssistant((m) => ({
                ...m,
                content: prose || accumulated,
                isStreaming: false,
              }));
              clearStreamBuffer();
              setGenerating(false);
              break;
            }

            case "error":
              updateLastAssistant((m) => ({
                ...m,
                content: `Error: ${event.message}`,
                isStreaming: false,
              }));
              setGenerating(false);
              break;
          }
        }
      } catch (err) {
        updateLastAssistant((m) => ({
          ...m,
          content: `Connection error: ${String(err)}`,
          isStreaming: false,
        }));
        setGenerating(false);
      }
    },
    [
      input,
      activeSessionId,
      addMessage,
      updateLastAssistant,
      applyDeltas,
      setGenerating,
      appendToken,
      clearStreamBuffer,
    ],
  );

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Connection status bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 text-xs text-gray-500">
        <span
          className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
        />
        {connected ? "Connected to JiuwenSwarm" : "Disconnected — reconnecting…"}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 px-8 text-center">
            <p className="text-lg font-semibold text-gray-300">What do you want to build?</p>
            <p className="text-sm">
              Describe your app in plain language. JiuwenSwarm agents will write
              the code and show you a live preview.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        className="border-t border-gray-800 p-4 flex gap-3"
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
          className="flex-1 resize-none rounded-xl bg-gray-800 border border-gray-700 px-4 py-3
                     text-sm text-gray-100 placeholder-gray-500 focus:outline-none
                     focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!activeSessionId || !input.trim()}
          className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
        >
          Send
        </button>
      </form>
    </div>
  );
}
