/**
 * MessageBubble — renders a single chat message.
 * ChatMessage type is owned by the project store so other components
 * (export, swarm panel) can access the conversation history.
 *
 * Messages with a `question` field render as an interactive "the swarm needs
 * clarification" card with an inline answer box (HITL).
 */
import { useRef, useState, type ReactNode } from "react";
import type { ChatMessage } from "../../store/project";

export type { ChatMessage };

interface Props {
  message: ChatMessage;
  onAnswer?: (requestId: string, answer: string) => void;
}

export function MessageBubble({ message, onAnswer }: Props): ReactNode {
  const { role, content, isStreaming } = message;

  if (role === "status") {
    return (
      <div className="flex items-center gap-2 px-4 py-1 text-xs text-vs-muted italic">
        <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-brand-500 inline-block" />
        {content}
      </div>
    );
  }

  if (message.question) {
    return (
      <div className="flex justify-start px-4 py-2">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-vs-raised text-vs-text px-4 py-3 border border-brand-500/40">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400 mb-1">
            The swarm needs clarification
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.question.text}
          </p>
          <QuestionAnswer requestId={message.question.requestId} onAnswer={onAnswer} />
        </div>
      </div>
    );
  }

  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} px-4 py-1.5`}>
      <div
        className={[
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm",
          isUser
            ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-br-md"
            : "bg-vs-raised text-vs-text rounded-bl-md border border-vs-border-light",
        ].join(" ")}
      >
        {content}
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-vs-muted ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

function QuestionAnswer({
  requestId,
  onAnswer,
}: {
  requestId: string;
  onAnswer?: (requestId: string, answer: string) => void;
}): ReactNode {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  const submit = async (): Promise<void> => {
    const text = value.trim();
    if (!text || !onAnswer || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      await onAnswer(requestId, text);
      setValue("");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <div className="mt-3 flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        placeholder="Type your answer…"
        disabled={sending}
        className="flex-1 rounded-lg bg-vs-surface border border-vs-border px-3 py-2
                   text-sm text-vs-text placeholder-vs-muted focus:outline-none
                   focus:border-brand-500 disabled:opacity-50"
      />
      <button
        onClick={() => void submit()}
        disabled={!value.trim() || sending}
        className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs
                   font-medium disabled:opacity-50 transition-colors"
      >
        {sending ? "Sending…" : "Reply"}
      </button>
    </div>
  );
}
