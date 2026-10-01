# Kalkulator HPP Kuliner

Aplikasi Next.js dengan backend PostgreSQL berdasarkan [PRD.md](./PRD.md). Frontend tidak lagi menggunakan localStorage sebagai penyimpanan perhitungan. Akun dibuat dari pembelian yang tervalidasi; pendaftaran umum tidak tersedia.

## Fitur yang tersedia

- Better Auth: login, logout, aktivasi sekali pakai 24 jam, reset 60 menit, perubahan password dan pencabutan sesi.
- Akun dan grant terpisah, pemeriksaan akses aktif serta pemilik pada setiap API perhitungan/report/ekspor.
- Draft otomatis setelah 2 detik, optimistic locking antar-tab, finalisasi idempoten, revisi final immutable di database.
- Mesin HPP decimal berpresisi 60 digit, pajak inclusive/exclusive, report dari snapshot server, PDF A4 dan Excel enam sheet.
- Webhook HMAC dengan batas body, pemeriksaan waktu, inbox durable, dedup, purchase state_version, tombstone refund, dan tinjauan refund sebagian/perubahan email.
- Worker webhook/email dengan locking, retry eksponensial, heartbeat, dan pembersihan payload token yang selesai/kedaluwarsa.
- Admin di /admin/access dan /admin/integrations: pencarian akun, cabut/pulihkan grant dengan alasan, kirim ulang aktivasi, pantau dan retry job gagal. Admin tidak dapat melihat resep milik pembeli melalui panel ini.

## Persiapan lokal

Gunakan Node.js 22 LTS dan PostgreSQL 16 atau lebih baru. Pengujian database dilakukan pada PostgreSQL 16.15.

1. Jalankan npm install.
2. Buat database dan role PostgreSQL khusus aplikasi, bukan database proyek lain.
3. Salin .env.example menjadi .env.local. Isi DATABASE_URL dan APP_BASE_URL sesuai lingkungan.
4. Buat dua secret acak yang berbeda (misalnya openssl rand -hex 32) untuk AUTH_SECRET dan secret key webhook. Jangan memakai nilai CHANGE_ME.
5. Isi source ID dan product ID stabil yang disepakati dengan pengirim webhook, lalu konfigurasi SMTP/email/support.

Jalankan tiga proses berikut:

```bash
npm run db:migrate
npm run dev
# Di terminal terpisah:
npm run worker
```

Migrasi menjalankan schema Better Auth dan schema domain yang idempoten. Worker wajib berjalan terpisah dari web server agar event yang sudah diterima 202 tetap diproses meski browser ditutup.

Buka http://localhost:3000/login. Tanpa konfigurasi database/secret, API menolak permintaan dan halaman aplikasi menampilkan petunjuk konfigurasi, bukan akses demo. Tanpa SMTP, grant tetap tersimpan tetapi email gagal dan masuk antrean retry; pantau panel integrasi.

## SMTP Brevo

Konfigurasi SMTP berada di .env.local, tidak memakai NEXT_PUBLIC_ dan tidak masuk Git. File referensi SMTP APIKEY.txt juga diabaikan Git; jangan mengunggahnya bersama source.

Untuk Brevo gunakan SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587, SMTP_SECURE=false, SMTP_REQUIRE_TLS=true. SMTP_USER adalah nilai Login dari Brevo, dan SMTP_PASSWORD adalah SMTP key, bukan password akun admin aplikasi atau REST API key. Aplikasi mewajibkan STARTTLS pada relay Brevo dan memvalidasi sertifikat TLS.

EMAIL_FROM harus berisi alamat pengirim yang sudah terverifikasi di Brevo, misalnya nama layanan diikuti alamat tersebut dalam tanda kurung sudut. SMTP login tidak otomatis menjadi alamat pengirim. Panduan: [Konfigurasi Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP) dan [pemecahan masalah pengirim](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP).

Periksa koneksi dan autentikasi tanpa mengirim email:

```bash
npm run smtp:verify
```

Verifikasi ini belum membuktikan pengiriman atau penerimaan email, dan belum memeriksa izin alamat From. Setelah mengubah env, restart worker agar memuat konfigurasi baru. Jangan menampilkan key pada log, screenshot, atau dokumentasi. SMTP key yang sudah dibagikan sebaiknya dirotasi melalui Brevo.

## Membuat admin

Bootstrap menggunakan CLI lokal, bukan endpoint publik. Email yang sudah terdaftar tidak ditimpa. Password 12–128 karakter dan tidak di-trim.

Contoh memasukkan password tanpa menyimpannya dalam history shell:

```bash
read -r ADMIN_EMAIL
read -rs ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_PASSWORD
npm run admin:create
unset ADMIN_EMAIL ADMIN_PASSWORD
```

Masuk melalui /login; admin diarahkan ke /admin/access. Role admin tidak otomatis mendapat grant kalkulator atau akses resep pengguna. Pengguna aktif tanpa grant diarahkan ke /app/access.

