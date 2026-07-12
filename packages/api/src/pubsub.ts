import { redis } from "./redis";

/**
 * Master-Trip Real-Time Pub/Sub Layer
 *
 * Uses Upstash Redis LISTS as a message queue.
 * @upstash/redis is an HTTP REST client — it has no TCP pub/sub.
 * Instead we use rpush (publish) + lpop polling loop in SSE (subscribe).
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  QUEUE MAP (Redis List keys)                                        │
 * ├────────────────────────┬────────────────────────────────────────────┤
 * │  q:chat:{userId}       │  Customer receives AI + human replies      │
 * │  q:chat:admin          │  Admin sees escalations + resolutions      │
 * │  q:trip:{tripId}       │  Customer sees fulfillment progress live   │
 * │  q:payment:{tripId}    │  Customer sees payment captured instantly  │
 * │  q:admin:metrics       │  Admin revenue dashboard updates live      │
 * │  q:admin:trips         │  Admin trip queue (PARTIAL_FAIL alerts)    │
 * └────────────────────────┴────────────────────────────────────────────┘
 *
 * SSE routes poll these lists with lpop every 500ms.
 * Messages are consumed once read (queue semantics, not broadcast).
 * TTL of 5 minutes is set on each key to auto-clean stale messages.
 */

// ─────────────────────────────────────────────
// EVENT TYPES
// ─────────────────────────────────────────────

export type ChatEvent = {
  type: "chat:new_message";
  userId: string;
  role: "USER" | "ASSISTANT" | "HUMAN_AGENT";
  message: string;
  createdAt: string;
};

export type AdminSupportEvent = {
  type: "admin:escalation" | "admin:resolved";
  userId: string;
  userName?: string;
  userEmail?: string;
  reason?: string;
};

export type TripEvent = {
  type: "trip:status_update" | "trip:item_update";
  tripId: string;
  status: string;
  tripItemId?: string;
  itemStatus?: string;
  pnr?: string;
};

export type PaymentEvent = {
  type: "payment:captured" | "payment:failed" | "payment:refunded";
  tripId: string;
  amount: string;
  currency: string;
  paystackReference: string;
};

export type AdminMetricsEvent = {
  type: "metrics:update";
  totalRevenue?: string;
  confirmedTrips?: number;
};

export type AdminTripEvent = {
  type: "trip:alert";
  tripId: string;
  status: "PARTIAL_FAIL" | "CANCELLED" | "CONFIRMED";
  userId: string;
};

export type RealtimeEvent =
  | ChatEvent
  | AdminSupportEvent
  | TripEvent
  | PaymentEvent
  | AdminMetricsEvent
  | AdminTripEvent;

// ─────────────────────────────────────────────
// INTERNAL PUSH HELPER
// Pushes a JSON message onto a Redis list with a 5-minute TTL.
// ─────────────────────────────────────────────

async function push(key: string, event: RealtimeEvent) {
  await redis.rpush(key, JSON.stringify(event));
  await redis.expire(key, 300); // auto-clean after 5 minutes
}

// ─────────────────────────────────────────────
// PUBLISH HELPERS (called from routers/workers)
// ─────────────────────────────────────────────

/** Customer's chat bubble receives AI and human replies */
export async function publishChatMessage(event: ChatEvent) {
  await push(`q:chat:${event.userId}`, event);
}

/** Admin queue gets escalation/resolution events */
export async function publishAdminEvent(event: AdminSupportEvent) {
  await push("q:chat:admin", event);
}

/** Customer's booking page sees fulfillment progress live */
export async function publishTripEvent(event: TripEvent) {
  await push(`q:trip:${event.tripId}`, event);
}

/**
 * Customer checkout page sees "Payment Confirmed!" instantly.
 * Also triggers admin metrics refresh.
 */
export async function publishPaymentEvent(event: PaymentEvent) {
  await push(`q:payment:${event.tripId}`, event);
  // Nudge admin metrics channel
  const metricsEvent: AdminMetricsEvent = { type: "metrics:update" };
  await push("q:admin:metrics", metricsEvent);
}

/** Admin ops dashboard — fires when a trip hits PARTIAL_FAIL or CONFIRMED */
export async function publishAdminTripAlert(event: AdminTripEvent) {
  await push("q:admin:trips", event);
}
