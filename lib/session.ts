import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionToken, type SessionPayload } from "@/lib/auth";

/** Reads and verifies the session cookie. Call only from Server Components, Actions, or Route Handlers. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Must be called from a Server Action or Route Handler (not a plain Server Component render). */
export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/** Must be called from a Server Action or Route Handler. */
export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}
