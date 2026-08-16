/** Central access point for Vite environment variables. */
export const config = {
  /** JiuwenSwarm gateway WebSocket URL, e.g. ws://localhost:19000/v1/ws */
  gatewayUrl: import.meta.env.VITE_JIUWENSWARM_URL as string ?? "ws://localhost:19000/v1/ws",
  /** Optional bearer token for the gateway. */
  authToken: (import.meta.env.VITE_AUTH_TOKEN as string | undefined) || undefined,
  /** Whether we are in production mode. */
  isProd: import.meta.env.PROD,
} as const;
