import { auth } from "@clerk/nextjs/server";
import { serverAuthEnabled } from "@/lib/auth/config";
import { evaluateTrial } from "@/lib/auth/trial";

/**
 * Export permission + trial check. The browser does ALL the actual export work
 * locally; this route only authorizes it and never receives video/frame data.
 *
 * - GET  → read-only trial status (header badge); does NOT start the trial.
 * - POST → export authorization; STARTS the trial on first use.
 *
 * When auth isn't fully configured on the server, everything is allowed so a
 * partial / keyless deployment degrades to open export rather than 500-ing.
 */
const NO_STORE = { "Cache-Control": "no-store" };

async function handle(start: boolean): Promise<Response> {
  if (!serverAuthEnabled) {
    return Response.json(
      { allowed: true, reason: "auth-disabled" },
      { headers: NO_STORE },
    );
  }
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json(
        { allowed: false, reason: "unauthenticated" },
        { status: 401, headers: NO_STORE },
      );
    }
    const trial = await evaluateTrial(userId, start);
    return Response.json(
      { ...trial, reason: trial.allowed ? "ok" : "trial-expired" },
      { headers: NO_STORE },
    );
  } catch {
    return Response.json(
      { allowed: false, reason: "error" },
      { status: 500, headers: NO_STORE },
    );
  }
}

export function GET() {
  return handle(false);
}

export function POST() {
  return handle(true);
}
