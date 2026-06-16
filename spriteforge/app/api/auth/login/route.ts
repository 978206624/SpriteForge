import type { NextRequest } from "next/server";
import { serverAuthEnabled } from "@/lib/auth/config";
import { findUserByEmail, verifyPassword } from "@/lib/auth/users";
import { createSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

/** Log in with email + password. Same generic error for unknown email and bad
 *  password so the endpoint doesn't leak which emails are registered. */
export async function POST(req: NextRequest): Promise<Response> {
  if (!serverAuthEnabled) {
    return Response.json({ error: "auth-disabled" }, { status: 400, headers: NO_STORE });
  }

  const body = (await req.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return Response.json({ error: "请输入邮箱和密码" }, { status: 400, headers: NO_STORE });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return Response.json({ error: "邮箱或密码错误" }, { status: 401, headers: NO_STORE });
    }
    await createSession({ userId: user.id, email: user.email });
    return Response.json({ user: { email: user.email } }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "登录失败，请稍后重试" }, { status: 500, headers: NO_STORE });
  }
}
