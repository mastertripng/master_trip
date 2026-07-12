import { createSSEStream } from "@/lib/sse";

/** SSE: Admin Revenue Metrics — refreshes stats cards when payments come in */
export async function GET() {
  return createSSEStream("q:admin:metrics");
}
