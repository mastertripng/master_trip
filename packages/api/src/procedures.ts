import { os, ORPCError } from "@orpc/server";
import { db, users } from "@master-trip/db";
import { eq } from "drizzle-orm";
import { globalErrorHandler } from "./middlewares/error.middleware";

// ─────────────────────────────────────────────
// SESSION TYPES
// ─────────────────────────────────────────────

export type AuthContext = {
  userId: string;
  role: "CUSTOMER" | "SUPPORT_AGENT" | "OPERATIONS" | "ADMIN";
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Extracts and verifies the WorkOS session JWT from the incoming request.
 *
 * WorkOS sessions are issued as signed JWTs. On each API request the client
 * sends the token in the `Authorization: Bearer <token>` header.
 *
 * In production, uncomment the `jose` block below to verify the RS256
 * signature against the WorkOS JWKS endpoint (zero round-trip, in-process).
 */
async function extractWorkOSUserId(headers: Headers): Promise<string> {
  const authHeader = headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "No session token provided.",
    });
  }

  // ── PRODUCTION: uncomment and install `jose` ──────────────────────────────
  // import { createRemoteJWKSet, jwtVerify } from "jose";
  // const JWKS = createRemoteJWKSet(
  //   new URL(`https://api.workos.com/sso/jwks/${process.env.WORKOS_CLIENT_ID}`)
  // );
  // const { payload } = await jwtVerify(token, JWKS, {
  //   issuer: "https://api.workos.com",
  //   audience: process.env.WORKOS_CLIENT_ID,
  // });
  // return payload.sub as string;
  // ─────────────────────────────────────────────────────────────────────────

  // DEV ONLY: pass the raw token value through as the user ID.
  // Replace with the jwtVerify block above before deploying to production.
  return token;
}

/**
 * Looks up the internal Master-Trip user row by WorkOS user ID.
 * Throws UNAUTHORIZED if no matching row is found (unregistered user).
 */
async function getMasterTripUser(workosUserId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, workosUserId),
  });

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "User account not found. Please complete registration.",
    });
  }

  return user;
}

// ─────────────────────────────────────────────
// PROCEDURES
// ─────────────────────────────────────────────

// Wrap the base `os` instance with our global error handler
const safeOS = os.use(globalErrorHandler);

/**
 * Public procedure — no auth required.
 * Use for hotel/flight/tour search endpoints.
 */
export const publicProcedure = safeOS;

/**
 * Protected procedure — requires a valid WorkOS session.
 * Injects { userId, role } into context so handlers never need to
 * re-fetch the session themselves.
 */
export const protectedProcedure = safeOS.use(async ({ context, next }) => {
  const headers = (context as { headers?: Headers }).headers;

  if (!headers) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Request headers are not available in context.",
    });
  }

  const workosUserId = await extractWorkOSUserId(headers);
  const user = await getMasterTripUser(workosUserId);

  return next({
    context: {
      ...context,
      userId: user.id,
      role: user.role as AuthContext["role"],
    },
  });
});

/**
 * Admin-only procedure — for internal dashboard routes.
 * Rejects anyone who is not ADMIN or OPERATIONS.
 */
export const adminProcedure = protectedProcedure.use(async ({ context, next }) => {
  const { role } = context as AuthContext;

  if (role !== "ADMIN" && role !== "OPERATIONS") {
    throw new ORPCError("FORBIDDEN", {
      message: "This action requires Admin or Operations access.",
    });
  }

  return next({ context });
});
