import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { serverAuthEnabled } from "@/lib/auth/config";

// Next 16 renamed Middleware to Proxy (same runtime). Clerk's middleware is
// wired in here so server-side `auth()` works in the export API route.
//
// Guarded on `serverAuthEnabled` (both keys) — the SAME fact the export API
// keys off — so middleware and API can never disagree. With no/partial Clerk
// keys the app runs auth-free, so local dev / CI builds need no secrets.
export default serverAuthEnabled
  ? clerkMiddleware()
  : function proxy() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    // run on everything except Next internals and static files…
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // …and always on API routes
    "/(api|trpc)(.*)",
  ],
};
