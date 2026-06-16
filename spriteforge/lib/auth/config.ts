/**
 * Auth feature switch for the self-hosted (MySQL) login + 3-day export trial.
 *
 * One deployer-controlled flag, `NEXT_PUBLIC_AUTH_ENABLED`, drives both sides:
 * - {@link authEnabled} is the client-visible fact (the flag is `NEXT_PUBLIC_`,
 *   so it's inlined into the bundle). It gates whether the login UI renders.
 * - {@link serverAuthEnabled} additionally requires the server-only DB + JWT
 *   secrets to actually be present, so a partial/keyless deploy degrades to
 *   "open export" instead of 500-ing. The export API + auth routes consult it.
 *
 * Keying both off the one flag keeps client and server from disagreeing: flag
 * off → both run open (no login, export for all); flag on → server still needs
 * its secrets before it enforces anything.
 *
 * Referenced directly (not destructured) so Next inlines the values at build time.
 */
export const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

/**
 * Server-side counterpart. The DB/JWT vars are server-only (not `NEXT_PUBLIC_`),
 * stripped from the client bundle — this constant reads `false` there and is
 * only ever consulted on the server (export API, auth routes).
 */
export const serverAuthEnabled =
  process.env.NEXT_PUBLIC_AUTH_ENABLED === "true" &&
  !!process.env.DB_HOST &&
  !!process.env.DB_NAME &&
  !!process.env.AUTH_JWT_SECRET;

/** Free trial length, in milliseconds (3 days). */
export const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
