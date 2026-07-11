import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

/**
 * Global proxy — WorkOS AuthKit handles session verification.
 *
 * Unauthenticated users on protected routes are redirected DIRECTLY
 * to the WorkOS-hosted login UI (branded in the WorkOS dashboard).
 * Public/search routes pass through freely — login only required at checkout.
 */
export default authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      // Marketing & static pages
      "/",
      "/about",
      "/contact",
      "/legal/(.*)",
      // Auth flow
      "/auth/(.*)",
      // Public search pages — login required only at checkout
      "/hotels(.*)",
      "/flights(.*)",
      "/tours(.*)",
      "/study-abroad(.*)",
      "/support(.*)",
      // API & docs
      "/api/hotels(.*)",
      "/api/openapi.json",
      "/api-docs",
    ],
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
