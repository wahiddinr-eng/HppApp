# KulinerKit

Aplikasi pendamping bisnis kuliner dengan backend PostgreSQL, berawal dari [PRD kalkulator HPP](./PRD.md). Alurnya mengikuti kebutuhan usaha: menyiapkan harga lewat HPP dan simulasi kanal, menyiapkan promosi lewat galeri prompt, lalu mencatat penjualan harian dan menganalisis hasilnya. Ini bukan aplikasi kasir; penjualan diisi sebagai rekap per hari. Akun dibuat dari pembelian yang tervalidasi; pendaftaran umum tidak tersedia.

Halaman publik `/` adalah landing page KulinerKit dengan penjelasan fitur, simulasi biaya sederhana, cara mulai, dan tanya jawab. Harga awal Rp125.000 ditampilkan bersama harga coret Rp299.000. Tombol beli membuka checkout mandiri `/checkout`, lalu pelanggan menerima tautan pembayaran melalui email. Login tetap di `/login`, ruang kerja pelanggan di `/app`. Meta Pixel/CAPI tersedia tetapi nonaktif sampai dataset baru dan kredensialnya disimpan di `/admin/meta`.

## Fitur yang tersedia

- Better Auth: login, logout, aktivasi sekali pakai 24 jam, reset 60 menit, perubahan password dan pencabutan sesi.
- Akun dan grant terpisah, pemeriksaan akses aktif serta pemilik pada setiap API perhitungan/report/ekspor.
- Draft otomatis setelah 2 detik, optimistic locking antar-tab, finalisasi idempoten, revisi final immutable di database.
- Mesin HPP decimal berpresisi 60 digit, pajak inclusive/exclusive, report dari snapshot server, PDF A4 dan Excel enam sheet.
- Simulasi harga jual untuk GoFood, ShopeeFood, GrabFood, dan kanal lain dengan tarif merchant yang diisi sendiri. Panduan pemula menandai margin 30% sebagai titik awal yang bisa diubah, bukan patokan sehat universal; menampilkan harga impas berdampingan dengan harga target; serta menghitung batas promo total pada harga saran: batas tanpa rugi per porsi dan batas yang tetap menjaga margin target. Batas promo sudah termasuk promo yang diisi, dihitung dengan asumsi semua potongan persentase berasal dari harga menu dan satu porsi per pesanan; biaya tetap bulanan belum tercakup.
- Target Untung & Titik Impas: cukup simpan biaya tetap, penghasilan yang diinginkan, dan hari berjualan. Aplikasi menghitung kebutuhan hasil setelah HPP serta potongan per bulan/hari tanpa target per kanal. Perkiraan jumlah produk hanya ditampilkan jika tersedia sedikitnya 7 hari rekap dan 20 produk terjual dalam 30 hari terakhir; realisasi bulan berjalan juga ditampilkan. Ini simulasi, bukan jaminan laba.
- Daftar Bahan & Riwayat Harga: tautkan satu bahan ke beberapa resep, pratinjau perubahan HPP/margin, lalu konfirmasi pembaruan. Menu final mendapat revisi baru dengan harga jual pilihan tetap; revisi dan rekap penjualan lama tidak ditimpa.
- Galeri prompt promosi untuk pelanggan berhak akses, dikelola dari panel admin.
- Penjualan Harian: jumlah pesanan, produk terjual, omzet kotor, potongan kanal, catatan, dan hari tanpa penjualan. HPP produk disimpan sebagai snapshot saat rekap pertama dibuat, sehingga perubahan resep berikutnya tidak mengubah analisis historis.
- Analisis Penjualan: rentang 7/30 hari, bulan berjalan atau tanggal khusus; perbandingan periode sebelumnya, menu terlaris, kanal dengan pesanan terbanyak, tren, dan riwayat harian. Hasil setelah HPP adalah perkiraan sebelum biaya usaha lain, bukan laba bersih akuntansi.
- Webhook HMAC dengan batas body, pemeriksaan waktu, inbox durable, dedup, purchase state_version, tombstone refund, dan tinjauan refund sebagian/perubahan email.
- Worker webhook/email dengan locking, retry eksponensial, heartbeat, dan pembersihan payload token yang selesai/kedaluwarsa.
- Panel admin terpisah di `/admin`: dashboard jumlah pengguna, pembelian unik, hak aktif, kartu prompt, dan job gagal; halaman pengguna/akses, integrasi/email, serta kartu prompt. Admin tidak dapat melihat resep milik pembeli melalui panel ini.
- Admin dapat membuat tautan aktivasi cadangan 24 jam bagi customer yang masih menunggu aktivasi dari halaman Pengguna & akses. Tautan hanya ditampilkan sekali untuk disalin dan dibagikan secara pribadi; tautan lama serta email aktivasi yang masih antre dibatalkan. Tindakan dicatat dalam audit tanpa menyimpan tautan mentah.
- Admin dapat memperbaiki nama, email login, dan nomor HP akun customer dari Pengguna & akses dengan alasan yang diaudit. Email baru harus belum dipakai akun lain. Perubahan email membatalkan tautan aktivasi/reset lama dan mengeluarkan sesi; untuk akun yang belum aktif, email aktivasi baru dijadwalkan. Data transaksi dan email yang sudah terkirim tetap menjadi catatan historis, bukan diubah diam-diam.
- Checkout langsung menjual satu bundle KulinerKit (HPP dan Galeri Prompt). Admin mengatur harga, QRIS statis, rekening bank, dan buka/tutup checkout di `/admin/checkout`. Pengaturan awal tertutup; jangan buka sampai rekening/QRIS serta SMTP siap. Pesanan ada di `/admin/transactions`; complete dilakukan setelah dana masuk dan mengirim email aktivasi/akses. Pending/failed dari complete mencabut hanya grant pesanan langsung itu. Dashboard menampilkan omzet terverifikasi dan grafik 30 hari khusus checkout langsung, terpisah dari pembelian LRMobileID.
- Form checkout meminta nama, email, dan nomor WhatsApp aktif. Nomor HP Indonesia berawalan 08/62/+62 dinormalisasi menjadi `+62` dan terlihat pada transaksi admin. Pesanan lama yang dibuat sebelum kolom ini ada tetap dapat dibaca tanpa nomor.
- Halaman `/pay/<token>` menampilkan instruksi pembayaran, status, tombol konfirmasi WhatsApp ke `0851 6121 8257`, dan template pesan berisi kode, email, nomor pembeli, metode, serta nominal. Pelanggan mengirim bukti pembayaran melalui chat; pesan WhatsApp bukan verifikasi otomatis. Tautan pembayaran bersifat rahasia, disimpan sebagai hash pada tabel pesanan dan dikirim lewat email.
- Meta Pixel dan CAPI untuk checkout langsung: `ViewContent` di landing page, `InitiateCheckout` di checkout yang dibuka, dan `Purchase` saat admin mengubah status menjadi `complete`. `Purchase` CAPI tetap dikirim worker; Pixel browser ikut mengirim `Purchase` ketika pembeli membuka atau memperbarui halaman pembayaran yang sudah terverifikasi. Keduanya memakai `event_id` yang sama untuk deduplikasi. Webhook LRMobileID tidak menghasilkan event Meta di aplikasi ini.
- PWA yang bisa ditambahkan ke Layar Utama iPhone tanpa App Store. Ini pintasan aplikasi web, bukan mode offline: login, resep, gambar, dan transaksi tetap memerlukan internet.
- Web Push khusus admin untuk pesanan checkout langsung yang baru dibuat. Tiap perangkat admin mengaktifkan izin sendiri dari dashboard; payload layar kunci hanya berisi kode pesanan. Email pesanan admin tetap dikirim seperti sebelumnya. Pesanan dari webhook LRMobileID tidak memicu push ini.

