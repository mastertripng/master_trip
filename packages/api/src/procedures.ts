import { os } from "@orpc/server";

/**
 * oRPC base procedure
 * All routes are built from this — add auth middleware here later
 */
export const publicProcedure = os;

/**
 * Protected procedure — requires authenticated user session
 * Middleware will inject userId into context
 */
export const protectedProcedure = os.use(async ({ context, next }) => {
  // TODO: validate session from WorkOS / NextAuth
  // const session = await getSession(context.headers);
  // if (!session) throw new ORPCError({ code: "UNAUTHORIZED" });
  return next({ context: { ...context, userId: "placeholder" } });
});
