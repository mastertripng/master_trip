import { redis } from "@master-trip/api/redis";

/**
 * Shared SSE helper — creates a ReadableStream that polls a Redis list.
 * Used by all SSE route handlers to avoid code duplication.
 *
 * @param key  The Redis list key to poll (e.g. "q:chat:admin")
 */
export function createSSEStream(key: string): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let running = true;

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          running = false;
          clearInterval(keepAlive);
        }
      }, 25_000);

      while (running) {
        try {
          const message = await redis.lpop<string>(key);
          if (message) {
            // message is already a JSON string from rpush
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
            );
          }
        } catch {
          running = false;
          clearInterval(keepAlive);
          controller.close();
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
