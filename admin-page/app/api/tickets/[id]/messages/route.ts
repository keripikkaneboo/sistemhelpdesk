import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

async function getHandledBy(ticketId: string): Promise<string | null | undefined> {
  const res = await pool.query(`SELECT handled_by FROM tickets WHERE id = $1`, [ticketId]);
  if (res.rowCount === 0) return undefined;
  return res.rows[0].handled_by;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentHandler = await getHandledBy(id);

    const result = await pool.query(
      `SELECT id, ticket_id, sender_type, sender_name, message, created_at
       FROM ticket_messages
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    // Tandai pesan user sebagai sudah dibaca — hanya jika viewer adalah admin
    // penanggung jawab (atau tiket belum ditangani siapa pun), agar admin lain
    // yang membuka tiket dalam mode lihat-saja tidak menghapus badge unread
    // milik admin yang sebenarnya menangani.
    if (!currentHandler || currentHandler === String(session.id)) {
      await Promise.all([
        pool.query(
          `UPDATE ticket_messages
           SET is_read = true
           WHERE ticket_id = $1 AND sender_type = 'user' AND is_read = false`,
          [id]
        ),
        pool.query(
          `UPDATE tickets SET is_read = true WHERE id = $1 AND is_read = false`,
          [id]
        ),
      ]).catch(() => {});
    }

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("[GET messages]", err);
    return NextResponse.json({ error: "Gagal mengambil pesan" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentHandler = await getHandledBy(id);
    if (currentHandler && currentHandler !== String(session.id)) {
      return NextResponse.json({ error: "Tiket ini sedang ditangani oleh admin lain" }, { status: 403 });
    }

    const { message, sender_name, sender_type } = await request.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
    }

    const type: "admin" | "user" = sender_type === "user" ? "user" : "admin";
    const name = sender_name ?? (type === "admin" ? "Admin" : "User");
    const adminId = String(session.id);

    // INSERT pesan (query kritis)
    const result = await pool.query(
      `INSERT INTO ticket_messages (ticket_id, sender_type, sender_name, message, is_read)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, ticket_id, sender_type, sender_name, message, created_at`,
      [id, type, name, message.trim()]
    );

    // Satu query: update updated_at, isi handled_by jika kosong, ubah status jika masih open
    let new_status: string | null = null;
    let new_handled_by: string | null = null;
    if (type === "admin") {
      const updateResult = await pool.query(
        `UPDATE tickets
         SET updated_at  = NOW(),
             handled_by  = COALESCE(handled_by, $2),
             status      = CASE WHEN LOWER(status) = 'open' THEN 'In Progress' ELSE status END
         WHERE id = $1
         RETURNING status, handled_by`,
        [id, adminId]
      );
      if ((updateResult.rowCount ?? 0) > 0) {
        const row = updateResult.rows[0];
        new_status     = row.status === "In Progress" ? row.status : null;
        new_handled_by = row.handled_by;
      }
    }

    return NextResponse.json({ ...result.rows[0], new_status, new_handled_by }, { status: 201 });
  } catch (err) {
    console.error("[POST messages]", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Gagal mengirim pesan", detail }, { status: 500 });
  }
}
