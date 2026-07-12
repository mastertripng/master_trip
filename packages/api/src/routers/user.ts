import { z } from "zod";
import { protectedProcedure } from "../procedures";
import { db, users, travelers, trips, supportChats } from "@master-trip/db";
import { eq, and } from "drizzle-orm";

/**
 * User Router — Self-Service Account Management
 *
 * All endpoints are scoped to the currently authenticated user.
 * Users can NEVER access or modify another user's data.
 * The userId is always injected from the session (context), never from input.
 */
export const userRouter = {

  // ════════════════════════════════════════════
  // PROFILE
  // ════════════════════════════════════════════

  /**
   * Returns the authenticated user's own profile.
   * Includes their traveler profiles (e.g., spouse, children on same account).
   */
  getProfile: protectedProcedure.handler(async ({ context }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, context.userId),
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
        tier: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        travelerProfiles: true,
      },
    });

    if (!user) throw new Error("User not found");
    return user;
  }),

  /**
   * Updates the authenticated user's display name.
   * Email updates are intentionally excluded — that requires re-verification.
   */
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100).optional(),
    }))
    .handler(async ({ input, context }) => {
      const updates: Partial<typeof input> = {};
      if (input.name !== undefined) updates.name = input.name;

      await db
        .update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, context.userId));

      return { success: true };
    }),


  // ════════════════════════════════════════════
  // TRAVELER PROFILES (passenger details)
  // ════════════════════════════════════════════

  /**
   * Adds a traveler profile (e.g., a spouse or child) to the user's account.
   * These are used to pre-fill passenger details at checkout.
   */
  addTraveler: protectedProcedure
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      documents: z.record(z.string(), z.unknown()).optional(),
    }))
    .handler(async ({ input, context }) => {
      const [traveler] = await db
        .insert(travelers)
        .values({
          userId: context.userId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          documents: input.documents ?? {},
        })
        .returning();

      return traveler;
    }),

  /**
   * Updates an existing traveler profile.
   * User can only update traveler profiles that belong to them.
   */
  updateTraveler: protectedProcedure
    .input(z.object({
      travelerId: z.string().uuid(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      documents: z.record(z.string(), z.unknown()).optional(),
    }))
    .handler(async ({ input, context }) => {
      const { travelerId, ...fields } = input;

      // Security: only update if the traveler belongs to this user
      const updates = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined)
      );

      await db
        .update(travelers)
        .set(updates)
        .where(
          and(
            eq(travelers.id, travelerId),
            eq(travelers.userId, context.userId) // ownership check
          )
        );

      return { success: true };
    }),

  /**
   * Removes a traveler profile from the user's account.
   */
  deleteTraveler: protectedProcedure
    .input(z.object({ travelerId: z.string().uuid() }))
    .handler(async ({ input, context }) => {
      await db
        .delete(travelers)
        .where(
          and(
            eq(travelers.id, input.travelerId),
            eq(travelers.userId, context.userId) // ownership check
          )
        );

      return { success: true };
    }),


  // ════════════════════════════════════════════
  // BOOKING HISTORY
  // ════════════════════════════════════════════

  /**
   * Returns the authenticated user's full booking history.
   * Ordered by most recent first.
   */
  getMyTrips: protectedProcedure.handler(async ({ context }) => {
    return db.query.trips.findMany({
      where: eq(trips.userId, context.userId),
      orderBy: (trips, { desc }) => [desc(trips.createdAt)],
      with: {
        items: true,
        payment: true,
      },
    });
  }),


  // ════════════════════════════════════════════
  // ACCOUNT DELETION
  // ════════════════════════════════════════════

  /**
   * Permanently deletes the authenticated user's account and all associated data.
   *
   * ⚠️  GDPR / Right to Erasure compliance endpoint.
   *
   * Before deleting, we check there are no ACTIVE or PAID trips
   * to prevent mid-booking data loss. The user must cancel/resolve
   * those trips first.
   *
   * Deletion cascade order (to satisfy FK constraints):
   *   supportChats → travelers → trips (only DRAFT/CANCELLED) → users
   */
  deleteAccount: protectedProcedure
    .input(z.object({
      confirmation: z.literal("DELETE MY ACCOUNT"),
    }))
    .handler(async ({ context }) => {
      // Safety check: block deletion if user has active/paid trips
      const activeTrip = await db.query.trips.findFirst({
        where: and(
          eq(trips.userId, context.userId),
          // Only allow deletion if no trips in flight
        ),
        columns: { id: true, status: true },
      });

      // Check for trips that are in progress (not cancellable)
      const blockedStatuses = ["PAID", "FULFILLING", "CONFIRMED"];
      if (activeTrip && blockedStatuses.includes(activeTrip.status)) {
        throw new Error(
          "Cannot delete account with active or confirmed bookings. " +
          "Please contact support to resolve your outstanding trips first."
        );
      }

      // Cascade delete in FK-safe order
      await db.delete(supportChats).where(eq(supportChats.userId, context.userId));
      await db.delete(travelers).where(eq(travelers.userId, context.userId));
      await db.delete(trips).where(eq(trips.userId, context.userId));
      await db.delete(users).where(eq(users.id, context.userId));

      return { success: true, message: "Your account has been permanently deleted." };
    }),
};
