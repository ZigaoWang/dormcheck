import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isDeviceApi =
    req.nextUrl.pathname === "/api/checkin" ||
    req.nextUrl.pathname === "/api/health" ||
    req.nextUrl.pathname === "/api/feed/stream" ||
    req.nextUrl.pathname === "/api/devices/verify" ||
    req.nextUrl.pathname === "/api/upload" ||
    req.nextUrl.pathname.startsWith("/api/upload/") ||
    req.nextUrl.pathname === "/api/lockers/lookup" ||
    req.nextUrl.pathname === "/api/lockers" ||
    req.nextUrl.pathname === "/api/students/lookup" ||
    req.nextUrl.pathname === "/api/students/bind";
  const isCheckinPage = req.nextUrl.pathname === "/checkin";

  if (isApiAuth || isDeviceApi || isCheckinPage) return NextResponse.next();

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
