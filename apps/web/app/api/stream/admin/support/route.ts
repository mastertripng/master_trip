import { createSSEStream } from "@/lib/sse";

/** SSE: Admin Support Queue — escalations and resolutions */
export async function GET() {
  return createSSEStream("q:chat:admin");
}
