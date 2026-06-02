import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { newPassword } = await request.json();
    if (!newPassword || newPassword.length < 6)
      return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400 });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE user_admin SET password=$1, updated_at=NOW() WHERE id=$2",
      [hashed, session.id]
    );
    return NextResponse.json({ status: "success" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengubah password" }, { status: 500 });
  }
}
