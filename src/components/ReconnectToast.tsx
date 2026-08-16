/**
 * ReconnectToast — floating banner that appears when the WebSocket connection
 * drops and automatically dismisses once the connection is restored.
 *
 * Mount this once at the top of the app (e.g. in Studio) so it is always
 * active while the user is in a workspace session.
 */
import { useEffect, useState, type ReactNode } from "react";
import { getClient } from "../lib/client";

export function ReconnectToast(): ReactNode {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const client = getClient();

    const onDisconnected = (): void => setVisible(true);
    const onConnected = (): void => setVisible(false);

    client.on("disconnected", onDisconnected);
    client.on("connected", onConnected);

    return () => {
      client.off("disconnected", onDisconnected);
      client.off("connected", onConnected);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50
                 flex items-center gap-3 px-5 py-3 rounded-xl
                 bg-vs-raised border border-vs-border shadow-lg text-sm text-vs-text"
    >
      <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
      <span>
        Disconnected from JiuwenSwarm —{" "}
        <span className="text-vs-muted">reconnecting…</span>
      </span>
    </div>
  );
}
