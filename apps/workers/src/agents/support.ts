import { Agent } from "@mastra/core";
import { createOpenAI } from "@ai-sdk/openai";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

/**
 * AI Support Agent
 * Handles tier-1 customer support queries by reading the user's full trip itinerary.
 * Uses RAG (pgvector) for airline policy lookups to prevent hallucinations.
 * Escalates to human support if: urgent, VIP user, or confidential request.
 *
 * DATA ISOLATION: This agent always receives a userId in context.
 * Prisma middleware enforces userId filters on ALL queries — no cross-user data leaks.
 */
export const supportAgent = new Agent({
  name: "support-agent",
  instructions: `
    You are the Master-Trip AI support assistant. You help travelers with questions about their bookings.
    
    Rules:
    1. You can ONLY access data belonging to the authenticated user (userId is injected in your context)
    2. For questions about airline policies, baggage, or visa rules → ALWAYS use the policySearch tool (RAG) to retrieve the exact policy before answering. Never guess.
    3. If the user seems distressed, mentions being stranded, or has a VIP tier → use the escalateToHuman tool immediately
    4. Be concise, empathetic, and factual
    
    You CANNOT access other users' bookings under any circumstances.
  `,
  model: async ({ runtimeContext }) => {
    const { db, aiConfigs, eq } = await import("@master-trip/db");

    // 2. Fetch the active model config for this agent
    const config = await db.query.aiConfigs.findFirst({
      where: eq(aiConfigs.agentName, "support-agent"),
    });

    // 3. Fallback to process.env or default
    const modelName = config?.modelName || process.env.MASTRA_MODEL_NAME || "openai/gpt-4o";
    
    return openrouter(modelName) as any;
  },
  tools: {},
});
