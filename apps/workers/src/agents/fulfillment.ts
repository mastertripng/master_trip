import { Agent } from "@mastra/core";

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
  model: {
    provider: "OPEN_AI", // Routed via OpenRouter
    name: "gpt-4o", // Must specify name in latest mastra
  },
  tools: {},
});
