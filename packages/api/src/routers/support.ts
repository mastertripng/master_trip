import { z } from "zod";
import { protectedProcedure } from "../procedures";
import { db } from "@master-trip/db";

export const supportRouter = {
  /**
   * Sends a message to the AI support agent
   * The userId is always injected from the session — never from client input
   */
  sendMessage: protectedProcedure
    .input(z.object({ message: z.string().min(1).max(2000) }))
    .handler(async ({ input, context }) => {
      // Save user message
      await db.supportChat.create({
        data: {
          userId: context.userId,
          role: "USER",
          message: input.message,
        },
      });

      // TODO: Publish to QStash → triggers Mastra support-agent with userId context
      // Agent reads only THIS user's trips via Prisma userId filter
      // await qstash.publishJSON({ url: process.env.WORKER_SUPPORT_URL, body: { userId: context.userId, message: input.message } });

      return { queued: true };
    }),

  /**
   * Fetches the chat history for the current user
   */
  getChatHistory: protectedProcedure.handler(async ({ context }) => {
    return db.supportChat.findMany({
      where: { userId: context.userId }, // Strict isolation
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }),
};
