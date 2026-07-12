import { redis } from "@master-trip/api/redis";

/**
 * SSE: Customer Chat Stream
 * GET /api/stream/chat?userId=xxx
 *
 * Polls the Redis list q:chat:{userId} every 500ms.
 * Pushes any new messages (AI or human agent replies) to the browser instantly.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return new Response("Missing userId", { status: 400 });
  }

  const key = `q:chat:${userId}`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let running = true;

      // Send keep-alive every 25s to prevent Vercel edge timeout
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          running = false;
          clearInterval(keepAlive);
        }
      }, 25_000);

      // Poll the Redis list for new messages
      while (running) {
        try {
          const message = await redis.lpop<string>(key);
          if (message) {
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
        // Wait 500ms between polls
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
