import { z } from "zod";
import { protectedProcedure } from "../procedures";
import { db, trips, tripItems, payments } from "@master-trip/db";
import { eq, and } from "drizzle-orm";
import { qstash } from "../qstash";
import { publishPaymentEvent } from "../pubsub";
import { paystack } from "../providers/payments/paystack.adapter";

/**
 * Zod schema for the checkout confirmation payload.
 * Replaces the legacy @master-trip/types/booking import which used Prisma types.
 */
const CheckoutInputSchema = z.object({
  tripId: z.string().uuid(),
  paystackReference: z.string().min(1),
  amount: z.string(), // decimal as string, matching our DB schema
  currency: z.string().default("NGN"),
});

export const bookingRouter = {
  /**
   * Creates an empty DRAFT trip (the user's cart) before payment.
   * The userId is injected from the session — never from client input.
   */
  createTrip: protectedProcedure
    .input(z.object({ currency: z.string().default("NGN") }))
    .handler(async ({ input, context }) => {
      const [trip] = await db
        .insert(trips)
        .values({
          userId: context.userId,
          status: "DRAFT",
          totalPrice: "0",
          currency: input.currency,
        })
        .returning();

      if (!trip) {
        throw new Error("Failed to create trip");
      }

      return trip;
    }),

  /**
   * Adds an item (flight, hotel, etc.) to a DRAFT trip (the user's cart).
   * Automatically updates the total price of the trip.
   */
  addTripItem: protectedProcedure
    .input(z.object({
      tripId: z.string().uuid(),
      type: z.enum(["FLIGHT", "HOTEL", "TOUR", "CAR"]),
      providerName: z.string().min(1),
      wholesalePrice: z.string(), // decimal as string
      price: z.string(), // decimal as string
      currency: z.string().default("NGN"),
      metadata: z.record(z.any()).default({}), // booking details, flight specifics, etc.
    }))
    .handler(async ({ input, context }) => {
      // 1. Verify trip exists, is DRAFT, and belongs to user
      const [existingTrip] = await db
        .select()
        .from(trips)
        .where(and(eq(trips.id, input.tripId), eq(trips.userId, context.userId)))
        .limit(1);

      if (!existingTrip) throw new Error("Trip not found or access denied");
      if (existingTrip.status !== "DRAFT") throw new Error("Cannot add items to a paid or processing trip");

      // 2. Insert the item
      const [item] = await db
        .insert(tripItems)
        .values({
          tripId: input.tripId,
          type: input.type,
          providerName: input.providerName,
          wholesalePrice: input.wholesalePrice,
          price: input.price,
          currency: input.currency,
          metadata: input.metadata,
        })
        .returning();

      // 3. Update the parent trip's total price
      const newTotal = parseFloat(existingTrip.totalPrice) + parseFloat(input.price);
      await db
        .update(trips)
        .set({ totalPrice: newTotal.toString(), updatedAt: new Date() })
        .where(eq(trips.id, input.tripId));

      return item;
    }),

  /**
   * Removes an item from the cart (DRAFT trip).
   * Automatically deducts the price from the total.
   */
  removeTripItem: protectedProcedure
    .input(z.object({
      tripId: z.string().uuid(),
      tripItemId: z.string().uuid(),
    }))
    .handler(async ({ input, context }) => {
      // 1. Verify trip exists and belongs to user
      const [existingTrip] = await db
        .select()
        .from(trips)
        .where(and(eq(trips.id, input.tripId), eq(trips.userId, context.userId)))
        .limit(1);

      if (!existingTrip || existingTrip.status !== "DRAFT") {
        throw new Error("Trip not found, access denied, or trip already paid");
      }

      // 2. Fetch the item to get its price
      const [item] = await db
        .select()
        .from(tripItems)
        .where(eq(tripItems.id, input.tripItemId))
        .limit(1);

      if (!item) throw new Error("Item not found");

      // 3. Delete the item
      await db.delete(tripItems).where(eq(tripItems.id, input.tripItemId));

      // 4. Update parent total price
      const newTotal = Math.max(0, parseFloat(existingTrip.totalPrice) - parseFloat(item.price));
      await db
        .update(trips)
        .set({ totalPrice: newTotal.toString(), updatedAt: new Date() })
        .where(eq(trips.id, input.tripId));

      return { success: true, newTotal };
    }),

  /**
   * Confirms checkout after a successful Paystack payment.
   * Creates a Payment record and marks the trip as PAID.
   * Enqueues fulfilment via QStash (TODO).
   */
  confirmCheckout: protectedProcedure
    .input(CheckoutInputSchema)
    .handler(async ({ input, context }) => {
      // Verify the trip belongs to this user before doing anything
      const [existingTrip] = await db
        .select()
        .from(trips)
        .where(and(eq(trips.id, input.tripId), eq(trips.userId, context.userId)))
        .limit(1);

      if (!existingTrip) {
        throw new Error("Trip not found or access denied");
      }

      // IDEMPOTENCY CHECK: If already paid, return early to prevent double-fulfillment
      if (existingTrip.status !== "DRAFT") {
        const [existingPayment] = await db
          .select()
          .from(payments)
          .where(eq(payments.tripId, input.tripId))
          .limit(1);
          
        return { 
          success: true, 
          tripId: input.tripId, 
          paymentId: existingPayment?.id,
          idempotent: true 
        };
      }

      // Verify the transaction with Paystack (throws if failed)
      const paystackResult = await paystack.verifyTransaction(input.paystackReference);

      // Mark trip as PAID
      await db
        .update(trips)
        .set({ status: "PAID", updatedAt: new Date() })
        .where(eq(trips.id, input.tripId));

      // Create the payment record linked to this trip
      const [payment] = await db
        .insert(payments)
        .values({
          tripId: input.tripId,
          paystackReference: input.paystackReference,
          amount: paystackResult.amount.toString(),
          currency: paystackResult.currency,
          status: "CAPTURED",
          paidAt: new Date(),
        })
        .returning();

      if (!payment) {
        throw new Error("Failed to create payment record");
      }

      if (qstash && process.env.WORKER_FULFILLMENT_URL) {
        await qstash.publishJSON({
          url: process.env.WORKER_FULFILLMENT_URL,
          body: { tripId: input.tripId, userId: context.userId },
        });
      }

      // 🔴 Real-time: notify customer's checkout page that payment is captured
      await publishPaymentEvent({
        type: "payment:captured",
        tripId: input.tripId,
        amount: input.amount,
        currency: input.currency,
        paystackReference: input.paystackReference,
      });

      return { success: true, tripId: input.tripId, paymentId: payment.id };
    }),

  /**
   * Fetches a single trip with its items and payment.
   * Used for polling on the booking success/status screen.
   */
  getTrip: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .handler(async ({ input, context }) => {
      const trip = await db.query.trips.findFirst({
        where: and(eq(trips.id, input.tripId), eq(trips.userId, context.userId)),
        with: {
          items: true,
          payment: true,
        },
      });

      if (!trip) throw new Error("Trip not found or access denied");

      return trip;
    }),
};
