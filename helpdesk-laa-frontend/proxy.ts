import { NextRequest, NextResponse } from "next/server";
import { verifyToken, cookieName } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

// Login & reset password: backstop per-IP. Cek per-akun (lebih ketat) dilakukan di route handler.
const loginLimiterIP = rateLimit({ interval: 60 * 60_000, limit: 120 });
const resetLimiterIP = rateLimit({ interval: 60 * 60_000, limit: 100 });
// Guest chat: backstop per-IP. Cek per-guest-id (lebih ketat) dilakukan di route handler.
const guestChatLimiterIP = rateLimit({ interval: 60 * 60_000, limit: 250 });
// General API: per-user (nim_nip dari sesi JWT) untuk yang sudah login, fallback per-IP untuk yang belum.
const generalUserLimiter = rateLimit({ interval: 60_000, limit: 60 });
const generalIPLimiter = rateLimit({ interval: 60_000, limit: 60 });

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getIP(request);

  // ── Rate limiting pada semua API route ──
  if (pathname.startsWith("/api/")) {
    let allowed = true;
    if (pathname === "/api/auth/login") {
      allowed = loginLimiterIP.check(ip);
    } else if (pathname === "/api/auth/reset-password") {
      allowed = resetLimiterIP.check(ip);
    } else if (pathname === "/api/guest/chat-bot") {
      allowed = guestChatLimiterIP.check(ip);
    } else {
      const token = request.cookies.get(cookieName())?.value;
      const session = token ? await verifyToken(token) : null;
      allowed = session?.nim_nip
        ? generalUserLimiter.check(session.nim_nip)
        : generalIPLimiter.check(ip);
    }
    if (!allowed) {
      const isGuestChat = pathname === "/api/guest/chat-bot";
      return NextResponse.json(
        {
          status: "error",
          message: isGuestChat
            ? "Terlalu banyak permintaan dari jaringan ini. Coba lagi nanti."
            : "Terlalu banyak permintaan. Coba lagi sebentar lagi.",
        },
        {
          status: 429,
          headers:
            pathname === "/api/auth/login"
              ? { "Retry-After": "900" }
              : pathname === "/api/auth/reset-password" || isGuestChat
                ? { "Retry-After": "3600" }
                : {},
        },
      );
    }
  }

  // ── Proteksi /dashboard — redirect ke / jika tidak terautentikasi ──
  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get(cookieName())?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    const session = await verifyToken(token);
    if (!session) {
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.set(cookieName(), "", { maxAge: 0, path: "/" });
      return response;
    }
  }

  // ── Jika sudah login dan akses / → redirect ke /dashboard/chat ──
  // Pengecualian: jika ada ?token= di URL (link reset password), jangan redirect
  if (pathname === "/" && !request.nextUrl.searchParams.has("token")) {
    const token = request.cookies.get(cookieName())?.value;
    if (token) {
      const session = await verifyToken(token);
      if (session) {
        return NextResponse.redirect(new URL("/dashboard/chat", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/api/:path*"],
};
