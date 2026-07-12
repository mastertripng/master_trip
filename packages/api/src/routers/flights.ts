import { z } from "zod";
import { publicProcedure } from "../procedures";
import { FlightSearchInputSchema } from "@master-trip/types/flight";
import { searchFlightsAggregated } from "../providers/flights/aggregator";
import { redis } from "../redis";

// Cache TTL: 5 minutes (300 seconds) — balances GDS rate limits vs. price freshness
const CACHE_TTL_SECONDS = 300;

export const flightRouter = {
  /**
   * Flight Search
   * 1. Check Upstash Redis cache first (key: origin-dest-date-cabin)
   * 2. On cache miss → fan out to all providers via aggregator
   * 3. Apply markup → sort by price → cache result → return to UI
   */
  search: publicProcedure
    .input(FlightSearchInputSchema)
    .handler(async ({ input }) => {
      const cacheKey = `flights:${input.origin}:${input.destination}:${input.departureDate}:${input.cabinClass}`;

      const cached = await redis.get(cacheKey);
      if (cached) return { results: cached as any, cached: true };

      const results = await searchFlightsAggregated(input);

      await redis.setex(cacheKey, CACHE_TTL_SECONDS, results);

      return { results, cached: false };
    }),

  /**
   * Price Revalidation
   * Called right before Paystack charge — ensures the price hasn't changed
   * since the user added the flight to their cart.
   */
  revalidate: publicProcedure
    .input(z.object({ flightId: z.string(), provider: z.string() }))
    .handler(async ({ input }) => {
      // TODO: hit provider directly (bypass cache) to get live price
      // const provider = getFlightProviders().find(p => p.name === input.provider);
      // const live = await provider.revalidateFlight(input.flightId);
      // return { valid: live.price === cachedPrice, currentPrice: live.price };
      return { valid: true, currentPrice: 0 };
    }),
};