Sidebar pelanggan diurutkan berdasarkan perjalanan usaha: Beranda → Siapkan Harga (Bahan, HPP, Harga per Kanal, Target Untung) → Siapkan Promosi → Pantau Penjualan → Akun. Pada layar ponsel, menu tambahan ada di "Lainnya". Halaman target ada di `/app/profit-target`, rekap di `/app/sales`, dan analisis di `/app/sales/analysis`.

Halaman `/app/ingredients` menyimpan harga per satuan (g, kg, ml, liter, atau buah). Resep yang sudah ada **tidak ditautkan otomatis** berdasarkan nama: buka resep, pilih bahan yang sesuai pada setiap baris, lalu finalkan revisinya sekali. Setelah itu, perubahan harga dari daftar bahan dapat diterapkan ke semua resep aktif yang tertaut dalam satu konfirmasi. Draft diperbarui sebagai draft; menu final mendapatkan revisi final baru. Bila harga jual awal memakai saran otomatis, pembaruan bahan membekukan harga jual sebelumnya sebagai harga pilihan agar harga tidak naik diam-diam; saran harga baru tetap ditampilkan. Resep arsip tidak diperbarui otomatis. Perubahan harga katalog bukan pencatatan stok atau biaya pembelian aktual setiap batch.

Saat customer aktif pertama kali login, aplikasi membuka `/app/guide`. Panduan menampilkan langkah sesuai fitur yang dimiliki akun; tombol **Mulai menggunakan** menyimpan status selesai per akun, sehingga login berikutnya langsung menuju ruang kerja. Panduan tetap dapat dibuka dari bagian bawah sidebar desktop atau menu **Lainnya** di ponsel. Admin tidak diarahkan ke panduan customer.

