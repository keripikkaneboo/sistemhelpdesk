import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await pool.query(
      `SELECT
          t.*,
          l.nama_layanan,
          COALESCE((
            SELECT COUNT(*)::int
            FROM ticket_messages
            WHERE ticket_id = t.id
              AND sender_type = 'admin'
              AND is_read = false
          ), 0) AS unread_count
       FROM tickets t
       LEFT JOIN layanan_master l ON t.layanan_id = l.id
       WHERE t.nim = $1
       ORDER BY t.created_at DESC`,
      [session.nim_nip],
    );

    return NextResponse.json({ status: "success", data: result.rows });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal mengambil data tiket" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const { id, subject, description, status, layanan_id } =
      await request.json();

    if (!id || !subject) {
      return NextResponse.json(
        { status: "error", message: "Data tidak lengkap" },
        { status: 400 },
      );
    }

    await pool.query(
      `INSERT INTO tickets (id, nim, nama, subject, description, status, layanan_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, session.nim_nip, session.nama, subject, description, status, layanan_id || null],
    );

    return NextResponse.json({
      status: "success",
      message: "Tiket berhasil dibuat",
    });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal membuat tiket" },
      { status: 500 },
    );
  }
}
