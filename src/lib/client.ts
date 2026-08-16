/**
 * Singleton JiuwenSwarmClient.
 *
 * All VibeStudio components import `getClient()` instead of constructing their
 * own instance.  This ensures a single WebSocket connection is shared across
 * the entire application.
 */
import { JiuwenSwarmClient, ChannelIdConstants } from "@jiuwenswarm/sdk";
import { config } from "../config";

let _client: JiuwenSwarmClient | null = null;

export function getClient(): JiuwenSwarmClient {
  if (!_client) {
    _client = new JiuwenSwarmClient({
      url: config.gatewayUrl,
      authToken: config.authToken,
      // VibeStudio reports itself as the browser channel so the gateway can
      // apply the appropriate rate limits and feature flags.
      channelId: ChannelIdConstants.BROWSER,
      reconnect: {
        maxAttempts: 10,
        initialDelayMs: 1_000,
        maxDelayMs: 30_000,
        factor: 2,
      },
      onError: (msg) => console.error("[vibestudio/ws]", msg),
    });
  }
  return _client;
}

/** Call once during app bootstrap to open the WebSocket connection. */
export async function connectClient(): Promise<void> {
  await getClient().connect();
}

/** Tear down the connection on app unmount. */
export function disconnectClient(): void {
  _client?.disconnect();
  _client = null;
}
