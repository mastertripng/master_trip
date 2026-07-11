import type { IHotelProvider, HotelSearchInput, HotelResult } from "@master-trip/types";

/**
 * Booking.com Demand API (v3.2) Adapter
 * Strictly adheres to Master-Trip's VCC / Unified Checkout architecture.
 */
export class BookingComAdapter implements IHotelProvider {
  readonly name = "booking_com";
  private readonly apiKey: string;
  private readonly affiliateId: string;
  private readonly baseUrl = "https://api.booking.com/v3.2"; // Demand API v3.2

  constructor(apiKey: string, affiliateId: string) {
    if (!apiKey) throw new Error("Missing BOOKING_COM_API_KEY");
    this.apiKey = apiKey;
    this.affiliateId = affiliateId;
  }

  async searchHotels(input: HotelSearchInput & { isAuthenticated?: boolean }): Promise<HotelResult[]> {
    console.log(`[Booking.com v3.2] Searching accommodations in ${input.destination}`);

    // Demand API v3.2 /search payload
    const payload = {
      destination: input.destination,
      checkin: input.checkIn,
      checkout: input.checkOut,
      guests: {
        adults: input.adults,
        children: input.children > 0 ? Array(input.children).fill(8) : undefined, // Mocking child ages to 8 for search
      },
      rooms: input.rooms,
      currency: input.currency,
      filters: {
        payment: { timing: "pay_online" }, // CRITICAL: Enforce Paystack/Flutterwave VCC flow
      },
      booker: {
        country: "US", // Should be dynamic based on user location for VAT laws
        // Unlock Closed User Group (CUG) / mobile rates if the user is logged into Master-Trip
        user_groups: input.isAuthenticated ? ["authenticated"] : [],
      }
    };

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "X-Affiliate-Id": this.affiliateId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Demand API Error: ${response.status}`);
      }

      const data = await response.json();
      const accommodations = data.accommodations || [];

      // Filter out non-compliant EEA hosts per Digital Services Act (DSA)
      const compliantAccommodations = accommodations.filter((acc: any) => {
        if (acc.host_type === "professional" && acc.trader_verified === false) {
          return false; // Exclude illegally unregistered professional hosts
        }
        return true;
      });

      return compliantAccommodations.map((raw: any) => this.normalize(raw, input));
    } catch (error) {
      console.error("[Booking.com] /search failed:", error);
      throw new Error("Failed to fetch accommodations from Booking.com Demand API");
    }
  }

  async bookHotel(
    hotelId: string,
    guests: unknown[],
    idempotencyKey: string
  ): Promise<{ confirmationNumber: string }> {
    console.log(`[Booking.com v3.2] Creating order for ${hotelId}...`);
    // Will implement /orders/create with the VCC SCA exemption payload
    return { confirmationNumber: `BK-V32-${Math.random().toString(36).substring(2, 9).toUpperCase()}` };
  }

  async cancelBooking(confirmationNumber: string): Promise<void> {
    console.log(`[Booking.com v3.2] Cancelling order: ${confirmationNumber}`);
  }

  /**
   * Normalizes v3.2 Demand API responses into Master-Trip's generic HotelResult.
   */
  private normalize(raw: any, searchParams: HotelSearchInput): HotelResult {
    // 1. The "No Math" Rule: Trust the API's price.total
    const priceTotal = raw.price?.total || 0;
    
    // 2. VCC Chargeable Online: The exact amount we must charge via Paystack
    const chargeableOnline = raw.price?.chargeable_online || priceTotal;

    // Calculate per-night purely for display purposes if needed
    const checkInDate = new Date(searchParams.checkIn);
    const checkOutDate = new Date(searchParams.checkOut);
    const nights = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24)));
    const pricePerNight = chargeableOnline / nights;

    return {
      id: raw.id?.toString(),
      provider: this.name,
      name: raw.name || "Unknown Property",
      address: raw.location?.address || "Address not provided",
      starRating: Number(raw.rating?.stars || 3),
      roomType: raw.recommendation?.room_name || "Recommended Allocation",
      availableRooms: searchParams.rooms,
      pricePerNight: Number(pricePerNight),
      totalPrice: Number(chargeableOnline), // We pass chargeableOnline up to the Markup Engine
      currency: raw.price?.currency || searchParams.currency,
      checkIn: searchParams.checkIn,
      checkOut: searchParams.checkOut,
      images: raw.photos ? [raw.photos[0]?.url] : [],
      amenities: raw.facilities || [],
      cancellationPolicy: raw.policies?.cancellation_type === "free_cancellation" ? "Free Cancellation" : "Non-refundable",
    };
  }
}
