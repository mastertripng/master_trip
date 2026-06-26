import { z } from "zod";

// ─────────────────────────────────────────────
// HOTEL SEARCH
// ─────────────────────────────────────────────

export const HotelSearchInputSchema = z.object({
  destination: z.string().min(2),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  rooms: z.number().int().min(1).max(50).default(1), // Up to 50 for B2B corporate orders
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  currency: z.string().default("NGN"),
});

export type HotelSearchInput = z.infer<typeof HotelSearchInputSchema>;

export const HotelResultSchema = z.object({
  id: z.string(),
  provider: z.string(), // "booking_com" | future providers
  name: z.string(),
  address: z.string(),
  starRating: z.number().min(1).max(5),
  roomType: z.string(),
  availableRooms: z.number(),
  pricePerNight: z.number(),
  totalPrice: z.number(),
  currency: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  images: z.array(z.string().url()).default([]),
  amenities: z.array(z.string()).default([]),
  cancellationPolicy: z.string(),
});

export type HotelResult = z.infer<typeof HotelResultSchema>;
