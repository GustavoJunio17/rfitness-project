import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIX = "/dashboard";
const SESSION_FLAG_COOKIE = "rf_session";

export function middleware(request: NextRequest) {
  const isProtected = request.nextUrl.pathname.startsWith(PROTECTED_PREFIX);
  const hasSession = request.cookies.has(SESSION_FLAG_COOKIE);

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
