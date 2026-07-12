import { createSSEStream } from "@/lib/sse";

/**
 * SSE: Payment Status Stream
 * GET /api/stream/payment?tripId=xxx
 *
 * Customer checkout page connects here after Paystack redirect.
 * Receives payment:captured, payment:failed, payment:refunded events.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get("tripId");

  if (!tripId) {
    return new Response("Missing tripId", { status: 400 });
  }

  return createSSEStream(`q:payment:${tripId}`);
}
