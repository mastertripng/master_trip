import type { IHotelProvider } from "@master-trip/types";
import { BookingComAdapter } from "./adapters/booking-com.adapter";

export function getHotelProviders(): IHotelProvider[] {
  const providers: IHotelProvider[] = [];

  // ── MVP: Booking.com (Primary) ───────────────────────────
  if (process.env.BOOKING_COM_API_KEY && process.env.BOOKING_COM_AFFILIATE_ID) {
    providers.push(
      new BookingComAdapter(
        process.env.BOOKING_COM_API_KEY,
        process.env.BOOKING_COM_AFFILIATE_ID
      )
    );
  }

  // ── Future: Secondary hotel provider ─────────────────────
  // if (process.env.EXPEDIA_API_KEY) {
  //   providers.push(new ExpediaAdapter(process.env.EXPEDIA_API_KEY));
  // }

  if (providers.length === 0) {
    throw new Error("No hotel providers configured. Check your environment variables.");
  }

  return providers;
}
