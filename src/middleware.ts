import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes
  const publicRoutes = ["/login", "/register"];
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route));
  const isAuthApi = pathname.startsWith("/api/auth");
  const isXtreamApi = pathname.startsWith("/api/xtream")
    || pathname === "/player_api.php"
    || pathname === "/get.php"
    || pathname.startsWith("/live/")
    || pathname.startsWith("/movie/")
    || pathname.startsWith("/series/");

  if (isPublic || isAuthApi || isXtreamApi) {
    return NextResponse.next();
  }

  // Check JWT token (doesn't import Prisma or bcryptjs)
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  if (!token) {
    // API routes: return 401 instead of redirect (for HLS.js, fetch, etc.)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes protection
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/browse", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|fonts).*)",
  ],
};
