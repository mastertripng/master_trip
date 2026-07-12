import { Hono } from "hono";
import { mastra } from "./mastra";
import { Redis } from "@upstash/redis";
import { Receiver } from "@upstash/qstash";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * QStash Signature Receiver
 * Verifies that every incoming webhook was genuinely sent by Upstash QStash
 * and not from an external attacker who knows our worker URL.
 *
 * QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY are found in the
 * Upstash QStash dashboard → API Keys.
 */
const qstashReceiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const app = new Hono();

// ─────────────────────────────────────────────
// MIDDLEWARE: QStash Signature Verification
// Applied to all /webhook/* routes.
// ─────────────────────────────────────────────

app.use("/webhook/*", async (c, next) => {
  // Skip signature check in local development (Fly.io sets NODE_ENV=production)
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  const signature = c.req.header("upstash-signature");
  const body = await c.req.text();

  if (!signature) {
    console.warn("[Auth] Missing QStash signature header");
    return c.json({ error: "Unauthorized: missing signature" }, 401);
  }

  try {
    const isValid = await qstashReceiver.verify({
      signature,
      body,
      url: c.req.url,
    });

    if (!isValid) {
      console.warn("[Auth] Invalid QStash signature");
      return c.json({ error: "Unauthorized: invalid signature" }, 401);
    }
  } catch (err) {
    console.error("[Auth] Signature verification threw:", err);
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Re-parse body as JSON for downstream handlers
  (c as any).set("rawBody", body);
  return next();
});

// ─────────────────────────────────────────────
// HEALTHCHECK
// ─────────────────────────────────────────────

app.get("/health", (c) => {
  return c.json({ status: "ok", ts: new Date().toISOString() });
});

// ─────────────────────────────────────────────
// WEBHOOK: Fulfillment Agent
// Triggered by Upstash QStash after payment is confirmed.
// ─────────────────────────────────────────────

app.post("/webhook/fulfillment", async (c) => {
  try {
    // In production, body was already read by middleware — parse from raw
    const rawBody = (c.get as any)("rawBody");
    const payload = rawBody ? JSON.parse(rawBody) : await c.req.json();

    console.log("[Fulfillment] Received event for Trip:", payload.tripId);

    // Import the strict deterministic processor
    const { processFulfillment } = await import("./agents/fulfillment.js");
    
    // Fire-and-forget: fulfillment can take minutes, we ACK QStash immediately
    processFulfillment(payload.tripId, payload.userId).catch((err: any) => 
      console.error("[Fulfillment] Background Job error:", err)
    );

    return c.json({ received: true, tripId: payload.tripId });
  } catch (error) {
    console.error("[Fulfillment] Webhook error:", error);
    return c.json({ error: "Invalid payload" }, 400);
  }
});

// ─────────────────────────────────────────────
// WEBHOOK: AI Support Agent
// Triggered by QStash after a user sends a chat message.
// Runs agent, persists reply, broadcasts in real-time.
// ─────────────────────────────────────────────

app.post("/webhook/support", async (c) => {
  try {
    const rawBody = (c.get as any)("rawBody");
    const payload = rawBody ? JSON.parse(rawBody) : await c.req.json();
    const { userId, message } = payload;

    console.log(`[Support] Received message from userId: ${userId}`);

    const agent = mastra.getAgent("supportAgent");

    if (agent) {
      // Await the agent — we need its reply to persist and broadcast
      const result = await agent.generate(`Message: ${message}\nUserId: ${userId}`, {
        runId: userId,
      });
      const aiReply = result.text ?? "I'm sorry, I could not process that request.";

      // Persist AI reply to DB
      const { db, supportChats } = await import("@master-trip/db");
      await db.insert(supportChats).values({
        userId,
        role: "ASSISTANT",
        message: aiReply,
        status: "ACTIVE",
      });

      // 🔴 Real-time: push AI reply to customer's chat SSE stream
      const key = `q:chat:${userId}`;
      await redis.rpush(key, JSON.stringify({
        type: "chat:new_message",
        userId,
        role: "ASSISTANT",
        message: aiReply,
        createdAt: new Date().toISOString(),
      }));
      await redis.expire(key, 300);
    }

    return c.json({ received: true });
  } catch (error) {
    console.error("[Support] Webhook error:", error);
    return c.json({ error: "Invalid payload" }, 400);
  }
});

// ─────────────────────────────────────────────
// WEBHOOK: Paystack
// Handles async payment events (e.g. charge.success) to ensure
// trips are marked PAID even if the client disconnects before confirmCheckout.
// ─────────────────────────────────────────────

app.post("/webhook/paystack", async (c) => {
  try {
    const rawBody = (c.get as any)("rawBody") || await c.req.text();
    const signature = c.req.header("x-paystack-signature");
    
    // In production, verify crypto signature using process.env.PAYSTACK_SECRET_KEY
    if (process.env.NODE_ENV === "production" && !signature) {
      return c.json({ error: "Missing signature" }, 401);
    }

    const payload = JSON.parse(rawBody);

    if (payload.event === "charge.success") {
      const { reference, metadata, amount, currency } = payload.data;
      const tripId = metadata?.tripId;
      const userId = metadata?.userId;

      if (tripId && userId) {
        console.log(`[Paystack Webhook] Received charge.success for Trip ${tripId}`);
        const { db, trips, payments, eq } = await import("@master-trip/db");
        
        // 1. Verify trip exists and is DRAFT
        const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
        
        if (trip && trip.status === "DRAFT") {
           // 2. Mark as PAID
           await db.update(trips).set({ status: "PAID", updatedAt: new Date() }).where(eq(trips.id, tripId));
           
           // 3. Create payment record
           await db.insert(payments).values({
             tripId,
             paystackReference: reference,
             amount: (amount / 100).toString(),
             currency,
             status: "CAPTURED",
             paidAt: new Date(),
           });

           // 4. Enqueue fulfillment
           const { qstash } = await import("@master-trip/api/qstash");
           if (qstash && process.env.WORKER_FULFILLMENT_URL) {
             await qstash.publishJSON({
               url: process.env.WORKER_FULFILLMENT_URL,
               body: { tripId, userId },
             });
           }

           // 5. Notify any lingering frontends that payment was captured
           const { publishPaymentEvent } = await import("@master-trip/api/pubsub");
           await publishPaymentEvent({
             type: "payment:captured",
             tripId,
             amount: (amount / 100).toString(),
             currency,
             paystackReference: reference,
           });

           console.log(`[Paystack Webhook] Successfully recovered and enqueued fulfillment for Trip ${tripId}`);
        }
      }
    }

    return c.json({ received: true });
  } catch (error) {
    console.error("[Paystack Webhook] Error processing event:", error);
    return c.json({ error: "Invalid payload" }, 400);
  }
});

export default {
  port: process.env.PORT || 8080,
  fetch: app.fetch,
};
