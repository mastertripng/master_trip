import { Agent } from "@mastra/core";
import { createOpenAI } from "@ai-sdk/openai";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
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
  tools: {},
});