## Integrasi pembelian

Endpoint: POST /api/webhooks/purchases. Kontrak lengkap ada pada bagian 14 PRD.

Header:

- X-HPP-Key-Id: ID dari PURCHASE_WEBHOOK_KEYS.
- X-HPP-Timestamp: Unix timestamp dalam detik, toleransi ±5 menit.
- X-HPP-Signature: sha256= diikuti HMAC-SHA256 hex atas timestamp + "." + raw body.

Contoh konfigurasi key dengan rotasi:

```json
{"primary":{"source":"purchase-source","secret":"SECRET_ACAK_32_KARAKTER_ATAU_LEBIH"}}
```

Key source harus sama dengan PURCHASE_SOURCE_ID dan payload source. Product ID allowlist dipisah koma. Sender menandatangani byte JSON yang benar-benar dikirim, bukan hasil parse/serialisasi ulang.

Respons 202 berarti event baru telah tersimpan, bukan grant sudah dibuat. Duplikat identik 200, ID sama/body berbeda 409, signature invalid 401, payload invalid 400/422, terlalu besar 413, rate limit 429 dengan Retry-After. Sender perlu outbox/retry sendiri. Worker memproses versi transaksi terbaru; refund yang datang sebelum paid tetap mencegah aktivasi oleh versi paid lama.

Status review_required membutuhkan rekonsiliasi manual dengan sumber pembelian. Tidak ada pemindahan akun otomatis bila email purchase berubah. SMTP gagal tidak membatalkan akun/grant. Payload email berisi tautan rahasia sementara: batasi akses database dan backup.

## API utama

- /api/account/token, activate, reset-password, forgot-password, resend-activation, status.
- /api/profile: baca/ubah profil.
- /api/calculations: list dengan search/status/page dan buat draft.
- /api/calculations/:id: baca dan PATCH dengan expected_draft_version.
- /api/calculations/:id/finalize: expected_draft_version dan request_id UUID.
- /api/calculations/:id/duplicate dan archive.
- /api/calculations/:id/revisions/:revision/report dan export?format=pdf atau xlsx.
- /api/admin/access dan integrations: khusus admin, setiap tindakan wajib alasan.

Input uang/angka API berupa decimal string canonical dengan titik desimal tanpa pemisah ribuan. Snapshot dihitung server; hasil hitung dari client diabaikan. Request mutasi pengguna harus membawa Origin yang sesuai APP_BASE_URL.

## Validasi

```bash
npm run typecheck
npm run test
npm run build
npm audit
```

Pengujian database dilewati bila HPP_TEST_DATABASE_URL tidak diisi. Siapkan database khusus bernama hpp_test atau hpp_test_suffix pada localhost/127.0.0.1; runner menolak nama/host lain. Data uji memakai ID unik dan tetap ada untuk inspeksi.

```bash
createdb hpp_test
HPP_TEST_DATABASE_URL=postgresql://localhost/hpp_test npm run test
npx playwright install chromium
npm run build
HPP_TEST_DATABASE_URL=postgresql://localhost/hpp_test npm run test:e2e
```

Browser test menjalankan production server sementara di 127.0.0.1:3027 dan memeriksa aktivasi, login, autosave, konflik antar-tab, snapshot, unduhan PDF/Excel, profil dan tindakan admin pada desktop/mobile. PLAYWRIGHT_CHROMIUM_EXECUTABLE dapat menunjuk binary Chromium yang sudah tersedia. Jangan memakai database produksi untuk pengujian.

## Sebelum produksi

- Lengkapi source/product ID, HTTPS domain, SMTP dan kontak support nyata. Integrasi ke pengirim pembelian serta pengiriman email nyata belum bisa dinyatakan selesai tanpa konfigurasi tersebut.
- Jalankan build/start dan worker sebagai service terpisah dengan restart otomatis; jalankan migrasi sebagai langkah rilis terkontrol.
- Gunakan role DB aplikasi terbatas, TLS DB bila remote, backup teruji dan monitoring worker/outbox. Jangan membuka PostgreSQL ke publik.
- Reverse proxy harus membersihkan header IP dari client dan memberikan header IP tepercaya. Konfigurasikan kebijakan trusted proxy Better Auth sesuai infrastruktur. Default library membatasi request secara konservatif bila IP tidak dikenali; jangan mempercayai X-Forwarded-For arbitrer.
- Matikan pencatatan query string halaman aktivasi/reset pada access log dan analytics, karena mengandung token. Referrer-Policy no-referrer sudah diterapkan.
- Payload diagnostik event terminal dipangkas setelah 30 hari; dedup hash, purchase state dan tombstone tetap disimpan. Review/failed jobs dipertahankan untuk pemulihan.
- Publikasi kode ke GitHub tidak berarti aplikasi sudah di-deploy. Deployment dan integrasi sistem pembelian produksi dilakukan sebagai langkah terpisah.
