/**
 * MessageBubble — renders a single chat message.
 * ChatMessage type is owned by the project store so other components
 * (export, swarm panel) can access the conversation history.
 */
import type { ReactNode } from "react";
import type { ChatMessage } from "../../store/project";

export type { ChatMessage };

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props): ReactNode {
  const { role, content, isStreaming } = message;

  if (role === "status") {
    return (
      <div className="flex items-center gap-2 px-4 py-1 text-xs text-vs-muted italic">
        <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-brand-500 inline-block" />
        {content}
      </div>
    );
  }

  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} px-4 py-2`}>
      <div
        className={[
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words",
          isUser
            ? "bg-brand-600 text-white rounded-br-sm"
            : "bg-vs-raised text-vs-text rounded-bl-sm",
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
