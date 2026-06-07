import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const result = await pool.query(
      `SELECT t.id, t.nim, t.nama, t.subject, t.description, t.status, t.date, t.created_at,
              t.handled_by, ua.nama AS handled_by_name
       FROM tickets t
       LEFT JOIN user_admin ua ON ua.id::text = t.handled_by
       WHERE t.id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("[GET ticket]", err);
    return NextResponse.json({ error: "Gagal mengambil data tiket" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const check = await pool.query(`SELECT handled_by FROM tickets WHERE id = $1`, [id]);
    if (check.rowCount === 0) {
      return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });
    }
    const currentHandler = check.rows[0].handled_by;
    const adminId = String(session.id);
    if (currentHandler && currentHandler !== adminId) {
      return NextResponse.json({ error: "Tiket ini sedang ditangani oleh admin lain" }, { status: 403 });
    }

    const { status, handled_by } = await request.json();
    if (!status) {
      return NextResponse.json({ error: "Status wajib diisi" }, { status: 400 });
    }
    const statusMap: Record<string, string> = {
      open: "Open", menunggu: "Open",
      "in progress": "In Progress", diproses: "In Progress",
      closed: "Closed", selesai: "Closed", done: "Closed",
    };
    const dbStatus = statusMap[status.toLowerCase()] ?? status;
    // Set handled_by saat status berubah ke In Progress atau Closed
    const setHandledBy = (dbStatus === "In Progress" || dbStatus === "Closed") && handled_by;
    const result = await pool.query(
      `UPDATE tickets
       SET status = $1, updated_at = NOW()
         ${setHandledBy ? ", handled_by = $3" : ""}
       WHERE id = $2
       RETURNING id, nim, nama, subject, description, status, date, created_at, handled_by`,
      setHandledBy ? [dbStatus, id, adminId] : [dbStatus, id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("[PATCH ticket]", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Gagal memperbarui status", detail }, { status: 500 });
  }
}
