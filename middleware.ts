import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isStaffRoute = pathname.startsWith("/dashboard");
  const isParentRoute = pathname.startsWith("/parent");
  // Just requires login here — the allowlist check (SUPERADMIN_EMAILS) happens
  // in the page/actions themselves, since it needs a DB lookup for the user's
  // email that the JWT session payload doesn't carry.
  const isSuperadminRoute = pathname.startsWith("/superadmin");
  const homeForSession = session?.role === "parent" ? "/parent" : "/dashboard";

  if ((isStaffRoute || isParentRoute || isSuperadminRoute) && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Parents don't get the staff dashboard, and staff don't get the parent one.
  if (isStaffRoute && session && session.role === "parent") {
    return NextResponse.redirect(new URL("/parent", request.url));
  }
  if (isParentRoute && session && session.role !== "parent") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL(homeForSession, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/parent/:path*", "/superadmin/:path*", "/login", "/signup"],
};
