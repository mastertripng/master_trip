import { z } from "zod";

// ─────────────────────────────────────────────
// CHECKOUT & BOOKING
// ─────────────────────────────────────────────

export const CheckoutInputSchema = z.object({
  tripId: z.string().cuid(),
  paystackReference: z.string(),
});

export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;

export const BookingStatusSchema = z.enum([
  "DRAFT",
  "PAID",
  "FULFILLING",
  "CONFIRMED",
  "PARTIAL_FAIL",
  "CANCELLED",
  "REFUNDED",
]);

export type BookingStatus = z.infer<typeof BookingStatusSchema>;

// ─────────────────────────────────────────────
// PROVIDER ADAPTER INTERFACE
// Every provider (247Travels, Booking.com etc.) must implement this
// This is the Adapter Pattern from the case study
// ─────────────────────────────────────────────

export interface IFlightProvider {
  name: string;
  searchFlights(input: import("./flight").FlightSearchInput): Promise<import("./flight").FlightResult[]>;
  bookFlight(flightId: string, travelers: unknown[], idempotencyKey: string): Promise<{ pnr: string; ticketNumber: string }>;
  cancelBooking(pnr: string): Promise<void>;
}

export interface IHotelProvider {
  name: string;
  searchHotels(input: import("./hotel").HotelSearchInput): Promise<import("./hotel").HotelResult[]>;
  bookHotel(hotelId: string, guests: unknown[], idempotencyKey: string): Promise<{ confirmationNumber: string }>;
  cancelBooking(confirmationNumber: string): Promise<void>;
}

export interface ITourProvider {
  name: string;
  searchTours(input: import("./tour").TourSearchInput): Promise<import("./tour").TourResult[]>;
  bookTour(tourId: string, participants: unknown[], idempotencyKey: string): Promise<{ bookingRef: string }>;
  cancelBooking(bookingRef: string): Promise<void>;
}
