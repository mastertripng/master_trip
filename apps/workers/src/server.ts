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

    const agent = mastra.getAgent("fulfillmentAgent");
    if (agent) {
      // Fire-and-forget: fulfillment can take minutes, we ACK QStash immediately
      agent
        .generate(
          `Fulfill all trip items for tripId: ${payload.tripId}. UserId: ${payload.userId}`,
          { runId: payload.tripId }
        )
        .catch((err) => console.error("[Fulfillment] Agent error:", err));
    }

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

export default {
  port: process.env.PORT || 8080,
  fetch: app.fetch,
};
