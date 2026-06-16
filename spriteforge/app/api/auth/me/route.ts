import { serverAuthEnabled } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

/** Current-user probe for the client AuthProvider. Returns `{ authDisabled }`
 *  when the server isn't enforcing auth, else `{ user }` (null when signed out). */
export async function GET(): Promise<Response> {
  if (!serverAuthEnabled) {
    return Response.json({ authDisabled: true, user: null }, { headers: NO_STORE });
  }
  const session = await getSession();
  return Response.json(
    { user: session ? { email: session.email } : null },
    { headers: NO_STORE },
  );
}
