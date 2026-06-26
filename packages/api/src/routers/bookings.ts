import { z } from "zod";
import { protectedProcedure } from "../procedures";
import { CheckoutInputSchema } from "@master-trip/types/booking";
import { db } from "@master-trip/db";

export const bookingRouter = {
  /**
   * Creates a Trip cart with items before payment
   */
  createTrip: protectedProcedure
    .input(z.object({ currency: z.string().default("NGN") }))
    .handler(async ({ context }) => {
      // Creates an empty DRAFT trip for the user
      const trip = await db.trip.create({
        data: {
          userId: context.userId,
          status: "DRAFT",
          totalPrice: 0,
          currency: "NGN",
        },
      });
      return trip;
    }),

  /**
   * Confirms checkout after successful Paystack payment
   * Marks trip as PAID and enqueues fulfillment via QStash
   */
  confirmCheckout: protectedProcedure
    .input(CheckoutInputSchema)
    .handler(async ({ input, context }) => {
      const trip = await db.trip.update({
        where: { id: input.tripId, userId: context.userId }, // userId enforced for safety
        data: { status: "PAID" },
      });

      // TODO: Publish to QStash → triggers Mastra fulfillment worker
      // await qstash.publishJSON({ url: process.env.WORKER_FULFILLMENT_URL, body: { tripId: trip.id, userId: context.userId } });

      return { success: true, tripId: trip.id };
    }),

  /**
   * Get booking status — used for polling on the success screen
   */
  getTrip: protectedProcedure
    .input(z.object({ tripId: z.string().cuid() }))
    .handler(async ({ input, context }) => {
      return db.trip.findUniqueOrThrow({
        where: { id: input.tripId, userId: context.userId }, // Hard userId filter
        include: { items: true, payment: true },
      });
    }),
};
