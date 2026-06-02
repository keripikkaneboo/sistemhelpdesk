import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { generateEmbedding, knowledgeFields } from "@/lib/embedding";
import { getSession } from "@/lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const { intent, tipe_pengguna, tipe_layanan, unit_pengelola, kontak_referral,
            deskripsi, prosedur, syarat, estimasi_waktu, platform, pihak, catatan } =
      await request.json();

    if (!intent) {
      return NextResponse.json({ error: "Intent wajib diisi" }, { status: 400 });
    }

    const dup = await pool.query(
      `SELECT id FROM knowledge_base
       WHERE intent = $1 AND tipe_pengguna = $2 AND LOWER(tipe_layanan) = LOWER($3) AND id != $4`,
      [intent, tipe_pengguna, tipe_layanan ?? "LAA", id]
    );
    if (dup.rows.length > 0) {
      return NextResponse.json({ error: "Knowledge untuk layanan ini sudah ada" }, { status: 409 });
    }

    const embedding = await generateEmbedding(knowledgeFields({
      intent, tipe_pengguna, deskripsi, prosedur, syarat, estimasi_waktu, platform, pihak, catatan,
      unit_pengelola, kontak_referral,
    }));

    const result = await pool.query(
      `UPDATE knowledge_base
       SET intent=$1, tipe_pengguna=$2, tipe_layanan=$3, unit_pengelola=$4, kontak_referral=$5,
           deskripsi=$6, prosedur=$7, syarat=$8, estimasi_waktu=$9, platform=$10,
           pihak=$11, catatan=$12, updated_at=now(), embedding=$13::vector
       WHERE id=$14
       RETURNING id, intent, tipe_pengguna, tipe_layanan, unit_pengelola, kontak_referral,
                 deskripsi, prosedur, syarat, estimasi_waktu, platform, pihak, catatan, updated_at`,
      [intent, tipe_pengguna, tipe_layanan ?? "LAA", unit_pengelola, kontak_referral,
       deskripsi, prosedur, syarat, estimasi_waktu, platform, pihak, catatan,
       embedding ? JSON.stringify(embedding) : null, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Gagal mengupdate data", detail: msg }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const result = await pool.query("DELETE FROM knowledge_base WHERE id=$1", [id]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus data" }, { status: 500 });
  }
}
