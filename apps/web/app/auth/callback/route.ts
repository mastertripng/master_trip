import { handleAuth } from "@workos-inc/authkit-nextjs";

/**
 * WorkOS AuthKit callback handler.
 * After the user authenticates (Google, Magic Link, SAML, etc.),
 * WorkOS redirects here with a `code` query param.
 * AuthKit exchanges it for a session and sets the encrypted cookie automatically.
 */
export const GET = handleAuth();
