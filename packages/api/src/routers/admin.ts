import { z } from "zod";
import { protectedProcedure } from "../procedures";
import {
  db,
  supportChats,
  trips,
  tripItems,
  payments,
  refunds,
  markupRules,
  users,
  travelPolicies,
  aiConfigs,
} from "@master-trip/db";
import { eq, asc, desc, inArray, sum, count, and, ilike, sql } from "drizzle-orm";
import { publishChatMessage, publishAdminEvent } from "../pubsub";
import { paystack } from "../providers/payments/paystack.adapter";

// ─────────────────────────────────────────────
// ADMIN ROUTER
// All endpoints here assume the caller has been
// verified as an ADMIN via middleware role check.
// ─────────────────────────────────────────────

export const adminRouter = {

  // ════════════════════════════════════════════
  // SECTION 1: CUSTOMER SUPPORT ESCALATIONS
  // ════════════════════════════════════════════

  /**
   * Fetches all chats that have been escalated to a human agent.
   * Typically polled every 10s by the Admin Dashboard.
   */
  getEscalatedChats: protectedProcedure.handler(async () => {
    return db.query.supportChats.findMany({
      where: inArray(supportChats.status, ["NEEDS_HUMAN", "NEEDS_HUMAN_URGENT"]),
      orderBy: [desc(supportChats.createdAt)],
      with: {
        user: true,
      },
    });
  }),

  /**
   * Fetches the full message history for one specific user's chat.
   */
  getChatHistory: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .handler(async ({ input }) => {
      return db.query.supportChats.findMany({
        where: eq(supportChats.userId, input.userId),
        orderBy: [asc(supportChats.createdAt)],
      });
    }),

  /**
   * Allows the human agent to reply to a specific user's chat.
   */
  replyToUser: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      message: z.string().min(1),
    }))
    .handler(async ({ input }) => {
      await db.insert(supportChats).values({
        userId: input.userId,
        role: "HUMAN_AGENT",
        message: input.message,
        status: "ACTIVE",
      });

      // Clear the "NEEDS_HUMAN" flag on prior messages for this user
      await db
        .update(supportChats)
        .set({ status: "ACTIVE" })
        .where(
          and(
            eq(supportChats.userId, input.userId),
            inArray(supportChats.status, ["NEEDS_HUMAN", "NEEDS_HUMAN_URGENT"])
          )
        );

      // 🔴 Real-time: push the human's reply to the customer's chat stream
      await publishChatMessage({
        type: "chat:new_message",
        userId: input.userId,
        role: "HUMAN_AGENT",
        message: input.message,
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    }),

  /**
   * Marks a conversation as resolved, removing it from the active queue.
   */
  resolveChat: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .handler(async ({ input }) => {
      await db
        .update(supportChats)
        .set({ status: "RESOLVED" })
        .where(eq(supportChats.userId, input.userId));

      // 🔴 Real-time: notify admin queue that this chat is now resolved
      await publishAdminEvent({
        type: "admin:resolved",
        userId: input.userId,
      });

      return { success: true };
    }),


  // ════════════════════════════════════════════
  // SECTION 2: TRIP & BOOKING MANAGEMENT
  // ════════════════════════════════════════════

  /**
   * Lists all trips with their payment status and items.
   * Supports filtering by status for ops team.
   */
  listTrips: protectedProcedure
    .input(z.object({
      status: z.enum(["DRAFT", "PAID", "FULFILLING", "CONFIRMED", "PARTIAL_FAIL", "CANCELLED", "REFUNDED"]).optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .handler(async ({ input }) => {
      return db.query.trips.findMany({
        where: input.status ? eq(trips.status, input.status) : undefined,
        orderBy: [desc(trips.createdAt)],
        limit: input.limit,
        with: {
          user: true,
          items: true,
          payment: true,
        },
      });
    }),

  /**
   * Gets a single trip's full details for investigation.
   */
  getTripById: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .handler(async ({ input }) => {
      return db.query.trips.findFirst({
        where: eq(trips.id, input.tripId),
        with: {
          user: true,
          items: true,
          payment: {
            with: { refunds: true },
          },
        },
      });
    }),

  /**
   * Manually overrides a trip item's fulfillment status.
   * Used by ops when AI fulfillment fails and a human must intervene.
   */
  overrideTripItemStatus: protectedProcedure
    .input(z.object({
      tripItemId: z.string().uuid(),
      status: z.enum(["PENDING", "CONFIRMED", "FAILED", "REFUNDED"]),
    }))
    .handler(async ({ input }) => {
      await db
        .update(tripItems)
        .set({ fulfillmentStatus: input.status })
        .where(eq(tripItems.id, input.tripItemId));

      return { success: true };
    }),


  // ════════════════════════════════════════════
  // SECTION 3: MARKUP RULES (PRICING ENGINE)
  // ════════════════════════════════════════════

  /**
   * Lists all markup rules, ordered by priority.
   */
  listMarkupRules: protectedProcedure.handler(async () => {
    return db.query.markupRules.findMany({
      orderBy: [desc(markupRules.priority), asc(markupRules.createdAt)],
    });
  }),

  /**
   * Creates a new markup rule.
   * Example: Add NGN 5,000 flat fee to all Emirates Economy flights.
   */
  createMarkupRule: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      vertical: z.enum(["FLIGHT", "HOTEL", "TOUR", "CAR"]).optional(),
      origin: z.string().optional(),
      destination: z.string().optional(),
      cabinClass: z.string().optional(),
      userTier: z.enum(["STANDARD", "VIP", "CORPORATE"]).optional(),
      flatAmount: z.string().optional(), // stored as decimal string e.g. "5000.00"
      percentage: z.string().optional(), // e.g. "0.0500" for 5%
      currency: z.string().default("NGN"),
      priority: z.number().default(0),
    }))
    .handler(async ({ input }) => {
      const [rule] = await db.insert(markupRules).values(input).returning();
      return rule;
    }),

  /**
   * Toggles a markup rule on or off without deleting it.
   */
  toggleMarkupRule: protectedProcedure
    .input(z.object({
      ruleId: z.string().uuid(),
      isActive: z.boolean(),
    }))
    .handler(async ({ input }) => {
      await db
        .update(markupRules)
        .set({ isActive: input.isActive })
        .where(eq(markupRules.id, input.ruleId));

      return { success: true };
    }),

  /**
   * Permanently deletes a markup rule.
   */
  deleteMarkupRule: protectedProcedure
    .input(z.object({ ruleId: z.string().uuid() }))
    .handler(async ({ input }) => {
      await db.delete(markupRules).where(eq(markupRules.id, input.ruleId));
      return { success: true };
    }),


  // ════════════════════════════════════════════
  // SECTION 4: FINANCIALS (REVENUE DASHBOARD)
  // ════════════════════════════════════════════

  /**
   * Returns high-level revenue metrics for the dashboard stats cards.
   */
  getRevenueOverview: protectedProcedure.handler(async () => {
    const [totalRevenue] = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(eq(payments.status, "CAPTURED"));

    const [totalRefunded] = await db
      .select({ total: sum(refunds.amount) })
      .from(refunds)
      .where(eq(refunds.status, "SUCCESS"));

    const [tripCounts] = await db
      .select({ total: count() })
      .from(trips)
      .where(eq(trips.status, "CONFIRMED"));

    const [failedTrips] = await db
      .select({ total: count() })
      .from(trips)
      .where(inArray(trips.status, ["PARTIAL_FAIL", "CANCELLED"]));

    return {
      totalRevenue: totalRevenue?.total ?? "0",
      totalRefunded: totalRefunded?.total ?? "0",
      confirmedTrips: tripCounts?.total ?? 0,
      failedTrips: failedTrips?.total ?? 0,
    };
  }),

  /**
   * Lists all payments for the transaction history table.
   */
  listPayments: protectedProcedure
    .input(z.object({
      status: z.enum(["PENDING", "CAPTURED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]).optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .handler(async ({ input }) => {
      return db.query.payments.findMany({
        where: input.status ? eq(payments.status, input.status) : undefined,
        orderBy: [desc(payments.createdAt)],
        limit: input.limit,
        with: {
          trip: {
            with: { user: true },
          },
          refunds: true,
        },
      });
    }),


  // ════════════════════════════════════════════
  // SECTION 5: USER MANAGEMENT
  // ════════════════════════════════════════════

  /**
   * Lists all registered users with optional search.
   */
  listUsers: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .handler(async ({ input }) => {
      return db.query.users.findMany({
        where: input.search
          ? ilike(users.email, `%${input.search}%`)
          : undefined,
        orderBy: [desc(users.createdAt)],
        limit: input.limit,
      });
    }),

  /**
   * Upgrades or downgrades a user's tier (STANDARD, VIP, CORPORATE).
   * Affects which markup rules apply to their bookings.
   */
  updateUserTier: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      tier: z.enum(["STANDARD", "VIP", "CORPORATE"]),
    }))
    .handler(async ({ input }) => {
      await db
        .update(users)
        .set({ tier: input.tier })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * Updates a user's platform role (e.g., promoting to SUPPORT_AGENT or ADMIN).
   */
  updateUserRole: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      role: z.enum(["CUSTOMER", "SUPPORT_AGENT", "OPERATIONS", "ADMIN"]),
    }))
    .handler(async ({ input }) => {
      await db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),


  // ════════════════════════════════════════════
  // SECTION 6: MARKUP RULES — UPDATE (missing piece)
  // ════════════════════════════════════════════

  /**
   * Updates all editable fields of an existing markup rule.
   * Use toggleMarkupRule to just flip isActive without touching other fields.
   */
  updateMarkupRule: protectedProcedure
    .input(z.object({
      ruleId: z.string().uuid(),
      name: z.string().min(1).optional(),
      vertical: z.enum(["FLIGHT", "HOTEL", "TOUR", "CAR"]).optional(),
      origin: z.string().optional(),
      destination: z.string().optional(),
      cabinClass: z.string().optional(),
      userTier: z.enum(["STANDARD", "VIP", "CORPORATE"]).optional(),
      flatAmount: z.string().optional(),
      percentage: z.string().optional(),
      currency: z.string().optional(),
      priority: z.number().optional(),
    }))
    .handler(async ({ input }) => {
      const { ruleId, ...fields } = input;
      // Remove undefined fields so we don't wipe values accidentally
      const updates = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined)
      );

      const [updated] = await db
        .update(markupRules)
        .set(updates)
        .where(eq(markupRules.id, ruleId))
        .returning();

      return updated;
    }),


  // ════════════════════════════════════════════
  // SECTION 7: REFUNDS
  // ════════════════════════════════════════════

  /**
   * Admin initiates a refund for a specific payment.
   * Records it in the DB — the actual Paystack refund call should be
   * triggered here in production via fetch to Paystack's refund API.
   */
  initiateRefund: protectedProcedure
    .input(z.object({
      paymentId: z.string().uuid(),
      amount: z.string().describe("Amount to refund in decimal string (e.g. '5000.00')"),
      reason: z.enum(["TICKETING_FAILED", "HOTEL_UNAVAILABLE", "USER_CANCELLED", "PARTIAL_FULFILLMENT"]),
    }))
    .handler(async ({ input }) => {
      // 1. Fetch the original payment to get the Paystack reference
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, input.paymentId))
        .limit(1);

      if (!payment) {
        throw new Error("Payment not found");
      }

      // IDEMPOTENCY CHECK: Prevent double-refunds by calculating existing refunds
      const existingRefunds = await db.query.refunds.findMany({
        where: eq(refunds.paymentId, input.paymentId)
      });
      
      const totalRefunded = existingRefunds.reduce((sum, r) => 
        r.status !== "FAILED" ? sum + parseFloat(r.amount) : sum, 0
      );

      if (totalRefunded + parseFloat(input.amount) > parseFloat(payment.amount)) {
        throw new Error("Idempotency violation: Refund amount exceeds total captured payment amount or a pending refund is already in progress.");
      }

      // 2. Create PENDING refund record
      const [refund] = await db
        .insert(refunds)
        .values({
          paymentId: input.paymentId,
          amount: input.amount,
          reason: input.reason,
          status: "PENDING",
        })
        .returning();

      // 3. Call Paystack refund API via the dedicated adapter
      // We pass the new refund row ID as the Idempotency-Key. If the network drops
      // and we retry, Paystack will know we already refunded this amount.
      const refundResult = await paystack.issueRefund(
        payment.paystackReference, 
        parseFloat(input.amount),
        refund!.id
      );

      if (!refundResult.success) {
        // Mark refund as FAILED
        await db.update(refunds).set({ status: "FAILED" }).where(eq(refunds.id, refund!.id));
        throw new Error(`Refund failed at Paystack: ${refundResult.message}`);
      }

      // 4. Mark refund as SUCCESS and payment as REFUNDED
      await db.update(refunds).set({ status: "SUCCESS" }).where(eq(refunds.id, refund!.id));
      await db.update(payments).set({ status: "REFUNDED" }).where(eq(payments.id, input.paymentId));

      return { success: true, refundId: refund?.id };
    }),

  /**
   * Lists all refunds with their linked payment and trip.
   */
  listRefunds: protectedProcedure
    .input(z.object({
      status: z.enum(["PENDING", "SUCCESS", "FAILED"]).optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .handler(async ({ input }) => {
      return db.query.refunds.findMany({
        where: input.status ? eq(refunds.status, input.status) : undefined,
        orderBy: [desc(refunds.createdAt)],
        limit: input.limit,
        with: {
          payment: {
            with: { trip: { with: { user: true } } },
          },
        },
      });
    }),


  // ════════════════════════════════════════════
  // SECTION 8: TRAVEL POLICIES (RAG)
  // ════════════════════════════════════════════

  /** Lists all stored travel policies (without the embedding vector). */
  listPolicies: protectedProcedure
    .input(z.object({
      provider: z.string().optional(),
      category: z.string().optional(),
    }))
    .handler(async ({ input }) => {
      return db.query.travelPolicies.findMany({
        where: and(
          input.provider ? eq(travelPolicies.provider, input.provider) : undefined,
          input.category ? eq(travelPolicies.category, input.category) : undefined,
        ),
        columns: { id: true, provider: true, category: true, content: true, createdAt: true },
        orderBy: [asc(travelPolicies.provider), asc(travelPolicies.category)],
      });
    }),

  /**
   * Creates a new policy and generates its embedding via OpenRouter.
   * The embedding is stored in the pgvector column for AI similarity search.
   */
  createPolicy: protectedProcedure
    .input(z.object({
      provider: z.string().min(1),
      category: z.string().min(1),
      content: z.string().min(10),
    }))
    .handler(async ({ input }) => {
      // Generate embedding via OpenAI-compatible API (OpenRouter)
      const embedding = await generateEmbedding(input.content);

      const [policy] = await db
        .insert(travelPolicies)
        .values({
          provider: input.provider,
          category: input.category,
          content: input.content,
          embedding,
        })
        .returning({ id: travelPolicies.id, provider: travelPolicies.provider, category: travelPolicies.category });

      return policy;
    }),

  /**
   * Updates a policy's content and regenerates its embedding.
   */
  updatePolicy: protectedProcedure
    .input(z.object({
      policyId: z.string().uuid(),
      provider: z.string().optional(),
      category: z.string().optional(),
      content: z.string().min(10).optional(),
    }))
    .handler(async ({ input }) => {
      const { policyId, content, ...rest } = input;

      // Re-embed if content changed
      const embedding = content ? await generateEmbedding(content) : undefined;

      const updates = {
        ...rest,
        ...(content ? { content } : {}),
        ...(embedding ? { embedding } : {}),
      };

      await db
        .update(travelPolicies)
        .set(updates)
        .where(eq(travelPolicies.id, policyId));

      return { success: true };
    }),

  /** Permanently deletes a policy from the RAG database. */
  deletePolicy: protectedProcedure
    .input(z.object({ policyId: z.string().uuid() }))
    .handler(async ({ input }) => {
      await db.delete(travelPolicies).where(eq(travelPolicies.id, input.policyId));
      return { success: true };
    }),


  // ════════════════════════════════════════════
  // SECTION 9: AI MODEL CONFIGURATION
  // ════════════════════════════════════════════

  /** Lists all AI agent model configs. */
  listAiConfigs: protectedProcedure.handler(async () => {
    return db.query.aiConfigs.findMany({
      orderBy: [asc(aiConfigs.agentName)],
    });
  }),

  /**
   * Creates an AI config for a new agent.
   * agentName must match the agent's name string (e.g. 'support-agent').
   */
  createAiConfig: protectedProcedure
    .input(z.object({
      agentName: z.string().min(1),
      provider: z.string().default("openrouter"),
      modelName: z.string().min(1),
    }))
    .handler(async ({ input }) => {
      const [config] = await db
        .insert(aiConfigs)
        .values({ ...input, updatedAt: new Date() })
        .returning();
      return config;
    }),

  /**
   * Updates the model for an existing agent — hot-swaps GPT-4o for Claude, etc.
   * Takes effect immediately on the next agent invocation (no redeploy needed).
   */
  updateAiConfig: protectedProcedure
    .input(z.object({
      configId: z.string().uuid(),
      modelName: z.string().min(1).optional(),
      provider: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .handler(async ({ input }) => {
      const { configId, ...fields } = input;
      const updates = {
        ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
        updatedAt: new Date(),
      };

      const [updated] = await db
        .update(aiConfigs)
        .set(updates)
        .where(eq(aiConfigs.id, configId))
        .returning();

      return updated;
    }),

  /** Deletes an AI config (agent falls back to env var model). */
  deleteAiConfig: protectedProcedure
    .input(z.object({ configId: z.string().uuid() }))
    .handler(async ({ input }) => {
      await db.delete(aiConfigs).where(eq(aiConfigs.id, input.configId));
      return { success: true };
    }),
};


// ─────────────────────────────────────────────
// INTERNAL HELPER: Generate vector embedding
// ─────────────────────────────────────────────

/**
 * Calls the OpenRouter embeddings endpoint to convert text into a
 * 1536-dimension vector for pgvector similarity search.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small", // 1536 dims, fast & cheap
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.statusText}`);
  }

  const json = await response.json() as { data: { embedding: number[] }[] };
  return json.data[0]!.embedding;
}
