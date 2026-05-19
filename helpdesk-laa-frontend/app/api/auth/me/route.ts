import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    nim_nip: session.nim_nip,
    nama: session.nama,
    email: session.email,
    role: session.role,
  });
}
