# Sistem Helpdesk Chatbot LAA — FTE Telkom University

Sistem Layanan Helpdesk Akademik berbasis Chatbot yang dikembangkan sebagai proyek **Tugas Akhir** untuk Layanan Administrasi Akademik (LAA), Fakultas Teknik Elektro (FTE), Telkom University.

Sistem ini menyediakan layanan tanya-jawab otomatis (chatbot AI berbasis RAG) seputar layanan akademik bagi mahasiswa, orang tua mahasiswa, dan dosen, lengkap dengan sistem tiket untuk eskalasi ke admin LAA serta panel administrasi untuk mengelola tiket, knowledge base, dan data pengguna.

## Arsitektur Sistem

Repo ini adalah **monorepo** yang terdiri dari tiga aplikasi independen yang berbagi satu basis data PostgreSQL:

```
                ┌───────────────────────┐
                │  helpdesk-laa-frontend │  (Next.js — User App)
                │  Mahasiswa / Ortu /     │
                │  Dosen                  │
                └───────────┬────────────┘
                            │
┌───────────────────────┐   │   ┌──────────────────────────┐
│      admin-page        │──┼──▶│   PostgreSQL + pgvector   │
│  (Next.js — Admin)     │   │   │   (Hostinger VPS)         │
└───────────────────────┘   │   └────────────┬─────────────┘
                            │                │
                            ▼                ▼
                  ┌───────────────────────────────┐
                  │       backend_chatbot          │
                  │  (FastAPI — RAG Engine)        │
                  │  Ollama (gemma3 + nomic-embed) │
                  └────────────────────────────────┘
```

- **`helpdesk-laa-frontend/`** — Aplikasi Next.js yang diakses oleh mahasiswa, orang tua mahasiswa, dan dosen: login, chatbot, riwayat chat, tiket, akun.
- **`admin-page/`** — Aplikasi Next.js terpisah khusus admin LAA: dashboard tiket, manajemen knowledge base, manajemen user.
- **`backend_chatbot/`** — Service FastAPI (Python) yang menjalankan pipeline RAG: embedding pertanyaan, pencarian kemiripan vektor (pgvector) ke knowledge base, lalu menghasilkan jawaban via Ollama.
- Ketiga aplikasi mengakses **PostgreSQL** yang sama (di-host di Hostinger VPS) sebagai sumber data tunggal (users, tickets, knowledge base, chat history).

## Fitur Utama

**Untuk Mahasiswa, Orang Tua, dan Dosen (`helpdesk-laa-frontend`)**
- Login dengan NIM (mahasiswa/orang tua) atau NIP (dosen), serta mode tamu (guest) tanpa login
- Chatbot AI yang menjawab pertanyaan seputar layanan akademik berbasis RAG (retrieval dari knowledge base)
- Penjelasan alur layanan dan tautan pendukung terkait
- Riwayat percakapan dengan chatbot
- Pembuatan dan pemantauan tiket layanan (status: Open → In Progress → Closed)
- Chat dua arah dengan admin pada tiket yang dibuat, lengkap notifikasi pesan belum dibaca
- Pengelolaan akun: ubah profil, reset password via token email

**Untuk Admin LAA (`admin-page`)**
- Login khusus admin (NIP/email + password)
- Dashboard tiket dengan ringkasan KPI (total, open, in progress, closed)
- Membalas dan menutup tiket pengguna
- Manajemen knowledge base layanan (CRUD, dengan auto-generate embedding)
- Manajemen data dosen
- Manajemen data pengguna (mahasiswa, dosen, admin)

## Tech Stack

| Komponen | Teknologi |
|---|---|
| Frontend (User App) | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Anime.js |
| Admin Panel | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend Chatbot | Python, FastAPI, Uvicorn |
| AI / RAG | Ollama (`gemma3:12b` untuk generasi jawaban, `nomic-embed-text` untuk embedding 768 dimensi), PySastrawi (stemming Bahasa Indonesia) |
| Database | PostgreSQL 16 + ekstensi pgvector |
| Autentikasi | JWT (`jose`) + httpOnly cookie, hashing password dengan `bcryptjs` |
| Email | Nodemailer (reset password) |
| Deployment | Vercel (frontend & admin, via GitHub Actions), Hostinger VPS (backend & database, via Nginx + systemd) |

## Struktur Folder

```
sistemhelpdesk/
├── helpdesk-laa-frontend/   # Next.js — aplikasi user (mahasiswa/ortu/dosen)
│   ├── app/                 # Routes & API routes (app/api/**)
│   ├── components/          # Komponen React
│   └── lib/                 # Auth, koneksi DB, rate limiting, dsb.
├── admin-page/              # Next.js — panel admin LAA
│   ├── app/                 # Routes & API routes (app/api/**)
│   ├── components/
│   └── lib/
├── backend_chatbot/         # FastAPI — engine RAG chatbot
│   └── api_chatbot.py       # Endpoint inferensi, embedding, retrieval
├── deployment/              # Skrip & konfigurasi deployment VPS
│   ├── setup-vps.sh         # Setup PostgreSQL, pgvector, Nginx, fail2ban
│   ├── helpdesk-api.service # Unit systemd untuk backend FastAPI
│   └── nginx-helpdesk-api.conf
├── .github/workflows/       # CI/CD (deploy otomatis ke Vercel)
└── requirements.txt         # Dependencies Python (backend_chatbot)
```

## Prasyarat

- **Node.js** 18.18+ atau 20 LTS
- **Python** 3.12
- **PostgreSQL** 16 dengan ekstensi **pgvector** terpasang
- **Ollama** (lokal atau cloud) dengan model `gemma3:12b` dan `nomic-embed-text` terunduh

## Cara Menjalankan (Development)

### 1. Siapkan Database

Pastikan PostgreSQL berjalan dan ekstensi `pgvector` sudah diaktifkan pada database yang akan digunakan (lihat `deployment/setup-vps.sh` sebagai referensi setup).

### 2. Konfigurasi Environment Variables

Setiap aplikasi memiliki contoh konfigurasi di file `.env.production.example`. Salin menjadi `.env` lalu isi sesuai environment masing-masing — **jangan commit file `.env` berisi kredensial asli**.

- `helpdesk-laa-frontend/.env`: `DATABASE_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`, `JWT_SECRET`, `EMAIL_USER`, `EMAIL_PASS`
- `admin-page/.env`: variabel sejenis (koneksi database, `JWT_SECRET`)
- `backend_chatbot/.env`: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_PORT`, `CORS_ORIGINS`, `FRONTEND_URL`

### 3. Jalankan Frontend (User App)

```bash
cd helpdesk-laa-frontend
npm install
npm run dev
```

### 4. Jalankan Admin Panel

```bash
cd admin-page
npm install
npm run dev
```

### 5. Jalankan Backend Chatbot

```bash
cd backend_chatbot
pip install -r ../requirements.txt
uvicorn api_chatbot:app --reload
```

Pastikan Ollama sudah berjalan dan dapat diakses oleh `backend_chatbot` (default `http://127.0.0.1:11434`) sebelum menguji fitur chatbot.
