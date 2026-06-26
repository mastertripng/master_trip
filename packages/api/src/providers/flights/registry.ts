import type { IFlightProvider } from "@master-trip/types";
import { Travels247Adapter } from "./adapters/travels247.adapter";

/**
 * Flight Provider Registry
 *
 * This is the ONLY place you add or remove flight providers.
 * The aggregator and router don't care what's in here — they iterate blindly.
 *
 * To add a new provider:
 *   1. Create a new adapter in ./adapters/
 *   2. Add it to the array below
 *   That's it. Zero other code changes needed.
 */
export function getFlightProviders(): IFlightProvider[] {
  const providers: IFlightProvider[] = [];

  // ── MVP: 247 Travels (Primary) ───────────────────────────
  if (process.env.TRAVELS_247_API_KEY && process.env.TRAVELS_247_BASE_URL) {
    providers.push(
      new Travels247Adapter(
        process.env.TRAVELS_247_API_KEY,
        process.env.TRAVELS_247_BASE_URL
      )
    );
  }

  // ── Future: Global provider (e.g. Amadeus, Duffel) ───────
  // if (process.env.AMADEUS_API_KEY) {
  //   providers.push(new AmadeusAdapter(process.env.AMADEUS_API_KEY));
  // }

  if (providers.length === 0) {
    throw new Error("No flight providers configured. Check your environment variables.");
  }

  return providers;
}
