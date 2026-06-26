import type { FlightResult } from "@master-trip/types";
import { db } from "@master-trip/db";

/**
 * Pricing & Markup Engine
 *
 * Rules are ALWAYS loaded from the database — never hardcoded.
 * Ops can update markups via the Admin Dashboard in real-time, no deploy needed.
 *
 * Rule resolution order (most specific wins):
 *   1. Exact route match     (origin + destination + cabinClass + userTier)
 *   2. Route match           (origin + destination)
 *   3. Vertical match        (e.g. all FLIGHT items)
 *   4. Global catch-all      (no origin/destination/vertical filter)
 *
 * Markup types:
 *   - flatAmount: fixed currency addition (e.g. ₦30,000)
 *   - percentage: multiplier (e.g. 0.05 = 5% on top of base price)
 */
export async function applyMarkup(
  result: FlightResult,
  userTier?: string
): Promise<FlightResult> {
  const rule = await resolveMarkupRule({
    vertical: "FLIGHT",
    origin: result.origin,
    destination: result.destination,
    cabinClass: result.cabinClass,
    userTier,
  });

  if (!rule) {
    // No rule configured — return base price unchanged and log a warning
    console.warn(
      `[Markup] No active markup rule found for route ${result.origin}->${result.destination}. Returning base price.`
    );
    return { ...result, markedUpPrice: result.basePrice };
  }

  let markup = 0;

  if (rule.flatAmount !== null && rule.flatAmount !== undefined) {
    markup = Number(rule.flatAmount);
  } else if (rule.percentage !== null && rule.percentage !== undefined) {
    markup = result.basePrice * Number(rule.percentage);
  }

  return {
    ...result,
    markedUpPrice: result.basePrice + markup,
  };
}

/**
 * Resolves the most specific active markup rule for the given context.
 * Ordered by `priority` DESC so ops can override specific routes.
 */
async function resolveMarkupRule(params: {
  vertical: string;
  origin: string;
  destination: string;
  cabinClass?: string;
  userTier?: string;
}) {
  return db.markupRule.findFirst({
    where: {
      isActive: true,
      OR: [
        // Most specific: exact route + cabin + tier
        {
          vertical: params.vertical as any,
          origin: params.origin,
          destination: params.destination,
          cabinClass: params.cabinClass ?? null,
          userTier: (params.userTier as any) ?? null,
        },
        // Route-level rule
        {
          vertical: params.vertical as any,
          origin: params.origin,
          destination: params.destination,
          cabinClass: null,
          userTier: null,
        },
        // Vertical-level rule (all flights)
        {
          vertical: params.vertical as any,
          origin: null,
          destination: null,
        },
        // Global catch-all
        {
          vertical: null,
          origin: null,
          destination: null,
        },
      ],
    },
    orderBy: { priority: "desc" },
  });
}