Panduan juga menyediakan ebook PDF edukasi HPP dan tutorial fitur pelanggan di `/app/guide/ebook`, dengan tombol buka dan unduh. Naskahnya ada di [`docs/PANDUAN-PENGGUNA-KULINERKIT.md`](./docs/PANDUAN-PENGGUNA-KULINERKIT.md). Setelah mengubah naskah atau generator, jalankan `npm run guide:pdf` untuk memperbarui [`public/panduan-kulinerkit.pdf`](./public/panduan-kulinerkit.pdf) sebelum build/deploy.

Di bagian bawah sidebar customer dan menu **Lainnya** pada ponsel tersedia WhatsApp bantuan penggunaan KulinerKit di `0851 6121 8257`. Pesan awal menyebut KulinerKit serta `hpp.lrmobileid.com` agar berbeda dari dukungan checkout LRMobileID.

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

Untuk checkout lokal: buka `/admin/checkout`, isi rekening atau unggah QRIS asli, periksa harga, lalu aktifkan checkout. Uji pesanan di `/checkout`; email pelanggan berisi halaman pembayaran dan admin menerima notifikasi. Pastikan worker berjalan agar email Brevo terkirim. Di `/admin/transactions`, pilih status **complete** hanya setelah memeriksa dana masuk. Jangan menggunakan QRIS atau rekening contoh untuk menerima pembayaran sungguhan. Gambar QRIS disimpan di `CHECKOUT_MEDIA_ROOT`; gunakan path persisten pada VPS. Webhook pembelian LRMobileID tidak berubah dan tetap dapat dipakai paralel.

## Instalasi iPhone dan notifikasi pesanan

