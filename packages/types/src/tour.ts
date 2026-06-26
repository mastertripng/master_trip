import { z } from "zod";

// ─────────────────────────────────────────────
// TOUR SEARCH
// ─────────────────────────────────────────────

export const TourSearchInputSchema = z.object({
  location: z.string().min(2),
  date: z.string().date(),
  participants: z.number().int().min(1).default(1),
  currency: z.string().default("NGN"),
});

export type TourSearchInput = z.infer<typeof TourSearchInputSchema>;

export const TourResultSchema = z.object({
  id: z.string(),
  provider: z.string(), // "local_tours_ng" | future providers
  name: z.string(),
  description: z.string(),
  location: z.string(),
  durationHours: z.number(),
  maxParticipants: z.number(),
  availableSpots: z.number(),
  pricePerPerson: z.number(),
  totalPrice: z.number(),
  currency: z.string(),
  date: z.string(),
  guideId: z.string().optional(),
  includes: z.array(z.string()).default([]),
  images: z.array(z.string().url()).default([]),
});

export type TourResult = z.infer<typeof TourResultSchema>;
