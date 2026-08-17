/**
 * Tests for the RpcClient inbound wire handling — verifies that assistant text
 * is captured from every wire variant the gateway may use, including final
 * frames that carry the whole response (the bug that made generations appear
 * to finish without producing files).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { RpcClient } from "../src/lib/client";

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.OPEN;
  sent: string[] = [];
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
  }

  /** Test helper — simulate an inbound server frame. */
  emitRaw(obj: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket =
    MockWebSocket;
});

async function connectClient(): Promise<RpcClient> {
  const client = new RpcClient("ws://test");
  const connected = client.connect();
  MockWebSocket.instances[0].emitRaw({
    type: "event",
    event: "connection.ack",
    payload: { session_id: "s1" },
  });
  await connected;
  return client;
}

function lastSocket(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

/** Start a stream and return its iterator (begins on first next()). */
function startStream(client: RpcClient): AsyncGenerator<
  import("../src/lib/client").StreamEvent
> {
  // eslint-disable-next-line @typescript-eslint/require-await
  return client.streamEvents("build a counter", { sessionId: "s1" }) as AsyncGenerator<
    import("../src/lib/client").StreamEvent
  >;
}

describe("RpcClient inbound frames", () => {
  it("captures the full response text on the done event from a final frame", async () => {
    const client = await connectClient();
    const iter = startStream(client);
    const pending = iter.next(); // starts stream + sends chat.send

    const text = "@@FILE: src/App.tsx\n```tsx\nconst x = 1;\n```\n@@END_FILE";
    lastSocket().emitRaw({ type: "event", event: "chat.final", payload: { text } });

    const evt = (await pending).value as { kind: string; text?: string };
    expect(evt.kind).toBe("done");
    expect(evt.text).toBe(text);
    const finished = await iter.next();
    expect(finished.done).toBe(true);
  });

  it("prefers the final frame's text over streamed deltas", async () => {
    const client = await connectClient();
    const iter = startStream(client);

    let pending = iter.next();
    lastSocket().emitRaw({ type: "event", event: "chat.delta", payload: { text: "tail…" } });
    expect((await pending).value).toEqual({ kind: "delta", text: "tail…" });

    // The gateway streams only a tail as deltas but the full response arrives
    // on the completion frame — the done event must carry it.
    pending = iter.next();
    const full = "@@FILE: src/App.tsx\n```tsx\nconst x = 1;\n```\n@@END_FILE";
    lastSocket().emitRaw({ type: "event", event: "chat.final", payload: { content: full } });
    const doneEvent = (await pending).value as { kind: string; text?: string };
    expect(doneEvent.kind).toBe("done");
    expect(doneEvent.text).toBe(full);
  });

  it("handles raw legacy { type: 'token' } frames", async () => {
    const client = await connectClient();
    const iter = startStream(client);

    const pending = iter.next();
    lastSocket().emitRaw({ type: "token", text: "Hello" });
    expect((await pending).value).toEqual({ kind: "delta", text: "Hello" });
  });

  it("handles flat e2a.chunk frames with top-level text", async () => {
    const client = await connectClient();
    const iter = startStream(client);

    const pending = iter.next();
    lastSocket().emitRaw({ response_kind: "e2a.chunk", text: "Hi" });
    expect((await pending).value).toEqual({ kind: "delta", text: "Hi" });
  });

  it("salvages content from unknown event names carrying a text payload", async () => {
    const client = await connectClient();
    const iter = startStream(client);

    const pending = iter.next();
    lastSocket().emitRaw({
      type: "event",
      event: "chat.assistant",
      payload: { content: "@@FILE: src/App.tsx\n```tsx\nconst x = 1;\n```\n@@END_FILE" },
    });
    const first = (await pending).value as { kind: string; text: string };
    expect(first.kind).toBe("delta");
    expect(first.text).toContain("@@FILE: src/App.tsx");
  });

  it("surfaces an agent clarifying question as an ask_user event", async () => {
    const client = await connectClient();
    const iter = startStream(client);

    const pending = iter.next();
    lastSocket().emitRaw({
      type: "event",
      event: "chat.ask_user_question",
      payload: {
        request_id: "call_abc123",
        questions: [{ question: "What files do you want?" }],
      },
    });
    const evt = (await pending).value as {
      kind: string;
      requestId: string;
      question: string;
    };
    expect(evt.kind).toBe("ask_user");
    expect(evt.requestId).toBe("call_abc123");
    expect(evt.question).toBe("What files do you want?");
  });

  it("finishes the stream when processing_status reports completion", async () => {
    const client = await connectClient();
    const iter = startStream(client);

    const pending = iter.next();
    lastSocket().emitRaw({
      type: "event",
      event: "chat.processing_status",
      payload: { is_complete: true },
    });
    const doneEvent = await pending;
    expect(doneEvent.value).toEqual({ kind: "done" });
  });

  it("routes reasoning text into a reasoning event", async () => {
    const client = await connectClient();
    const iter = startStream(client);

    // Reasoning is batched and flushed on the next event (here: completion).
    const pending = iter.next();
    lastSocket().emitRaw({
      response_kind: "e2a.chunk",
      body: { event_type: "chat.reasoning", delta: "thinking hard" },
    });
    lastSocket().emitRaw({ type: "event", event: "chat.final", payload: {} });

    const evt = (await pending).value as { kind: string; text: string };
    expect(evt.kind).toBe("reasoning");
    expect(evt.text).toContain("thinking hard");
    const doneEvent = await iter.next();
    expect(doneEvent.value).toEqual({ kind: "done" });
  });
});
