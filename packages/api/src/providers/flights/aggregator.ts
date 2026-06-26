import type { FlightSearchInput, FlightResult } from "@master-trip/types";
import { getFlightProviders } from "./registry";
import { applyMarkup } from "../pricing/markup";

/**
 * Flight Aggregator
 *
 * Fans out search requests to ALL active providers simultaneously.
 * - Uses Promise.allSettled so one provider crashing doesn't kill the whole search
 * - Merges results, sorts by marked-up price ascending
 * - Caching is handled by the caller (oRPC router) via Upstash Redis
 */
export async function searchFlightsAggregated(
  input: FlightSearchInput
): Promise<FlightResult[]> {
  const providers = getFlightProviders();

  // Fan out to all providers in parallel
  const settled = await Promise.allSettled(
    providers.map((provider) => provider.searchFlights(input))
  );

  const allResults: FlightResult[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      allResults.push(...result.value);
    } else {
      // Log failed provider but don't crash
      console.error("[FlightAggregator] Provider failed:", result.reason);
    }
  }

  // Apply business markup to each result (markup engine is async because it checks the DB)
  const withMarkup = await Promise.all(
    allResults.map((result) => applyMarkup(result))
  );

  // Sort by marked-up price ascending (cheapest first)
  return withMarkup.sort((a, b) => a.markedUpPrice - b.markedUpPrice);
}
