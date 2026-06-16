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
/** The single deployer-controlled switch both sides key off of. */
const authFlagEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

export const authEnabled =
  authFlagEnabled && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Server-side counterpart, gated on the SAME `NEXT_PUBLIC_AUTH_ENABLED` flag as
 * {@link authEnabled} plus both Clerk keys (the secret is required for
 * `clerkMiddleware()` / `auth()`). Keying both sides off the one flag means
 * client and server can't disagree: with the flag off, both run open; with it
 * on, all three variables must be set. The export API and proxy consult this.
 * `CLERK_SECRET_KEY` is a server-only var (not `NEXT_PUBLIC_`), stripped from
 * the client bundle — this constant reads `false` there and is only ever
 * consulted on the server.
 */
export const serverAuthEnabled =
  authFlagEnabled &&
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

/** Free trial length, in milliseconds (3 days). */
export const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
