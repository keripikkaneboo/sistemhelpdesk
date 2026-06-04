import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

const guestLimiter = rateLimit({ interval: 60 * 60_000, limit: 10 });

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

export async function POST(request: NextRequest) {
  const ip = getIP(request);
  if (!guestLimiter.check(ip)) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "Batas 10 pesan per jam untuk pengguna tamu telah tercapai. Silakan login untuk pesan tidak terbatas.",
      },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const { query, history } = await request.json();

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const response = await fetch(`${backendUrl}/api/chat-bot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        user_mode: "Mahasiswa",
        history: history ?? [],
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("ERROR AT GUEST CHAT-BOT:", error);
    return NextResponse.json(
      { output: "Terjadi kesalahan jaringan. Silakan coba lagi.", suggest_ticket: false },
      { status: 500 },
    );
  }
}
