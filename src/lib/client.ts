/**
 * JiuwenSwarm RPC client — speaks the gateway JSON-RPC wire protocol.
 *
 * Requests are `{id, type:"req", channel_id, method, params, timestamp}`; the
 * server replies with `{id, type:"res", ok, payload}` frames (or E2A frames
 * `{response_kind, request_id, body}`) and pushes `{type:"event", event,
 * payload}` frames for streaming and lifecycle events.
 *
 * The previous client used the flat-envelope protocol from `@jiuwenswarm/sdk`,
 * which the running JiuwenSwarm runtime server does not understand — this
 * implementation matches the browser-extension / IDE plugin protocol.
 */
import { config } from "../config";

export type AgentMode = "team" | "agent" | "chat" | "research";

/** A session returned by `session.create` / `session.list`. */
export interface SessionInfo {
  id: string;
  title?: string;
}

export interface StreamEventsOptions {
  mode?: AgentMode;
  sessionId?: string;
  contextPrefix?: string;
}

export type StreamEvent =
  | { kind: "delta"; text: string }
  | { kind: "status"; status: string }
  | { kind: "done"; text?: string }
  | { kind: "error"; message: string };

export type ClientEventName = "connected" | "disconnected" | "rewindable";

export interface Sessions {
  create: (title: string) => Promise<SessionInfo>;
  setActive: (sessionId: string) => Promise<void>;
  delete: (sessionId: string) => Promise<void>;
}

type Listener = (arg: any) => void;

interface EventPayloadMap {
  connected: string | undefined;
  disconnected: string | undefined;
  rewindable: string;
}

