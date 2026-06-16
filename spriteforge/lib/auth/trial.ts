import { clerkClient } from "@clerk/nextjs/server";
import { TRIAL_DURATION_MS } from "./config";

export interface TrialStatus {
  allowed: boolean;
  /** whether the trial has actually started (false = not yet, full window left) */
  started: boolean;
  /** epoch ms when the trial expires (0 when not started) */
  trialEndsAt: number;
  /** whole days remaining (full window when not started, 0 when expired) */
  daysLeft: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Evaluate a user's 3-day free trial. The start time is stored once in Clerk
 * private metadata (server-only authorization data; no self-hosted database).
 *
 * `start` controls whether a not-yet-started trial is begun: the export action
 * (POST) starts it; a read-only status check (GET, e.g. the header badge) does
 * not — so merely signing in / opening the app never consumes the trial.
 *
 * Only `{ privateMetadata: { trialStartedAt } }` is submitted (no spread of the
 * existing object) so a concurrent metadata write can't be clobbered.
 */
export async function evaluateTrial(
  userId: string,
  start: boolean,
): Promise<TrialStatus> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  const stored = user.privateMetadata?.trialStartedAt;
  let trialStartedAt = typeof stored === "number" ? stored : 0;

  if (!trialStartedAt) {
    if (!start) {
      // not started yet — report the full window as available without writing
      return {
        allowed: true,
        started: false,
        trialEndsAt: 0,
        daysLeft: Math.ceil(TRIAL_DURATION_MS / DAY_MS),
      };
    }
    trialStartedAt = Date.now();
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { trialStartedAt },
    });
  }

  const trialEndsAt = trialStartedAt + TRIAL_DURATION_MS;
  const remaining = trialEndsAt - Date.now();
  return {
    allowed: remaining > 0,
    started: true,
    trialEndsAt,
    daysLeft: Math.max(0, Math.ceil(remaining / DAY_MS)),
  };
}
