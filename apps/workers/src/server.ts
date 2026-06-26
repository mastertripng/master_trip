import { Hono } from "hono";
import { mastra } from "./mastra";

const app = new Hono();

// 1. Healthcheck for Fly.io
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// 2. QStash Webhook Endpoint for Async Fulfillment
app.post("/webhook/fulfillment", async (c) => {
  try {
    const payload = await c.req.json();
    
    // Validate QStash signature here in production
    
    console.log("Received fulfillment event for Trip:", payload.tripId);
    
    // Trigger the Mastra fulfillment agent asynchronously
    // (We don't await the entire process here so we can ack QStash quickly)
    
    return c.json({ received: true, tripId: payload.tripId });
  } catch (error) {
    console.error("Webhook error:", error);
    return c.json({ error: "Invalid payload" }, 400);
  }
});

// 3. Mount oRPC (If you want this container to also handle Live Search)
// import { createFetchHandler } from '@orpc/server/fetch';
// import { appRouter } from '@master-trip/api/router';
// app.all('/orpc/*', (c) => {
//    const handler = createFetchHandler({ router: appRouter });
//    return handler(c.req.raw);
// });

// Export for Bun
export default {
  port: process.env.PORT || 8080,
  fetch: app.fetch,
};
