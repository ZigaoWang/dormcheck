import { sse } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          cleanup();
        }
      };

      send(": connected\n\n");

      unsubscribe = sse.subscribe((message) => send(message));

      interval = setInterval(() => send(": keepalive\n\n"), 30000);
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    closed = true;
    unsubscribe?.();
    if (interval) clearInterval(interval);
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
