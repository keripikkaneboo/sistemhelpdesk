import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  try {
    let query = `SELECT id, nama_layanan, tipe_pengguna FROM layanan_master`;
    const params: string[] = [];

    if (role) {
      query += " WHERE LOWER(tipe_pengguna) = LOWER($1)";
      params.push(role);
    }

    query += " ORDER BY nama_layanan ASC";

    const result = await pool.query(query, params);
    return NextResponse.json({ status: "success", data: result.rows });
  } catch (error) {
    console.error("Error fetching layanan master:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal mengambil data layanan" },
      { status: 500 },
    );
  }
}
