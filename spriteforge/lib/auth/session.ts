import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * Stateless session: a signed JWT carried in an httpOnly cookie. Replaces the
 * Clerk-hosted session. Server-only (reads the cookie jar + the server-only
 * `AUTH_JWT_SECRET`). The token's `sub` is the MySQL user id; `email` is mirrored
 * for convenience so the export/trial path needs no extra DB read just to know who.
 */
const COOKIE_NAME = "sf_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  userId: number;
  email: string;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_JWT_SECRET;
  if (!s) throw new Error("AUTH_JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

/** Sign a fresh session token and write it as an httpOnly cookie. */
export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.userId))
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

/** Read + verify the current session, or null if absent/invalid/expired. */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = Number(payload.sub);
    if (!Number.isFinite(userId)) return null;
    return { userId, email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}

/** Clear the session cookie (logout). */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
