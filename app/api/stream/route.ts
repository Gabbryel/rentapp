import { addClient } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ensure no caching

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // If enqueue throws (controller closed), mark closed and drop client
          closed = true;
        }
      };
      // initial event to open the stream
      send("retry: 3000\n\n");
      const remove = addClient(send);
      const keepAlive = setInterval(() => send(":keep-alive\n\n"), 15000);
      // cleanup on close
      const onClose = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        remove();
      };
      // Some runtimes expose a signal; if present, listen to it
      const anyController = controller as unknown as { signal?: AbortSignal };
      anyController.signal?.addEventListener?.("abort", onClose);
    },
    cancel(reason) {
      // Ensure cleanup if consumer cancels
      // We can't access remove here directly; cleanup occurs via abort/throw guard above
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
