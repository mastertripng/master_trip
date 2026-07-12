import { createSSEStream } from "@/lib/sse";

/** SSE: Admin Trip Alert Queue — PARTIAL_FAIL / CONFIRMED alerts for ops team */
export async function GET() {
  return createSSEStream("q:admin:trips");
}
