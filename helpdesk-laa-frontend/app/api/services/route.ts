// File: app/api/services/route.ts
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role"); // Mengambil role user dari frontend (Mahasiswa/Dosen)

  try {
    let query = `SELECT MIN(id) AS id, intent AS nama_layanan, tipe_pengguna
                 FROM knowledge_base
                 WHERE tipe_layanan = 'LAA'`;
    const params: string[] = [];

    if (role) {
      query += " AND LOWER(tipe_pengguna) = LOWER($1)";
      params.push(role);
    }

    query += " GROUP BY intent, tipe_pengguna ORDER BY intent ASC";

    const result = await pool.query(query, params);
    return NextResponse.json({ status: "success", data: result.rows });
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal mengambil data layanan" },
      { status: 500 },
    );
  }
}
