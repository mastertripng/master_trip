import { z } from "zod";

// ─────────────────────────────────────────────
// FLIGHT SEARCH
// Normalized schema — all flight providers must conform to this
// ─────────────────────────────────────────────

export const FlightSearchInputSchema = z.object({
  origin: z.string().length(3, "Must be a valid IATA airport code (e.g. LOS)"),
  destination: z.string().length(3),
  departureDate: z.string().date(), // ISO date: "2026-10-12"
  returnDate: z.string().date().optional(),
  adults: z.number().int().min(1).max(9).default(1),
  children: z.number().int().min(0).max(9).default(0),
  infants: z.number().int().min(0).default(0),
  cabinClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]).default("ECONOMY"),
  currency: z.string().default("NGN"),
});

export type FlightSearchInput = z.infer<typeof FlightSearchInputSchema>;

// Normalized flight result — every provider adapter maps to this
export const FlightResultSchema = z.object({
  id: z.string(),
  provider: z.string(), // "247_travels" | "future_provider"
  origin: z.string(),
  destination: z.string(),
  departureAt: z.string().datetime(),
  arrivalAt: z.string().datetime(),
  durationMinutes: z.number(),
  airline: z.string(),
  flightNumber: z.string(),
  cabinClass: z.string(),
  stops: z.number().default(0),
  basePrice: z.number(), // Provider wholesale cost in kobo
  markedUpPrice: z.number(), // What the user sees (with our markup)
  currency: z.string(),
  seatsAvailable: z.number(),
  expiresAt: z.string().datetime(), // Airline time limit for reservation
});

export type FlightResult = z.infer<typeof FlightResultSchema>;
