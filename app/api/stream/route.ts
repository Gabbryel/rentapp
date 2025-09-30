import { addClient } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ensure no caching

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      // initial event to open the stream
      send("retry: 3000\n\n");
      const remove = addClient(send);
      const keepAlive = setInterval(() => send(":keep-alive\n\n"), 15000);
      // cleanup on close
      const onClose = () => {
        clearInterval(keepAlive);
        remove();
      };
      // Some runtimes expose a signal; if present, listen to it
      const anyController = controller as unknown as { signal?: AbortSignal };
      anyController.signal?.addEventListener?.("abort", onClose);
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
