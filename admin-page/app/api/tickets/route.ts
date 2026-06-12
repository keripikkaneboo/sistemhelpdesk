import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await pool.query(
      `SELECT
         t.id, t.nim, t.nama, t.subject, t.description, t.status, t.date,
         t.created_at, t.updated_at, t.handled_by, ua.nama AS handled_by_name, t.layanan_id,
         lm.nama_layanan,
         COALESCE((
           SELECT COUNT(*)::int
           FROM ticket_messages
           WHERE ticket_id = t.id
             AND sender_type = 'user'
             AND is_read = false
         ), 0)
         + CASE
             WHEN LOWER(t.status) = 'open'
               AND NOT EXISTS (
                 SELECT 1 FROM ticket_messages
                 WHERE ticket_id = t.id AND sender_type = 'user'
               )
               AND t.is_read = false
             THEN 1
             ELSE 0
           END
         AS unread_count
       FROM tickets t
       LEFT JOIN layanan_master lm ON lm.id = t.layanan_id
       LEFT JOIN user_admin ua ON ua.id::text = t.handled_by
       ORDER BY COALESCE(t.updated_at, t.created_at) DESC`
    );
    return NextResponse.json(result.rows);
  } catch {
    try {
      const result = await pool.query(
        `SELECT t.id, t.nim, t.nama, t.subject, t.description, t.status, t.date,
                t.created_at, t.layanan_id, lm.nama_layanan,
                t.handled_by, ua.nama AS handled_by_name,
                CASE WHEN LOWER(t.status) = 'open' AND t.is_read = false THEN 1 ELSE 0 END AS unread_count
         FROM tickets t
         LEFT JOIN layanan_master lm ON lm.id = t.layanan_id
         LEFT JOIN user_admin ua ON ua.id::text = t.handled_by
         ORDER BY t.created_at DESC`
      );
      return NextResponse.json(result.rows);
    } catch (err) {
      console.error(err);
      return NextResponse.json({ error: "Gagal mengambil data tiket" }, { status: 500 });
    }
  }
}
