import { destroySession } from "@/lib/auth/session";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

/** Clear the session cookie. Always succeeds (idempotent). */
export async function POST(): Promise<Response> {
  await destroySession();
  return Response.json({ ok: true }, { headers: NO_STORE });
}
