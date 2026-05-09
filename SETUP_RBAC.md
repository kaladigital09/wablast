# Setup RBAC (Authentication & Roles) — Kala Blast

Sistem sudah punya 2 role:
- **super_admin** (Anda) — akses semua client, semua data
- **client_user** — hanya akses data client mereka sendiri

## Langkah Setup

### 1. Jalankan Migration SQL

Buka **Supabase Dashboard → SQL Editor** → paste isi file
[`backend/db/migration_rbac.sql`](backend/db/migration_rbac.sql) → **Run**.

Ini akan:
- Buat tabel `user_profiles` (link auth user ke role + client)
- Tambah kolom `schedule_enabled`, `contact_email`, `owner_user_id` di tabel `clients`
- Setup view `clients_with_user` untuk admin dashboard

### 2. Aktifkan Email Auth di Supabase

1. Supabase Dashboard → **Authentication** → **Providers**
2. Pastikan **Email** provider sudah enabled
3. (Opsional) Disable **"Confirm email"** kalau ingin user tidak perlu verifikasi email

### 3. Restart Backend

Backend sudah otomatis restart pakai `node --watch`, tapi pastikan dependencies up-to-date:

```bash
cd backend
npm install
```

### 4. Buat Super Admin (Anda)

Backend menyediakan endpoint khusus `POST /api/auth/seed-admin` untuk seed pertama kali.
Gunakan API_KEY yang ada di `.env` sebagai header `x-init-token`.

**Via PowerShell:**

```powershell
$body = @{
  email = "cskaladigital@gmail.com"
  password = "GANTI_PASSWORD_KUAT_DI_SINI"
  full_name = "Super Admin Kala"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/auth/seed-admin" `
  -Method POST `
  -Headers @{
    "x-init-token" = "423b32c2b41dc4f5817aa8e8eafdff02f73bf4abf4fe127c2e37803d92e2b859"
    "Content-Type" = "application/json"
  } `
  -Body $body
```

**Atau via curl (Bash/WSL):**

```bash
curl -X POST http://localhost:3001/api/auth/seed-admin \
  -H "x-init-token: 423b32c2b41dc4f5817aa8e8eafdff02f73bf4abf4fe127c2e37803d92e2b859" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cskaladigital@gmail.com",
    "password": "GANTI_PASSWORD_KUAT_DI_SINI",
    "full_name": "Super Admin Kala"
  }'
```

✅ Response sukses:
```json
{ "ok": true, "user_id": "...", "email": "cskaladigital@gmail.com" }
```

⚠ **Penting:**
- Endpoint ini **hanya bisa jalan sekali** — kalau super admin sudah ada, akan return error
- Pakai password yang kuat (min 8 karakter, kombinasi huruf & angka)

### 5. Migrasi Data Existing (Opsional)

Kalau Anda sudah punya data clients/sessions/campaigns sebelum RBAC ini:
- Data tetap aman (tidak terhapus)
- Tapi **tidak ada owner_user_id** — super admin tetap bisa akses semua data
- Untuk assign client existing ke user login baru, cukup buat client baru via UI atau update lewat SQL:

```sql
-- Contoh assign client existing ke user (manual)
update clients
set contact_email = 'andi@example.com'
where name = 'Andi & Sari';
```

Lalu di UI, klik **🔑 Reset Password** di card client untuk dapat password baru, dan client bisa login.

### 6. Login!

Buka http://localhost:3000/login → masukkan email & password super admin → akses semua fitur.

## Cara Buat Akun Login untuk Client

1. Login sebagai super admin
2. Menu **Clients** → klik **+ Tambah Client**
3. Isi data client (nama, event, dll)
4. Centang ✓ **"Buatkan akun login untuk client"**
5. Isi **email** client (mereka akan pakai untuk login)
6. (Opsional) Centang **"Izinkan fitur scheduler"** kalau client boleh atur jadwal otomatis
7. Klik **Simpan Client**
8. Modal akan muncul menampilkan **email + password** yang di-generate otomatis
9. **COPY & SHARE** ke client via WhatsApp/email — password tidak akan muncul lagi
10. Kalau lupa, klik tombol **🔑** di card client untuk reset password

## Apa yang Bisa Dilakukan Client User?

| Fitur | Client User | Super Admin |
|---|---|---|
| Lihat data client mereka | ✓ | ✓ (semua) |
| Edit info client (nama, tanggal) | ✓ | ✓ |
| Tambah & scan QR akun WA | ✓ | ✓ |
| Buat campaign | ✓ | ✓ |
| Upload CSV & blast | ✓ | ✓ |
| Lihat tracking pengiriman | ✓ | ✓ |
| Pakai fitur scheduler | ✓ (kalau diaktifkan admin) | ✓ |
| Hapus client | ✗ | ✓ |
| Manage email/password client | ✗ | ✓ |
| Lihat data client lain | ✗ | ✓ |

## Troubleshooting

**Error "Invalid login credentials"**
- Pastikan email & password benar
- Cek di Supabase Dashboard → **Authentication → Users** apakah user ada

**Error "User belum punya profile/role"**
- User di Supabase Auth ada, tapi belum ada di tabel `user_profiles`
- Jalankan migration_rbac.sql ulang, atau insert manual di SQL editor

**Client user bisa lihat data client lain**
- Tidak mungkin (sudah di-scope di backend), tapi kalau terjadi:
- Cek `req.user.client_id` di backend log saat user request
- Pastikan `user_profiles.client_id` benar
