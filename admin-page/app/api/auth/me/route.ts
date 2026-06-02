import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verifikasi session masih aktif (single-session enforcement)
  const sessionCheck = await pool.query(
    "SELECT session_id FROM user_admin WHERE nip = $1",
    [session.nim_nip],
  );
  if (!sessionCheck.rows[0] || sessionCheck.rows[0].session_id !== session.session_id) {
    return NextResponse.json({ error: "Session invalidated" }, { status: 401 });
  }

  const admin = await pool.query(
    "SELECT id, nama, nip FROM user_admin WHERE id = $1",
    [session.id]
  );
  if (!admin.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: admin.rows[0].id,
    nama: admin.rows[0].nama,
    nim_nip: admin.rows[0].nip,
    role: session.role,
  });
}
