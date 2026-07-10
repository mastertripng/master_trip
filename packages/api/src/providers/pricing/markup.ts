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
  return db.query.markupRules.findFirst({
    where: (rules, { and, eq, or, isNull }) => and(
      eq(rules.isActive, true),
      or(
        and(
          eq(rules.vertical, params.vertical as any),
          eq(rules.origin, params.origin),
          eq(rules.destination, params.destination),
          params.cabinClass ? eq(rules.cabinClass, params.cabinClass) : isNull(rules.cabinClass),
          params.userTier ? eq(rules.userTier, params.userTier as any) : isNull(rules.userTier)
        ),
        and(
          eq(rules.vertical, params.vertical as any),
          eq(rules.origin, params.origin),
          eq(rules.destination, params.destination),
          isNull(rules.cabinClass),
          isNull(rules.userTier)
        ),
        and(
          eq(rules.vertical, params.vertical as any),
          isNull(rules.origin),
          isNull(rules.destination)
        ),
        and(
          isNull(rules.vertical),
          isNull(rules.origin),
          isNull(rules.destination)
        )
      )
    ),
    orderBy: (rules, { desc }) => [desc(rules.priority)],
  });
}
