import type { IHotelProvider, HotelSearchInput, HotelResult } from "@master-trip/types";

/**
 * Booking.com Hotel Adapter
 * Implements IHotelProvider using the Booking.com Affiliate/Connectivity API.
 */
export class BookingComAdapter implements IHotelProvider {
  readonly name = "booking_com";
  private readonly apiKey: string;
  private readonly affiliateId: string;

  constructor(apiKey: string, affiliateId: string) {
    this.apiKey = apiKey;
    this.affiliateId = affiliateId;
  }

  async searchHotels(input: HotelSearchInput): Promise<HotelResult[]> {
    // TODO: implement Booking.com Affiliate API search
    // https://developers.booking.com/affiliate/
    console.log("Searching Booking.com for:", input);
    return [];
  }

  async bookHotel(
    hotelId: string,
    guests: unknown[],
    idempotencyKey: string
  ): Promise<{ confirmationNumber: string }> {
    console.log("Booking hotel:", { hotelId, idempotencyKey });
    return { confirmationNumber: "PLACEHOLDER_CONF" };
  }

  async cancelBooking(confirmationNumber: string): Promise<void> {
    console.log("Cancelling hotel:", confirmationNumber);
  }

  private normalize(raw: Record<string, unknown>): HotelResult {
    throw new Error("normalize() not yet implemented — awaiting Booking.com API setup");
  }
}
