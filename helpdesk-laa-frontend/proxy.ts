import { NextRequest, NextResponse } from "next/server";
import { verifyToken, cookieName } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

const loginLimiter = rateLimit({ interval: 15 * 60_000, limit: 10 });
const resetLimiter = rateLimit({ interval: 60 * 60_000, limit: 5 });
const guestChatLimiter = rateLimit({ interval: 60 * 60_000, limit: 10 });
const generalLimiter = rateLimit({ interval: 60_000, limit: 60 });

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
      allowed = loginLimiter.check(ip);
    } else if (pathname === "/api/auth/reset-password") {
      allowed = resetLimiter.check(ip);
    } else if (pathname === "/api/guest/chat-bot") {
      allowed = guestChatLimiter.check(ip);
    } else {
      allowed = generalLimiter.check(ip);
    }
    if (!allowed) {
      const isGuestChat = pathname === "/api/guest/chat-bot";
      return NextResponse.json(
        {
          status: "error",
          message: isGuestChat
            ? "Batas 10 pesan per jam untuk pengguna tamu telah tercapai. Silakan login untuk pesan tidak terbatas."
            : "Terlalu banyak permintaan. Coba lagi sebentar lagi.",
        },
        {
          status: 429,
          headers: pathname === "/api/auth/login" ? { "Retry-After": "900" } : isGuestChat ? { "Retry-After": "3600" } : {},
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
