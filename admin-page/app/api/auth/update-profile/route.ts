import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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

    return NextResponse.json({ status: "success", data: result.rows[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal memperbarui profil" }, { status: 500 });
  }
}