interface PendingRequest {
  resolve: (payload: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timer: number;
}

interface ActiveStream {
  requestId: string;
  push: (event: StreamEvent) => void;
  finish: (err?: Error) => void;
  onReasoning: (text: string) => void;
}

const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
const REQUEST_TIMEOUT_MS = 15_000;
const CHANNEL_ID = "browser";

function generateId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export class RpcClient {
  private _ws: WebSocket | null = null;
  private _connected = false;
  private _intentionalClose = false;
  private _retryCount = 0;
  private _listeners = new Map<string, Set<Listener>>();
  private _pending = new Map<string, PendingRequest>();
  private _connectPromise: Promise<void> | null = null;
  private _connectResolve: (() => void) | null = null;
  private _connectReject: ((err: Error) => void) | null = null;
  private _stream: ActiveStream | null = null;
  private _activeSessionId: string | null = null;

  readonly sessions: Sessions;

  constructor(private readonly _url: string) {
    this.sessions = {
      create: (title) => this._createSession(title),
      setActive: (id) => this._switchSession(id),
      delete: (id) => this._deleteSession(id),
    };
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  on<K extends ClientEventName>(
    event: K,
    cb: (arg: EventPayloadMap[K]) => void,
  ): void {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(cb as Listener);
  }

  off<K extends ClientEventName>(
    event: K,
    cb: (arg: EventPayloadMap[K]) => void,
  ): void {
    this._listeners.get(event)?.delete(cb as Listener);
  }

  private emit(event: ClientEventName, arg?: unknown): void {
    for (const cb of this._listeners.get(event) ?? []) {
      try {
        cb(arg);
      } catch {
        // Listener errors must not break the socket loop.
      }
    }
  }

  get isConnected(): boolean {
    return this._connected;
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  connect(): Promise<void> {
    if (this._connected) return Promise.resolve();
    if (this._connectPromise) return this._connectPromise;
    this._connectPromise = new Promise<void>((resolve, reject) => {
      this._connectResolve = resolve;
      this._connectReject = reject;
    });
    this._intentionalClose = false;
    this._openSocket();
    return this._connectPromise;
  }

  disconnect(): void {
    this._intentionalClose = true;
    this._closeAndReject("client disconnect");
  }

  private _openSocket(): void {
    const ws = new WebSocket(this._url);
    this._ws = ws;

    ws.onmessage = (ev: MessageEvent) => {
      this._handleMessage(
        typeof ev.data === "string" ? ev.data : String(ev.data),
      );
    };

    ws.onerror = () => {
      this._rejectAllPending(new ConnectionError(`WebSocket error on ${this._url}`));
    };

    ws.onclose = (ev: CloseEvent) => {
      const reason = ev.reason || `code ${ev.code}`;
      const err = new ConnectionError(`WebSocket closed: ${reason}`);
      this._connected = false;
      this._ws = null;
      this._connectReject?.(err);
      this._connectPromise = null;
      this._connectResolve = null;
      this._connectReject = null;
      if (this._stream) {
        this._stream.finish(err);
        this._stream = null;
      }
      this._rejectAllPending(err);
      this.emit("disconnected", reason);
      if (!this._intentionalClose) this._scheduleReconnect();
    };
  }

  private _scheduleReconnect(): void {
    const delay = BACKOFF_MS[Math.min(this._retryCount, BACKOFF_MS.length - 1)];
    this._retryCount++;
    setTimeout(() => {
      if (this._intentionalClose) return;
      this._connectPromise = new Promise<void>((resolve, reject) => {
        this._connectResolve = resolve;
        this._connectReject = reject;
      });
      this._openSocket();
    }, delay);
  }

  private _closeAndReject(reason: string): void {
    this._connected = false;
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.onerror = null;
      this._ws.onmessage = null;
      try {
        this._ws.close(1000, reason);
      } catch {
        // Already closed.
      }
      this._ws = null;
    }
    const err = new ConnectionError(reason);
    this._rejectAllPending(err);
    if (this._stream) {
      this._stream.finish(err);
      this._stream = null;
    }
    this.emit("disconnected", reason);
  }

  // ---------------------------------------------------------------------------
  // Requests
  // ---------------------------------------------------------------------------

  private _request(
    method: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      if (!this._connected || !this._ws) {
        reject(new ConnectionError("Not connected. Call connect() first."));
        return;
      }
      const id = generateId();
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`Request '${method}' timed out`));
      }, REQUEST_TIMEOUT_MS);
      this._pending.set(id, { resolve, reject, timer });
      if (!this._send({ type: "req", id, channel_id: CHANNEL_ID, method, params })) {
        clearTimeout(timer);
        this._pending.delete(id);
        reject(new ConnectionError("WebSocket not connected"));
      }
    });
  }

  private _send(frame: Record<string, unknown>): boolean {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return false;
    this._ws.send(JSON.stringify(frame));
    return true;
  }

  private _rejectAllPending(err: Error): void {
    for (const [, req] of this._pending) {
      clearTimeout(req.timer);
      req.reject(err);
    }
    this._pending.clear();
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  private async _createSession(title: string): Promise<SessionInfo> {
    const payload = await this._request("session.create", {
      title,
      mode: "team",
      create_token: generateId().replace(/-/g, ""),
    });
    const id =
      (payload.session_id as string) ||
      (payload.id as string) ||
      (payload.result as Record<string, unknown> | undefined)?.session_id as string | undefined;
    const resolvedId = typeof id === "string" ? id : "";
    if (!resolvedId) {
      throw new Error("session.create returned no session id");
    }
    this._activeSessionId = resolvedId;
    return { id: resolvedId, title: (payload.title as string) || title };
  }

  private async _switchSession(sessionId: string): Promise<void> {
    this._activeSessionId = sessionId;
    try {
      await this._request("session.switch", { session_id: sessionId });
    } catch {
      // Server-side switch is best-effort; the local pointer is authoritative.
    }
  }

  private async _deleteSession(sessionId: string): Promise<void> {
    await this._request("session.delete", { session_id: sessionId });
  }

  // ---------------------------------------------------------------------------
  // Chat streaming
  // ---------------------------------------------------------------------------

  /**
   * Send a chat message and yield typed stream events as they arrive.
   *
   * `chat.send` is fire-and-forget; the server pushes `chat.*` / `team.*`
   * events back over the socket. This method correlates those events to the
   * single active stream and translates them to `StreamEvent`s.
   */
  async *streamEvents(
    prompt: string,
    opts?: StreamEventsOptions,
  ): AsyncIterable<StreamEvent> {
    if (!this._connected || !this._ws) {
      throw new ConnectionError("Not connected. Call connect() first.");
    }

    const requestId = generateId();
    const buffer: StreamEvent[] = [];
    let done = false;
    let error: Error | null = null;
    let notify: (() => void) | null = null;
    const reasoningText: string[] = [];

    // Collapse the agent's incremental reasoning chunks into a single status
    // line instead of one bubble per token.
    const emitReasoning = (): void => {
      if (reasoningText.length === 0) return;
      const text = reasoningText.join("").replace(/\s+/g, " ").trim();
      reasoningText.length = 0;
      if (text) buffer.push({ kind: "status", status: text });
    };

    const push = (event: StreamEvent): void => {
      emitReasoning();
      buffer.push(event);
      notify?.();
    };
    const finish = (err?: Error): void => {
      emitReasoning();
      done = true;
      error = err ?? null;
      notify?.();
    };

    this._stream = { requestId, push, finish, onReasoning: (text) => reasoningText.push(text) };

    const content = opts?.contextPrefix
      ? `${prompt}\n\n${opts.contextPrefix}`
      : prompt;
    this._send({
      type: "req",
      id: requestId,
      channel_id: CHANNEL_ID,
      method: "chat.send",
      params: {
        content,
        session_id: opts?.sessionId ?? this._activeSessionId ?? undefined,
        mode: opts?.mode ?? "chat",
      },
    });

    try {
      for (;;) {
        if (buffer.length > 0) {
          yield buffer.shift() as StreamEvent;
          continue;
        }
        if (error) throw error;
        if (done) return;
        await new Promise<void>((res) => {
          notify = res;
        });
      }
    } finally {
      if (this._stream?.requestId === requestId) this._stream = null;
    }
  }

  /** Best-effort rewind to a previous assistant message. */
  rewind(messageId: string): void {
    this._send({
      type: "req",
      id: generateId(),
      channel_id: CHANNEL_ID,
      method: "session.rewind",
      params: { message_id: messageId },
    });
  }

  // ---------------------------------------------------------------------------
  // Inbound message handling
  // ---------------------------------------------------------------------------

  private _handleMessage(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return; // Ignore malformed frames.
    }

    // Legacy JSON-RPC response frames.
    if (msg["type"] === "res" && typeof msg["id"] === "string") {
      const pending = this._pending.get(msg["id"]);
      if (pending) {
        clearTimeout(pending.timer);
        this._pending.delete(msg["id"]);
        if (msg["ok"]) {
          pending.resolve((msg["payload"] as Record<string, unknown>) || {});
        } else {
          const errMsg =
            (msg["payload"] as Record<string, unknown> | undefined)?.["error"] as
              | string
              | undefined;
          pending.reject(new Error(errMsg ?? "Request failed"));
        }
      }
      return;
    }

    // E2A format: { response_kind, request_id, body } (may be nested in payload).
    const responseKind =
      (msg["response_kind"] as string | undefined) ||
      (msg["payload"] as Record<string, unknown> | undefined)?.["response_kind"] as
        | string
        | undefined;
    if (responseKind) {
      const rid =
        (msg["request_id"] as string | undefined) ||
        (msg["payload"] as Record<string, unknown> | undefined)?.["request_id"] as
          | string
          | undefined;
      const body = (msg["body"] as Record<string, unknown>) ||
        (msg["payload"] as Record<string, unknown> | undefined)?.["body"] as
          | Record<string, unknown>
          | undefined ||
        {};

      if (responseKind === "e2a.chunk") {
        const eventType = (body["event_type"] as string) || "";
        const delta = body["delta"];
        const payload = { ...body } as Record<string, unknown>;
        if (typeof delta === "string") {
          if (eventType === "chat.delta" || eventType === "chat.reasoning") {
            payload["text"] = delta;
          }
        }
        this._dispatchStreamEvent(eventType, payload);
      } else if (responseKind === "e2a.complete") {
        if (rid && this._pending.has(rid)) {
          const pending = this._pending.get(rid)!;
          clearTimeout(pending.timer);
          this._pending.delete(rid);
          const result =
            (body["result"] as Record<string, unknown>) || body;
          pending.resolve(result);
          return;
        }
        const result = (body["result"] as Record<string, unknown>) || body;
        const eventType = (result["event_type"] as string) || "chat.final";
        this._dispatchStreamEvent(eventType, result);
      } else if (responseKind === "e2a.error") {
        const errMsg = (body["message"] as string) || "E2A error";
        if (rid && this._pending.has(rid)) {
          const pending = this._pending.get(rid)!;
          clearTimeout(pending.timer);
          this._pending.delete(rid);
          pending.reject(new Error(errMsg));
          return;
        }
        this._stream?.finish(new Error(errMsg));
      }
      return;
    }

    // Event frames.
    if (msg["type"] === "event" && typeof msg["event"] === "string") {
      const event = msg["event"];
      const payload = (msg["payload"] as Record<string, unknown>) || {};

      if (event === "connection.ack") {
        const sid = payload["session_id"] as string | undefined;
        if (sid) this._activeSessionId = sid;
        this._connected = true;
        this._retryCount = 0;
        this._connectResolve?.();
        this._connectPromise = null;
        this._connectResolve = null;
        this._connectReject = null;
        this.emit("connected", sid);
        return;
      }

      this._dispatchStreamEvent(event, payload);
      return;
    }
  }

  /**
   * Translate a server chat/team event into a `StreamEvent` and forward it to
   * the active stream (if any).
   */
  private _dispatchStreamEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ): void {
    const stream = this._stream;
    if (!stream) return;

    switch (eventType) {
      case "chat.delta": {
        const text = (payload["text"] ?? payload["content"]) as string;
        if (typeof text === "string" && text.length > 0) {
          stream.push({ kind: "delta", text });
        }
        break;
      }
      case "chat.reasoning": {
        const text = (payload["text"] ?? payload["content"]) as string;
        if (typeof text === "string" && text.trim().length > 0) {
          stream.onReasoning(text);
        }
        break;
      }
      case "chat.tool_call": {
        const tc = (payload["tool_call"] as Record<string, unknown>) || {};
        const name =
          (payload["tool_name"] as string) ||
          (tc["name"] as string) ||
          "tool";
        stream.push({ kind: "status", status: `Running tool: ${name}` });
        break;
      }
      case "chat.llm_call_start":
        stream.push({ kind: "status", status: "Thinking…" });
        break;
      case "chat.final":
        stream.finish();
        break;
      case "chat.error": {
        const message =
          (payload["message"] as string) ||
          (payload["error"] as string) ||
          "Unknown error";
        stream.finish(new Error(message));
        break;
      }
      default:
        if (eventType.startsWith("team.")) {
          const inner =
            (payload["event"] as Record<string, unknown>) || payload;
          const member =
            (inner["member_name"] as string) ||
            (inner["agent_id"] as string) ||
            "";
          const status =
            (inner["status"] as string) ||
            (inner["new_status"] as string) ||
            "";
          if (member && status) {
            stream.push({ kind: "status", status: `${member}: ${status}` });
          }
        }
    }
  }
}

export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _client: RpcClient | null = null;

/** Singleton RPC client shared across the application. */
export function getClient(): RpcClient {
  if (!_client) {
    _client = new RpcClient(config.gatewayUrl);
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
