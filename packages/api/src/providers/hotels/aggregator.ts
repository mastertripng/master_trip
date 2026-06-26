import type { HotelSearchInput, HotelResult } from "@master-trip/types";
import { getHotelProviders } from "./registry";

/**
 * Hotel Aggregator
 *
 * For individual bookings: same fan-out pattern as flights — parallel search, merge, sort.
 *
 * For B2B bulk orders (e.g. 50 rooms): uses the ACCUMULATOR pattern.
 * If one provider only has 25 rooms, it takes those, then fills the rest from the next provider.
 * This prevents large corporate orders from being rejected as "Sold Out".
 */
export async function searchHotelsAggregated(
  input: HotelSearchInput
): Promise<HotelResult[]> {
  const providers = getHotelProviders();

  const settled = await Promise.allSettled(
    providers.map((provider) => provider.searchHotels(input))
  );

  const allResults: HotelResult[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      allResults.push(...result.value);
    } else {
      console.error("[HotelAggregator] Provider failed:", result.reason);
    }
  }

  return allResults.sort((a, b) => a.totalPrice - b.totalPrice);
}

/**
 * B2B Bulk Room Accumulator
 * Used when a corporate client requests more rooms than any single provider has.
 * Splits the order across multiple providers to fulfill the full quantity.
 *
 * Example: Need 50 rooms
 *   → Booking.com has 25 → take all 25
 *   → Secondary provider has 30 → take 25 more
 *   → Order fulfilled: [{provider: "booking_com", rooms: 25}, {provider: "secondary", rooms: 25}]
 */
export async function accumulateRooms(
  input: HotelSearchInput,
  totalRoomsNeeded: number
): Promise<Array<{ provider: string; rooms: number; pricePerRoom: number }>> {
  const providers = getHotelProviders();

  // Fan out to all providers
  const settled = await Promise.allSettled(
    providers.map((p) => p.searchHotels(input))
  );

  // Flatten and sort cheapest wholesale price first
  const allOptions = settled
    .filter((r): r is PromiseFulfilledResult<HotelResult[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => a.totalPrice - b.totalPrice);

  let remaining = totalRoomsNeeded;
  const allocation: Array<{ provider: string; rooms: number; pricePerRoom: number }> = [];

  for (const option of allOptions) {
    if (remaining === 0) break;

    const take = Math.min(option.availableRooms, remaining);
    allocation.push({
      provider: option.provider,
      rooms: take,
      pricePerRoom: option.pricePerNight,
    });
    remaining -= take;
  }

  if (remaining > 0) {
    console.warn(`[HotelAccumulator] Could only fulfill ${totalRoomsNeeded - remaining}/${totalRoomsNeeded} rooms`);
  }

  return allocation;
}
