import { z } from "zod";
import { publicProcedure } from "../procedures";
import { HotelSearchInputSchema } from "@master-trip/types/hotel";
import { searchHotelsAggregated, accumulateRooms } from "../providers/hotels/aggregator";

const CACHE_TTL_SECONDS = 600; // 10 minutes for hotel results

export const hotelRouter = {
  /**
   * Standard Hotel Search (individual + small group)
   */
  search: publicProcedure
    .input(HotelSearchInputSchema)
    .handler(async ({ input }) => {
      const cacheKey = `hotels:${input.destination}:${input.checkIn}:${input.checkOut}:${input.rooms}`;

      // TODO: check Upstash Redis cache
      // const cached = await redis.get(cacheKey);
      // if (cached) return { results: cached, cached: true };

      const results = await searchHotelsAggregated(input);

      // TODO: cache results
      // await redis.setex(cacheKey, CACHE_TTL_SECONDS, results);

      return { results, cached: false };
    }),

  /**
   * B2B Bulk Room Request (corporate / group bookings)
   * Uses the accumulator pattern — splits order across providers if needed
   */
  bulkRooms: publicProcedure
    .input(HotelSearchInputSchema.extend({
      totalRoomsNeeded: z.number().int().min(10).max(500),
    }))
    .handler(async ({ input }) => {
      const { totalRoomsNeeded, ...searchInput } = input;
      const allocation = await accumulateRooms(searchInput, totalRoomsNeeded);
      return { allocation };
    }),
};
