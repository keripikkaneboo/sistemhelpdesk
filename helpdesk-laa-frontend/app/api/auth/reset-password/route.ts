import { NextResponse } from "next/server";
import pool from "@/lib/db";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { rateLimit } from "@/lib/rateLimit";

// Per-akun (NIM/NIP): 5x / jam
const resetLimiter = rateLimit({ interval: 60 * 60_000, limit: 5 });

export async function POST(request: Request) {
  try {
    const { nimNip } = await request.json(); // Sekarang hanya butuh NIM/NIP

    if (!nimNip) {
      return NextResponse.json(
        { status: "error", message: "NIM/NIP wajib diisi" },
        { status: 400 },
      );
    }

    if (!resetLimiter.check(String(nimNip).trim())) {
      return NextResponse.json(
        {
          status: "error",
          message: "Terlalu banyak permintaan reset password untuk akun ini. Coba lagi dalam 1 jam.",
        },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }

    // 1. Cari user dan emailnya di database
    const userResult = await pool.query(
      "SELECT email FROM users WHERE nim_nip = $1",
      [nimNip],
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json(
        { status: "error", message: "NIM/NIP tidak terdaftar." },
        { status: 404 },
      );
    }

    const userEmail = userResult.rows[0].email;

    if (!userEmail) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Anda belum memiliki email terdaftar. Silakan gunakan NIM/NIP sebagai username dan password untuk login",
        },
        { status: 400 },
      );
    }

    // 2. Buat Token Rahasia
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000); // Hangus dalam 1 jam

    // 3. Simpan token ke tabel password_resets
    await pool.query(
      "INSERT INTO password_resets (nim_nip, token, expires_at) VALUES ($1, $2, $3)",
      [nimNip, token, expires],
    );

    // 4. Konfigurasi Email (Nodemailer)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/?token=${token}`;

    await transporter.sendMail({
      from: '"Helpdesk LAA FTE" <no-reply@telkomuniversity.ac.id>',
      to: userEmail,
      subject: "Konfirmasi Perubahan Password",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Halo, Mahasiswa/Dosen FTE</h2>
          <p>Kami menerima permintaan reset password untuk akun dengan NIM/NIP: <b>${nimNip}</b>.</p>
          <p>Silakan klik tombol di bawah ini untuk mengatur ulang password Anda:</p>
          <a href="${resetUrl}" style="background: #b91c1c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Ubah Password Sekarang</a>
          <p>Link ini akan kedaluwarsa dalam 1 jam.</p>
          <hr>
          <p style="font-size: 12px; color: #666;">Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini.</p>
        </div>
      `,
    });

    return NextResponse.json({
      status: "success",
      message: "Email berhasil dikirim",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { status: "error", message: "Gagal memproses permintaan" },
      { status: 500 },
    );
  }
}
