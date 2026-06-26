import type { IFlightProvider, FlightSearchInput, FlightResult } from "@master-trip/types";

/**
 * 247 Travels Flight Adapter
 * Implements IFlightProvider — the single source of truth for all flight operations.
 * All responses are normalized to FlightResult before leaving this class.
 */
export class Travels247Adapter implements IFlightProvider {
  readonly name = "247_travels";
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async searchFlights(input: FlightSearchInput): Promise<FlightResult[]> {
    // TODO: implement actual 247 Travels API call
    // const response = await fetch(`${this.baseUrl}/search`, {
    //   method: "POST",
    //   headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({ from: input.origin, to: input.destination, date: input.departureDate }),
    // });
    // const raw = await response.json();
    // return raw.flights.map(this.normalize);
    return [];
  }

  async bookFlight(
    flightId: string,
    travelers: unknown[],
    idempotencyKey: string
  ): Promise<{ pnr: string; ticketNumber: string }> {
    // TODO: POST to 247 Travels booking endpoint
    // Idempotency key prevents double-booking on retries
    console.log("Booking flight:", { flightId, idempotencyKey });
    return { pnr: "PLACEHOLDER_PNR", ticketNumber: "PLACEHOLDER_TICKET" };
  }

  async cancelBooking(pnr: string): Promise<void> {
    // TODO: POST to 247 Travels cancel endpoint
    console.log("Cancelling PNR:", pnr);
  }

  /**
   * Normalizes the raw 247 Travels response into our internal FlightResult shape.
   * This is the heart of the adapter — if their API changes, only this method changes.
   */
  private normalize(raw: Record<string, unknown>): FlightResult {
    // TODO: map raw 247 Travels fields → FlightResult schema
    throw new Error("normalize() not yet implemented — awaiting 247 Travels API docs");
  }
}
