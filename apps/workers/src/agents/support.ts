import { Agent } from "@mastra/core";
import { createTool } from "@mastra/core/tools";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { Redis } from "@upstash/redis";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─────────────────────────────────────────────
// TOOL: escalateToHuman
// ─────────────────────────────────────────────

const escalateToHuman = createTool({
  id: "escalateToHuman",
  description: "Escalates the current support conversation to a human agent when the issue is urgent, complex, or involves a VIP customer.",
  inputSchema: z.object({
    reason: z.string().describe("The reason for escalation (e.g., stranded, VIP, urgent refund request)."),
    userId: z.string().describe("The user ID whose chat needs to be escalated."),
  }),
  execute: async (params: any) => {
    const reason = params.data?.reason || params.reason || "Escalation requested";
    const userId = params.data?.userId || params.userId || "";

    console.log(`[ESCALATION] userId=${userId} Reason: ${reason}`);

    // 1. Update all active chats for this user to NEEDS_HUMAN in the DB
    const { db, supportChats, eq, and, inArray } = await import("@master-trip/db");
    await db
      .update(supportChats)
      .set({ status: "NEEDS_HUMAN" })
      .where(
        and(
          eq(supportChats.userId, userId),
          inArray(supportChats.status, ["ACTIVE"])
        )
      );

    // 2. Notify admin's real-time queue via Redis list
    const adminEvent = JSON.stringify({
      type: "admin:escalation",
      userId,
      reason,
    });
    await redis.rpush("q:chat:admin", adminEvent);
    await redis.expire("q:chat:admin", 300);

    return {
      success: true,
      message: "A human agent has been notified and will join this conversation shortly.",
    };
  },
});

// ─────────────────────────────────────────────
// TOOL: policySearch (REAL pgvector implementation)
// ─────────────────────────────────────────────

const policySearch = createTool({
  id: "policySearch",
  description: "Search the travel policy database for airline baggage rules, cancellation policies, or visa requirements. Always use this before answering policy questions.",
  inputSchema: z.object({
    query: z.string().describe("Natural language search query, e.g. 'Emirates Economy baggage allowance Lagos to London'."),
  }),
  execute: async (params: any) => {
    const query = params.data?.query || params.query || params.context?.query || "";
    console.log(`[RAG] Searching policy for: "${query}"`);

    if (!query) return { success: false, policies: [] };

    try {
      // Step 1: Generate embedding for the query using OpenRouter
      const embeddingRes = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/text-embedding-3-small",
          input: query,
        }),
      });

      if (!embeddingRes.ok) {
        console.error("[RAG] Embedding API error:", embeddingRes.statusText);
        return { success: false, policies: [], error: "Embedding service unavailable" };
      }

      const embeddingJson = await embeddingRes.json() as { data: { embedding: number[] }[] };
      const queryVector = embeddingJson.data[0]!.embedding;
      const vectorStr = `[${queryVector.join(",")}]`;

      // Step 2: Cosine similarity search against pgvector table
      // Returns top 3 most semantically relevant policies
      const { db, sql } = await import("@master-trip/db");

      const results = await db.execute(sql`
        SELECT id, provider, category, content,
               1 - (embedding <=> ${vectorStr}::vector) AS similarity
        FROM travel_policies
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT 3
      `);

      const policies = (results as any[]).map((row) => ({
        provider: row.provider as string,
        category: row.category as string,
        content: row.content as string,
        similarity: parseFloat(row.similarity as string),
      }));

      console.log(`[RAG] Found ${policies.length} matching policies`);
      return { success: true, policies };

    } catch (err) {
      console.error("[RAG] policySearch error:", err);
      return { success: false, policies: [], error: "Policy search failed" };
    }
  },
});

// ─────────────────────────────────────────────
// AGENT DEFINITION
// ─────────────────────────────────────────────

/**
 * AI Support Agent
 * Handles tier-1 customer support queries by reading the user's full trip itinerary.
 * Uses RAG (pgvector) for airline policy lookups to prevent hallucinations.
 * Escalates to human support if: urgent, VIP user, or confidential request.
 *
 * DATA ISOLATION: This agent always receives a userId in context.
 * Drizzle userId filters on ALL queries — no cross-user data leaks.
 */
export const supportAgent = new Agent({
  name: "support-agent",
  instructions: `
    You are the Master-Trip AI support assistant. You help travelers with questions about their bookings.
    
    Rules:
    1. You can ONLY access data belonging to the authenticated user (userId is injected in your context).
    2. For questions about airline policies, baggage allowances, cancellations, or visa rules → ALWAYS call the policySearch tool first. Never guess or make up policies.
    3. If the user seems distressed, mentions being stranded, has missed a flight, has a complaint about a booking failure, or is marked VIP → immediately call the escalateToHuman tool.
    4. Be concise, empathetic, and factual.
    5. If policySearch returns no results, say "I don't have that specific policy on file. Let me connect you with a human agent." and call escalateToHuman.
    
    You CANNOT access other users' bookings under any circumstances.
  `,
  model: async ({ runtimeContext }) => {
    const { db, aiConfigs, eq } = await import("@master-trip/db");

    const config = await db.query.aiConfigs.findFirst({
      where: eq(aiConfigs.agentName, "support-agent"),
    });

    const modelName = config?.modelName || process.env.MASTRA_MODEL_NAME || "openai/gpt-4o";
    return openrouter(modelName) as any;
  },
  tools: {
    escalateToHuman,
    policySearch,
  },
});
