# 💜 Kala Blast — Sistem Blast WhatsApp Undangan Digital

Multi-tenant WhatsApp blast platform dengan RBAC (Super Admin & Client). Kirim undangan pernikahan, ulang tahun, dll secara otomatis dengan delay anti-banned.

## 🏗️ Arsitektur

```
┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│  Vercel (Free)       │ ───► │  Render (Free)       │ ───► │  Supabase (Free) │
│  Next.js 15 App      │ HTTP │  Node.js + Baileys   │ SQL  │  Postgres + Auth │
└──────────────────────┘      └──────────────────────┘      └──────────────────┘
   frontend/                     backend/                       database
```

## 📁 Struktur

```
kala-blast/
├── frontend/          → Next.js (deploy ke Vercel)
├── backend/           → Node.js + Baileys (deploy ke Render)
├── README.md          → Panduan setup & deploy
└── SETUP_RBAC.md      → Setup user & role
```

## ✨ Fitur

- 🔐 RBAC: Super Admin & Client User dengan Supabase Auth
- 📱 Multi-akun WhatsApp (login via QR scan di browser)
- 📋 Multi-client per super admin
- 💬 Template pesan dengan variabel `{nama}`, `{link}`, `{nama_client}`
- 📅 Schedule blast otomatis (toggle per client)
- 📊 Real-time tracking (sent/failed/pending)
- ⏱ Anti-banned: random delay 5-15 detik, daily limit 300/akun
- 🗑 Auto-cleanup campaign > 30 hari
- 📱 Mobile responsive + PWA-ready

## 🚀 Quick Deploy

### Prasyarat
- Akun [Supabase](https://supabase.com) (free)
- Akun [Render](https://render.com) (free) — backend
- Akun [Vercel](https://vercel.com) (free) — frontend
- Akun [GitHub](https://github.com) (free) — repo
- Akun [cron-job.org](https://cron-job.org) (free, optional) — keep Render alive

### Step 1 — Setup Supabase

1. Login [Supabase](https://supabase.com), buat project baru (region Singapore)
2. **SQL Editor** → run [`backend/db/schema.sql`](backend/db/schema.sql)
3. **SQL Editor** → run [`backend/db/migration_rbac.sql`](backend/db/migration_rbac.sql)
4. **Authentication → Sign In / Providers**:
   - Pastikan Email Provider Enabled
   - Disable "Allow new users to sign up"
   - Disable "Confirm email"
5. **Settings → API Keys** → catat:
   - `Project URL`
   - `service_role` key (rahasia! jangan di frontend)

### Step 2 — Push ke GitHub

```bash
cd d:/blast-wa
git init
git add .
git commit -m "Initial commit: Kala Blast"
git branch -M main

# Buat repo PRIVAT di github.com/new dengan nama "kala-blast"
git remote add origin https://github.com/USERNAME/kala-blast.git
git push -u origin main
```

⚠️ **PRIVAT** wajib karena ada konfigurasi sensitif.

### Step 3 — Deploy Backend ke Render

1. Login [Render](https://render.com) → **New + → Web Service**
2. Connect GitHub → pilih repo `kala-blast`
3. Settings:
   - **Name:** `kala-blast-backend`
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. **Environment Variables** (klik "Advanced"):
   ```
   NODE_ENV=production
   SUPABASE_URL=<dari Supabase>
   SUPABASE_SERVICE_KEY=<service_role key>
   API_KEY=<random 64-char hex string, gunakan password generator>
   FRONTEND_URL=<isi setelah Vercel deploy, untuk sementara: *>
   MIN_DELAY_MS=5000
   MAX_DELAY_MS=15000
   DAILY_LIMIT_PER_SESSION=300
   CAMPAIGN_RETENTION_DAYS=30
   ```
5. Klik **Create Web Service**
6. Tunggu deploy ~3-5 menit
7. Catat URL: `https://kala-blast-backend-xxx.onrender.com`

### Step 4 — Deploy Frontend ke Vercel

1. Login [Vercel](https://vercel.com) → **Add New → Project**
2. Import repo `kala-blast` dari GitHub
3. Settings:
   - **Framework Preset:** Next.js (auto-detect)
   - **Root Directory:** `frontend`
4. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://kala-blast-backend-xxx.onrender.com
   ```
5. Klik **Deploy**
6. Tunggu ~2 menit
7. Catat URL: `https://kala-blast-xxx.vercel.app`

### Step 5 — Update CORS Backend

Kembali ke Render → backend service → **Environment** → edit `FRONTEND_URL`:
```
FRONTEND_URL=https://kala-blast-xxx.vercel.app
```
Simpan → service auto-restart.

### Step 6 — Seed Super Admin

Run di PowerShell (ganti `<PASSWORD_KUAT>` & URL):

```powershell
$body = @{
  email = "cskaladigital@gmail.com"
  password = "<PASSWORD_KUAT>"
  full_name = "Super Admin Kala"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://kala-blast-backend-xxx.onrender.com/api/auth/seed-admin" `
  -Method POST `
  -Headers @{
    "x-init-token" = "<API_KEY_yang_di_render>"
    "Content-Type" = "application/json"
  } `
  -Body $body
```

### Step 7 — Setup Keep-Alive (Render Free Tier)

Render free tier sleep setelah 15 menit idle. Setup ping otomatis:

1. [cron-job.org](https://cron-job.org) → Sign up free
2. **Create cronjob:**
   - URL: `https://kala-blast-backend-xxx.onrender.com/health`
   - Schedule: Every 10 minutes
   - Notifications: aktifkan "On failure" supaya Anda dapet email kalau backend down

### Step 8 — Login!

Buka `https://kala-blast-xxx.vercel.app/login` → masuk pakai email & password super admin.

## 🔄 Update Aplikasi (CI/CD)

Setiap kali Anda push ke `main`:
- Render auto-rebuild backend
- Vercel auto-rebuild frontend

Cukup:
```bash
git add .
git commit -m "feat: ..."
git push
```

## 📚 Dokumentasi Lain

- [SETUP_RBAC.md](SETUP_RBAC.md) — Detail setup auth & user management
- [backend/db/schema.sql](backend/db/schema.sql) — Schema database
- [backend/db/migration_rbac.sql](backend/db/migration_rbac.sql) — Migration RBAC

## 🆘 Troubleshooting

| Issue | Solusi |
|---|---|
| Login error "Email atau password salah" | Cek user di Supabase Auth, run seed-admin ulang |
| Session WA disconnect terus | Setup keep-alive ping cron-job.org |
| QR tidak muncul | Cek log Render untuk error Baileys |
| Pesan banyak failed | Cek format nomor di CSV, turunkan `DAILY_LIMIT_PER_SESSION` |
| Frontend "Internal Server Error" | Cek `NEXT_PUBLIC_API_URL` di Vercel sesuai URL Render |
| CORS error | Update `FRONTEND_URL` di Render env vars |

## ⚖️ Legal

WhatsApp tidak mengizinkan automation tools (Baileys/whatsapp-web.js) di Terms of Service. Risiko nomor di-banned ada. Untuk skala besar/kritikal, gunakan WhatsApp Business API resmi (Meta, Twilio, Wati, Wablas, Fonnte).

---
Made with 💜 for Kala Digital
