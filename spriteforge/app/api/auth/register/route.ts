import type { NextRequest } from "next/server";
import { serverAuthEnabled } from "@/lib/auth/config";
import { createUser, findUserByEmail } from "@/lib/auth/users";
import { createSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Register with email + password, then sign the user in immediately. */
export async function POST(req: NextRequest): Promise<Response> {
  if (!serverAuthEnabled) {
    return Response.json({ error: "auth-disabled" }, { status: 400, headers: NO_STORE });
  }

  const body = (await req.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "邮箱格式不正确" }, { status: 400, headers: NO_STORE });
  }
  if (password.length < 6) {
    return Response.json({ error: "密码至少 6 位" }, { status: 400, headers: NO_STORE });
  }

  try {
    if (await findUserByEmail(email)) {
      return Response.json({ error: "该邮箱已注册" }, { status: 409, headers: NO_STORE });
    }
    const user = await createUser(email, password);
    await createSession({ userId: user.id, email: user.email });
    return Response.json({ user: { email: user.email } }, { headers: NO_STORE });
  } catch (e) {
    // lost the register race against a concurrent insert with the same email
    if ((e as { code?: string })?.code === "ER_DUP_ENTRY") {
      return Response.json({ error: "该邮箱已注册" }, { status: 409, headers: NO_STORE });
    }
    return Response.json({ error: "注册失败，请稍后重试" }, { status: 500, headers: NO_STORE });
  }
}
