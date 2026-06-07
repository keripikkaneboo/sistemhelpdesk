import { NextResponse } from "next/server";
import { getSession, signToken, cookieName, cookieOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { nama, nip } = await request.json();
    if (!nama?.trim() || !nip?.trim())
      return NextResponse.json({ error: "Nama dan NIP wajib diisi" }, { status: 400 });

    const result = await pool.query(
      "UPDATE user_admin SET nama=$1, nip=$2, updated_at=NOW() WHERE id=$3 RETURNING id, nama, nip",
      [nama.trim(), nip.trim(), session.id]
    );
    if (result.rowCount === 0)
      return NextResponse.json({ error: "Admin tidak ditemukan" }, { status: 404 });

    const updated = result.rows[0];

    // Re-issue session cookie with the updated nama/nip so /api/auth/me's
    // session-validation lookup (WHERE nip = <token's nim_nip>) keeps matching
    // the DB row — otherwise changing the NIP would force an immediate logout.
    const token = await signToken({
      id: updated.id,
      nama: updated.nama,
      nim_nip: updated.nip,
      role: session.role,
      session_id: session.session_id,
    });

    const response = NextResponse.json({ status: "success", data: updated });
    response.cookies.set(cookieName(), token, cookieOptions());
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal memperbarui profil" }, { status: 500 });
  }
}
