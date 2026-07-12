import { createSSEStream } from "@/lib/sse";

/**
 * SSE: Trip Fulfillment Status Stream
 * GET /api/stream/trip?tripId=xxx
 *
 * Customer booking page connects here after payment.
 * Receives trip:status_update and trip:item_update as the AI confirms each item.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get("tripId");

  if (!tripId) {
    return new Response("Missing tripId", { status: 400 });
  }

  return createSSEStream(`q:trip:${tripId}`);
}
