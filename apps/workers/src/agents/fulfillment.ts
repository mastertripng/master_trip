import { Agent } from "@mastra/core";
import { createTool } from "@mastra/core/tools";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

const bookFlight = createTool({
  id: "bookFlight",
  description: "Sends a confirmed booking request to the flight provider (e.g. 247 Travels) after a successful payment.",
  inputSchema: z.object({
    tripItemId: z.string().uuid().describe("The ID of the trip item in the database"),
    providerName: z.string().describe("The provider handling this flight"),
  }),
  execute: async (params: any) => {
    const tripItemId = params.data?.tripItemId || params.tripItemId;
    console.log(`[Fulfillment] Booking Flight item: ${tripItemId}`);
    
    // In production: await fetch to provider booking endpoint
    
    return { success: true, pnr: "ABCDEF123", status: "CONFIRMED" };
  }
});

const updateFulfillmentStatus = createTool({
  id: "updateFulfillmentStatus",
  description: "Updates the database status of a trip item or the entire trip based on provider responses.",
  inputSchema: z.object({
    id: z.string().uuid().describe("The trip or tripItem ID"),
    tripId: z.string().uuid().describe("The parent trip ID (for broadcasting)"),
    type: z.enum(["TRIP", "ITEM"]),
    status: z.string().describe("The new status (e.g. CONFIRMED, FAILED, PARTIAL_FAIL)"),
    pnr: z.string().optional().describe("PNR / booking reference from the provider"),
  }),
  execute: async (params: any) => {
    const { status, tripId, id, type, pnr } = {
      ...params.data,
      ...params,
    };
    console.log(`[Fulfillment] Updating ${type} ${id} → ${status}`);
    // In production: db.update(tripItems).set({ status }).where(eq(id))

    // 🔴 Real-time: push status update to the customer's booking page
    const tripKey = `q:trip:${tripId}`;
    await redis.rpush(tripKey, JSON.stringify({
      type: type === "TRIP" ? "trip:status_update" : "trip:item_update",
      tripId,
      status,
      tripItemId: type === "ITEM" ? id : undefined,
      itemStatus: type === "ITEM" ? status : undefined,
      pnr,
    }));
    await redis.expire(tripKey, 300);

    return { success: true };
  }
});

/**
 * Fulfillment Agent
 * Handles async booking fulfillment across all verticals (flights, hotels, tours, cars).
 * Triggered by QStash after a successful Paystack checkout.
 * Runs through TripItems sequentially, calling each provider API.
 */
export const fulfillmentAgent = new Agent({
  name: "fulfillment-agent",
  instructions: `
    You are the Master-Trip fulfillment engine. Your job is to fulfill a paid trip by:
    1. Reading the TripItems from the database for the given trip_id
    2. For each TripItem, calling the appropriate provider API (flight, hotel, tour, car)
    3. Updating each TripItem's fulfillment_status to CONFIRMED or FAILED
    4. If all items succeed → mark Trip as CONFIRMED
    5. If any item fails after 3 retries → mark Trip as PARTIAL_FAIL and trigger partial refund
    
    Always use idempotency keys when calling provider APIs.
    Never double-charge or double-book.
  `,
  model: async ({ runtimeContext }) => {
    const { db, aiConfigs, eq } = await import("@master-trip/db");

    // 2. Fetch the active model config for this agent
    const config = await db.query.aiConfigs.findFirst({
      where: eq(aiConfigs.agentName, "fulfillment-agent"),
    });

    // 3. Fallback to process.env or default
    const modelName = config?.modelName || process.env.MASTRA_MODEL_NAME || "openai/gpt-4o";
    
    return openrouter(modelName) as any;
  },
  tools: {
    bookFlight,
    updateFulfillmentStatus
  },
});
