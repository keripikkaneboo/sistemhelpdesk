import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // kode_dosen tidak ada di JWT — ambil dari DB hanya untuk user Dosen
  let kodeDosen: string | null = null;
  if (session.role === "Dosen") {
    try {
      const res = await pool.query(
        "SELECT kode_dosen FROM users WHERE nim_nip = $1",
        [session.nim_nip],
      );
      kodeDosen = res.rows[0]?.kode_dosen ?? null;
    } catch { /* noop */ }
  }

  return NextResponse.json({
    nim_nip: session.nim_nip,
    nama: session.nama,
    email: session.email,
    role: session.role,
    prodi: session.prodi ?? null,
    kelas: session.kelas ?? null,
    kode_dosen: kodeDosen,
  });
}
