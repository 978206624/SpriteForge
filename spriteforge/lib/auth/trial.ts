import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db/pool";
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

interface TrialRow extends RowDataPacket {
  trial_started_at: number | null;
}

async function readTrialStart(userId: number): Promise<number> {
  const [rows] = await getPool().query<TrialRow[]>(
    "SELECT trial_started_at FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  const stored = rows[0]?.trial_started_at;
  return stored ? Number(stored) : 0;
}

/**
 * Evaluate a user's 3-day free trial. The start time lives in the user's
 * `trial_started_at` column (self-hosted MySQL; replaces Clerk private metadata).
 *
 * `start` controls whether a not-yet-started trial is begun: the export action
 * (POST) starts it; a read-only status check (GET, e.g. the header badge) does
 * not — so merely signing in / opening the app never consumes the trial.
 *
 * The write is guarded with `WHERE trial_started_at IS NULL`, then the value is
 * re-read, so two concurrent first-exports converge on whichever timestamp won
 * rather than clobbering each other.
 */
export async function evaluateTrial(userId: number, start: boolean): Promise<TrialStatus> {
  let trialStartedAt = await readTrialStart(userId);

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
    const now = Date.now();
    await getPool().execute(
      "UPDATE users SET trial_started_at = ? WHERE id = ? AND trial_started_at IS NULL",
      [now, userId],
    );
    // re-read so a concurrent start that won the race is reflected here too
    trialStartedAt = (await readTrialStart(userId)) || now;
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