Buka `https://hpp.lrmobileid.com` di Safari pada iPhone, ketuk **Bagikan → Tambahkan ke Layar Utama**, lalu buka ikon KulinerKit dan login. Manifest, ikon, serta service worker sudah disediakan. Service worker hanya menangani push; aplikasi **belum mendukung pemakaian offline** dan tidak menyimpan halaman atau data akun dalam cache offline. Untuk notifikasi Web Push, iPhone/iPad memerlukan iOS/iPadOS 16.4 atau lebih baru, aplikasi harus dibuka dari ikon Layar Utama, dan admin perlu menekan tombol izin notifikasi sendiri. [Panduan WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Notifikasi pesanan baru hanya dikirim ke perangkat admin yang berlangganan melalui **Dashboard admin → Notifikasi di perangkat admin**. Satu pesanan checkout langsung menghasilkan satu job per perangkat aktif; worker mengirimnya setelah transaksi database selesai, dengan retry saat pengiriman sementara gagal. Ini pemberitahuan pesanan **pending**, bukan konfirmasi pembayaran. Pembeli tidak menerima push dan webhook LRMobileID tidak masuk jalur ini. Admin dapat mematikan notifikasi per perangkat; logout mencoba mencabut langganan perangkat itu. Langganan yang tidak diperbarui selama 90 hari dibersihkan.

Sebelum mengaktifkan push, jalankan `npm run db:migrate`, buat satu pasang kunci VAPID dengan `npx --no-install web-push generate-vapid-keys`, lalu simpan `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, dan `PUSH_VAPID_SUBJECT=mailto:alamat-kontak-publik@example.com` di environment server **web dan worker**. Kunci privat tidak boleh masuk Git atau browser; jangan mengganti pasangan kunci setelah admin berlangganan tanpa meminta admin mengaktifkan ulang notifikasi. Gunakan alamat kontak sungguhan, bukan localhost. Setelah perubahan env, restart web dan worker. Server perlu akses keluar HTTPS ke layanan push browser, termasuk `*.push.apple.com` untuk perangkat Apple. Bila kunci belum lengkap, tombol aktivasi dinonaktifkan; email notifikasi admin tetap berjalan.

## Meta Pixel dan Conversions API

Gunakan **dataset/Pixel baru khusus KulinerKit** di Meta Events Manager; jangan memakai dataset LRMobileID agar optimasi dan laporan kedua bisnis tidak tercampur. Buat access token Conversions API untuk dataset itu. Setelah migrasi, buka **Admin → Meta Pixel & CAPI** (`/admin/meta`), isi Pixel ID, access token CAPI, versi Graph API, dan kode tes sementara bila sedang menguji. Aktifkan lalu simpan. Token dienkripsi menggunakan kunci yang diturunkan dari `AUTH_SECRET`, tidak dikirim kembali ke browser, dan hanya bisa diganti atau dihapus; pertahankan `AUTH_SECRET` yang sama di web dan worker serta jangan merotasinya tanpa memasukkan ulang token CAPI. Pengaturan admin langsung dibaca oleh web dan worker melalui database, jadi perubahan tidak memerlukan restart. Variabel `META_*` di environment hanya fallback bagi instalasi lama sampai pengaturan pertama disimpan di admin. Jangan gunakan `NEXT_PUBLIC_` atau mengirim token melalui chat. Pastikan halaman informasi privasi dan mekanisme persetujuan yang diperlukan untuk penggunaan Pixel/CAPI sudah disiapkan sebelum mengaktifkan tracking pada pengunjung nyata.

| Aksi | Pixel browser | CAPI server | Nilai dan identitas |
| --- | --- | --- | --- |
| Landing page `/` dilihat | `ViewContent` | Event pasangannya, `event_id` sama | Harga terkini dan ID `kulinerkit_bundle` |
| Checkout `/checkout` dibuka ketika aktif | `InitiateCheckout` | Event pasangannya, `event_id` sama | Harga terkini dan ID bundle yang sama |
| Status pesanan berubah menjadi `complete` | `Purchase` saat pembeli mengecek status terverifikasi; tidak wajib menunggu browser untuk konversi | `Purchase` dari worker, `event_id` stabil yang sama | Harga snapshot pesanan, kode pesanan, email/HP/nama yang di-hash di CAPI, IP/UA dan `_fbp`/`_fbc` bila tersedia |

Ketiga event CAPI mengirim `action_source=website`, URL sumber tanpa token pembayaran, `currency=IDR`, `value`, `content_name`, `content_category`, `content_type=product`, `content_ids`, `contents`, dan `num_items`. Data identitas yang tersedia dinormalisasi dan di-hash SHA-256; IP, user-agent, `_fbp`, dan `_fbc` dikirim apa adanya sesuai [parameter CAPI Meta](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/README.md). Sebelum Pixel `Purchase` dijalankan, URL browser diganti menjadi `/pay/verified` tanpa token; reload halaman ini menampilkan petunjuk aktivasi/login tanpa mengirim ulang Pixel. `Purchase` tidak dipicu saat pesanan baru/pending, tombol WhatsApp ditekan, ataupun pembelian masuk via webhook LRMobileID.

Bila URL kunjungan berisi `fbclid` yang valid, aplikasi menyimpannya sebagai cookie `_fbc` sebelum Pixel memproses event. Klik ID yang sama dibawa dari landing page ke checkout, lalu disertakan dalam `user_data.fbc` CAPI untuk `ViewContent`, `InitiateCheckout`, dan `Purchase` bila tersedia. Pengunjung tanpa klik iklan tidak diberi Klik ID buatan. Pixel browser dan CAPI tetap memakai nama event serta `event_id` yang sama untuk deduplikasi.

Event CAPI masuk ke `meta_event_outbox` secara durable dan dikirim worker dengan retry. Pembalikan status `complete` sebelum pengiriman membatalkan event tertunda; event yang sudah diterima Meta tidak dapat ditarik kembali. Perubahan `complete` berulang tidak membuat `Purchase` baru. Halaman `/admin/meta` menampilkan **ringkasan** diterima/menunggu/gagal dan tombol mencoba ulang event gagal, bukan daftar log event. Mengganti Pixel ID, kode tes, atau menonaktifkan Meta membatalkan event antrean lama agar tidak masuk ke dataset atau mode pelaporan yang salah. Status “Diterima Meta” berarti API menerima event, bukan bukti atribusi/penjualan di Ads Manager. Payload event terminal dihapus, konteks matching checkout dipangkas setelah 30 hari. Verifikasi pada Events Manager → Test Events memakai kode uji sementara, periksa deduplikasi `ViewContent`/`InitiateCheckout`, dan buat transaksi uji khusus lalu tandai `complete` untuk memeriksa `Purchase`. **Kosongkan kode tes di admin** setelah uji agar event live masuk pelaporan normal. Tanpa ID/token yang valid dan uji di Events Manager, pengiriman nyata belum terverifikasi.

Untuk mencoba analisis dengan akun customer demo lokal yang sudah berisi tiga produk final, jalankan `node --env-file=.env.local --import tsx scripts/seed-demo-sales.ts`. Skrip ini hanya menerima URL aplikasi/database localhost, menambahkan 14 hari data ilustratif, dan tidak menimpa hari yang sudah tercatat. Data demo tidak digunakan di produksi.

Untuk contoh **Bahan & Harga** dan **Target Untung**, jalankan `npm run db:migrate`, lalu `node --env-file=.env.local --import tsx scripts/seed-demo-planning.ts`. Skrip ini menambahkan 12 bahan contoh ke akun `demo.customer.local@hpp.test`, menghubungkan sebagian bahan ke tiga produk demo tanpa mengubah HPP, dan menyimpan rencana target ilustratif (biaya tetap Rp2.500.000, target penghasilan Rp3.000.000, 26 hari jualan). Resep/target yang sudah diedit tidak ditimpa; skrip hanya menerima database serta URL aplikasi lokal.

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

Masuk melalui `/login`; admin diarahkan ke `/admin`. Role admin tidak otomatis mendapat grant kalkulator atau akses resep pengguna. Pengguna aktif tanpa grant diarahkan ke `/app/access`.

## Integrasi pembelian

Panduan lengkap konfigurasi kedua aplikasi, implementasi sender LRMobileID, payload/signature, pengujian, retry, refund, dan troubleshooting: [Panduan Integrasi Webhook LRMobileID → HppApp](./PANDUAN-INTEGRASI-WEBHOOK.md).

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
- /api/sales/day: GET dengan `date=YYYY-MM-DD`, PUT untuk menyimpan rekap dengan `version` (konflik 409).
- /api/sales/analysis: GET dengan `from` dan `to` untuk rangkuman serta pembanding periode sebelumnya.
- /api/profile/guide: POST untuk menandai panduan awal selesai bagi customer yang login.
- /api/admin/access dan integrations: khusus admin, tindakan akses/job wajib alasan; /api/admin/meta: pengaturan Pixel/CAPI terenkripsi dan ringkasan pengiriman.
- /api/checkout: penawaran publik; /api/checkout/orders: buat pesanan; /api/checkout/orders/:token: halaman/status pembayaran; /api/admin/checkout dan /api/admin/transactions: pengaturan dan verifikasi admin.
- /api/meta/events: konfigurasi Pixel publik terbatas dan penerimaan event halaman dengan validasi Origin/rate limit; token CAPI tetap hanya di server.

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
- Siapkan dataset Meta **khusus KulinerKit** beserta token CAPI-nya, tinjau informasi privasi/persetujuan pengunjung, lalu aktifkan dan uji event di Events Manager. Jangan memakai Pixel atau token LRMobileID.
- Jalankan build/start dan worker sebagai service terpisah dengan restart otomatis; jalankan migrasi sebagai langkah rilis terkontrol.
- Gunakan role DB aplikasi terbatas, TLS DB bila remote, backup teruji dan monitoring worker/outbox. Jangan membuka PostgreSQL ke publik.
- Reverse proxy harus membersihkan header IP dari client dan memberikan header IP tepercaya. Konfigurasikan kebijakan trusted proxy Better Auth sesuai infrastruktur. Default library membatasi request secara konservatif bila IP tidak dikenali; jangan mempercayai X-Forwarded-For arbitrer.
- Matikan pencatatan query string halaman aktivasi/reset pada access log dan analytics, karena mengandung token. Referrer-Policy no-referrer sudah diterapkan.
- Payload diagnostik event terminal dipangkas setelah 30 hari; dedup hash, purchase state dan tombstone tetap disimpan. Review/failed jobs dipertahankan untuk pemulihan.
- Publikasi kode ke GitHub tidak berarti aplikasi sudah di-deploy. Deployment dan integrasi sistem pembelian produksi dilakukan sebagai langkah terpisah.
