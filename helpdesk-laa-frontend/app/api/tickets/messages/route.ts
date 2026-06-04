import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

async function verifyTicketOwnership(ticketId: string, nimNip: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT id FROM tickets WHERE id = $1 AND nim = $2",
    [ticketId, nimNip],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get("ticketId");

  if (!ticketId) {
    return NextResponse.json(
      { status: "error", message: "ID Tiket diperlukan" },
      { status: 400 },
    );
  }

  const isOwner = await verifyTicketOwnership(ticketId, session.nim_nip);
  if (!isOwner) {
    return NextResponse.json(
      { status: "error", message: "Akses ditolak" },
      { status: 403 },
    );
  }

  try {
    const result = await pool.query(
      "SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC",
      [ticketId],
    );

    // Tandai pesan admin sebagai sudah dibaca (fire-and-forget)
    pool.query(
      `UPDATE ticket_messages
       SET is_read = true
       WHERE ticket_id = $1 AND sender_type = 'admin' AND is_read = false`,
      [ticketId],
    ).catch(() => {});

    return NextResponse.json({ status: "success", data: result.rows });
  } catch (error) {
    console.error("Error fetching ticket messages:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal mengambil pesan" },
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
    const { ticket_id, message } = await request.json();

    if (!ticket_id || !message) {
      return NextResponse.json(
        { status: "error", message: "Data tidak lengkap" },
        { status: 400 },
      );
    }

    const isOwner = await verifyTicketOwnership(ticket_id, session.nim_nip);
    if (!isOwner) {
      return NextResponse.json(
        { status: "error", message: "Akses ditolak" },
        { status: 403 },
      );
    }

    const result = await pool.query(
      `INSERT INTO ticket_messages
      (ticket_id, sender_type, sender_name, message, is_read, created_at)
      VALUES ($1, 'user', $2, $3, false, NOW()) RETURNING *`,
      [ticket_id, session.nama, message],
    );

    return NextResponse.json({ status: "success", data: result.rows[0] });
  } catch (error) {
    console.error("Error inserting ticket message:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal mengirim pesan" },
      { status: 500 },
    );
  }
}
