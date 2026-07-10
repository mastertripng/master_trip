import { ORPCError } from "@orpc/server";

/**
 * Global Error Handler Middleware for oRPC.
 * Catches all unexpected errors, logs them securely, and prevents internal stack traces
 * from leaking to the frontend.
 */
export const globalErrorHandler = async ({ next, path }: any) => {
  try {
    return await next();
  } catch (error) {
    console.error(`[API Error] at path "${path.join('/')}":`, error);

    // If it's already a controlled oRPC error (e.g., UNAUTHORIZED, BAD_REQUEST), let it pass
    if (error instanceof ORPCError) {
      throw error;
    }

    // Otherwise, mask it as a generic 500 error
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "An unexpected internal error occurred. Our team has been notified.",
      cause: error,
    });
  }
};
