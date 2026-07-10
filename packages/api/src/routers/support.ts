import { z } from "zod";
import { protectedProcedure } from "../procedures";
import { db, supportChats } from "@master-trip/db";
import { eq, asc } from "drizzle-orm";

export const supportRouter = {
  /**
   * Sends a message to the AI support agent.
   * The userId is always injected from the session — never from client input.
   */
  sendMessage: protectedProcedure
    .input(z.object({ message: z.string().min(1).max(2000) }))
    .handler(async ({ input, context }) => {
      // Persist the user's message
      await db.insert(supportChats).values({
        userId: context.userId,
        role: "USER",
        message: input.message,
        status: "ACTIVE",
      });

      // TODO: Publish to QStash → triggers Mastra support-agent with userId context
      // Agent reads only THIS user's trips via Drizzle userId filter
      // await qstash.publishJSON({
      //   url: process.env.WORKER_SUPPORT_URL,
      //   body: { userId: context.userId, message: input.message },
      // });

      return { queued: true };
    }),

  /**
   * Fetches the full chat history for the currently authenticated user.
   * Strictly isolated — users can never see another user's messages.
   */
  getChatHistory: protectedProcedure.handler(async ({ context }) => {
    return db
      .select()
      .from(supportChats)
      .where(eq(supportChats.userId, context.userId))
      .orderBy(asc(supportChats.createdAt))
      .limit(100);
  }),
};
