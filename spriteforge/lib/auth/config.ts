/**
 * Whether the client-side login/export gate is active. Gated behind an EXPLICIT
 * `NEXT_PUBLIC_AUTH_ENABLED=true` flag (plus a publishable key so ClerkProvider
 * has something to mount) rather than mere key presence — this is the one fact
 * the client CAN see, and pairing it with {@link serverAuthEnabled} keeps client
 * and server from disagreeing. With the flag unset the app runs fully open (no
 * provider, no gate), matching the Phase 6 behaviour and keeping keyless
 * dev/CI builds working.
 *
 * Referenced directly (not destructured) so Next inlines the values into the
 * client bundle at build time.
 */
export const authEnabled =
  process.env.NEXT_PUBLIC_AUTH_ENABLED === "true" &&
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Server-side counterpart: auth is only truly enforceable when BOTH the
 * publishable key and the secret key are present (the secret is required for
 * `clerkMiddleware()` / `auth()`). The export API and proxy key off this so a
 * partial (public-key-only) configuration degrades gracefully instead of
 * throwing. `CLERK_SECRET_KEY` is a server-only var (not `NEXT_PUBLIC_`), so it
 * is stripped from the client bundle — this constant reads `false` there and is
 * only ever consulted on the server.
 */
export const serverAuthEnabled =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

/** Free trial length, in milliseconds (3 days). */
export const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
