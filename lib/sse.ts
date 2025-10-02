// Simple in-process SSE pub/sub hub for broadcasting small events (toasts, etc.)
// Note: In a multi-instance/serverless deployment, consider a shared broker (Redis, Ably, Pusher).

export type ToastKind = "success" | "error" | "info";

export type AppEvent =
  | {
      type: "toast";
      payload: { message: string; kind?: ToastKind };
    };

type Client = {
  id: number;
  send: (text: string) => void;
};

type GlobalSSE = {
  __SSE_CLIENTS__?: Map<number, Client>;
  __SSE_HEARTBEAT__?: ReturnType<typeof setInterval>;
  __SSE_NEXT_ID__?: number;
};

const G = globalThis as unknown as GlobalSSE;

if (!G.__SSE_CLIENTS__) {
  G.__SSE_CLIENTS__ = new Map<number, Client>();
}
const CLIENTS: Map<number, Client> = G.__SSE_CLIENTS__!;

if (!G.__SSE_HEARTBEAT__) {
  G.__SSE_HEARTBEAT__ = setInterval(() => {
    const toRemove: number[] = [];
    for (const c of CLIENTS.values()) {
      try {
        // SSE comment as heartbeat to keep connections alive
        c.send(`:ping ${Date.now()}\n\n`);
      } catch {
        toRemove.push(c.id);
      }
    }
    for (const id of toRemove) CLIENTS.delete(id);
  }, 20000);
}

let nextId = G.__SSE_NEXT_ID__ ?? 1;

export function addClient(send: (text: string) => void) {
  const id = nextId++;
  G.__SSE_NEXT_ID__ = nextId;
  CLIENTS.set(id, { id, send });
  return () => CLIENTS.delete(id);
}

export function publish(event: AppEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  const toRemove: number[] = [];
  for (const c of CLIENTS.values()) {
    try {
      c.send(data);
    } catch {
      toRemove.push(c.id);
    }
  }
  for (const id of toRemove) CLIENTS.delete(id);
}

export function publishToast(message: string, kind: ToastKind = "info") {
  publish({ type: "toast", payload: { message, kind } });
}
