import { os } from "@orpc/server";
import { flightRouter } from "./routers/flights";
import { hotelRouter } from "./routers/hotels";
import { tourRouter } from "./routers/tours";
import { bookingRouter } from "./routers/bookings";
import { supportRouter } from "./routers/support";

/**
 * Master Trip oRPC Router
 * This is the single entry point for all backend API calls.
 * Consumed by apps/web via Next.js server actions / route handlers.
 */
export const appRouter = os.router({
  flights: flightRouter,
  hotels: hotelRouter,
  tours: tourRouter,
  bookings: bookingRouter,
  support: supportRouter,
});

export type AppRouter = typeof appRouter;
