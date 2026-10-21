# Panduan Integrasi Webhook LRMobileID → KulinerKit

Versi dokumen: 1.1. Tanggal pemeriksaan produksi: 21 Oktober 2026.

Tujuan: pembeli produk Kuliner Kit yang pembayarannya terverifikasi di `app.lrmobileid.com` otomatis memperoleh akun dan akses kalkulator serta galeri prompt di KulinerKit, lalu menerima email aktivasi.

Kontrak penerima mengikuti [PRD bagian 14](./PRD.md#14-kontrak-webhook). Bagian implementasi pengirim dan fixture di bawah sebagian merupakan rancangan awal; gunakan status produksi berikut sebagai acuan terkini. Konfigurasi aktual dan catatan rilis ada di [README deployment](./deploy/kulinerkit/README.md).

Status produksi: satu produk LRMobileID `prd_344a58e2-23f3-4c33-84d0-cf0f9c52f9d0` dipetakan ke kedua fitur. Endpoint `https://hpp.lrmobileid.com/api/webhooks/purchases` dan pengirim LRMobileID sudah aktif, dengan source `app.lrmobileid.com`, key ID `primary`, format `hpp`, dan secret bersama yang tidak ditampilkan. Uji pengiriman bertanda tangan melalui transport produksi lulus: payload `{}` ditolak receiver dengan 422 setelah autentikasi (tanpa membuat transaksi). Belum ada pembelian baru yang memverifikasi akun/grant/email end-to-end. Pengirim saat ini hanya mendukung `purchase.paid`; refund dan chargeback harus dicabut manual melalui admin HPP sampai event otomatis tersedia.

## Daftar isi

1. [Status dan batas integrasi](#1-status-dan-batas-integrasi)
2. [Alur dan data yang harus disepakati](#2-alur-dan-data-yang-harus-disepakati)
3. [Konfigurasi HppApp](#3-konfigurasi-hppapp)
4. [Konfigurasi dan implementasi LRMobileID](#4-konfigurasi-dan-implementasi-lrmobileid)
5. [Kontrak payload](#5-kontrak-payload)
6. [Signature dan contoh pengiriman](#6-signature-dan-contoh-pengiriman)
7. [Outbox, idempotensi, dan retry](#7-outbox-idempotensi-dan-retry)
8. [Pengujian lokal dan staging](#8-pengujian-lokal-dan-staging)
9. [Pemantauan dan pemulihan](#9-pemantauan-dan-pemulihan)
10. [Troubleshooting](#10-troubleshooting)
11. [Keamanan, rotasi, dan peluncuran](#11-keamanan-rotasi-dan-peluncuran)
12. [Checklist penerimaan](#12-checklist-penerimaan)
13. [Rujukan](#13-rujukan)

## 1. Status dan batas integrasi

| Komponen | Status per 21 Oktober 2026 |
| --- | --- |
| Endpoint HppApp `POST /api/webhooks/purchases` | Tersedia |
| Pemeriksaan HMAC, timestamp, schema, dan source | Tersedia |
| Inbox database, dedup, versi transaksi, dan worker HppApp | Tersedia |
| Pembuatan akun, grant, serta antrean email | Tersedia |
| Panel admin HppApp untuk pemantauan/retry | Tersedia |
| Pengirim webhook HPP dari LRMobileID | Aktif; transport bertanda tangan telah diuji dengan payload invalid |
| Outbox khusus pengiriman LRMobileID → HPP | Aktif; belum ada delivery pembelian produk baru |
| Domain HPP, ID produk asli, dan konfigurasi produksi bersama | Terpasang dan cocok untuk satu produk bundle |

Penting:

- Endpoint yang hanya berisi URL tanpa format `hpp`, source/key ID, secret, dan filter produk yang benar tidak akan memberi akses. Konfigurasi lengkap saat ini sudah terpasang.
- `/admin/integrations` HppApp adalah halaman pemantauan/retry, bukan formulir pengaturan secret.
- Webhook payment gateway yang sekarang menuju LRMobileID tetap dipertahankan. Jangan menggantinya dengan URL HppApp.
- HppApp tidak menerima payload payment gateway secara langsung. Backend LRMobileID harus memverifikasi pembayaran dan memetakannya ke kontrak dokumen ini.
- Akun HppApp terpisah dari akun LRMobileID. Ini bukan SSO dan tidak menyalin password LRMobileID.
- Implementasi HppApp saat ini hanya memproses akses untuk `IDR`. Mata uang lain, termasuk `MYR`, masuk `review_required` dengan stage `unsupported_currency`. Jangan mengubah label MYR menjadi IDR tanpa kebijakan dan perhitungan yang benar.
- Publikasi source ke GitHub tidak sama dengan deployment aplikasi.
- Refund/chargeback belum dihasilkan oleh sender LRMobileID saat ini. Operator wajib menangani pencabutan akses HPP secara manual setelah verifikasi pembayaran balik.

## 2. Alur dan data yang harus disepakati

```text
Pembeli membayar
  → Backend LRMobileID memverifikasi pembayaran
  → Transaksi status + versi + event outbox disimpan secara atomic
  → Worker pengirim LRMobileID mengirim request bertanda tangan
  → HppApp memverifikasi dan menyimpan inbox, lalu membalas 202
  → Worker HppApp membuat/memakai akun dan mengaktifkan grant
  → Worker email HppApp mengirim tautan aktivasi melalui Brevo
  → Pembeli membuat password dan login HppApp
```

Sepakati nilai berikut terlebih dahulu:

| Parameter | Nilai produksi saat ini |
| --- | --- |
| Domain HPP | `https://hpp.lrmobileid.com` |
| URL endpoint | `https://hpp.lrmobileid.com/api/webhooks/purchases` |
| Source integrasi | `app.lrmobileid.com`, persis sama di kedua aplikasi dan payload |
| ID produk berhak | `prd_344a58e2-23f3-4c33-84d0-cf0f9c52f9d0` untuk kalkulator dan galeri prompt |
| Key ID awal | `primary` |
| Secret webhook | String acak minimal 32 karakter, sama di kedua server |
| Mata uang pilot | `IDR` |
| Email pengirim | `HppApp <akses@mailer.lrmobileid.com>`; sender/domain harus terverifikasi di Brevo |
| Email uji | Inbox yang Anda kendalikan, bukan email pembeli asli |
| Penanggung jawab | Operator untuk failed jobs, refund, dan rekonsiliasi |

`DOMAIN-HPP`, `ID_PRODUK_ASLI`, dan semua nilai berawalan `GANTI_` dalam contoh historis di bawah adalah placeholder, bukan konfigurasi siap produksi. Jangan salin placeholder itu ke environment aktif.

Domain HppApp harus bisa dijangkau server LRMobileID. `localhost` di server LRMobileID menunjuk server itu sendiri, bukan laptop Anda. Jika kedua aplikasi benar-benar satu host, komunikasi internal dapat dirancang terpisah, tetapi jangan berasumsi port/container sama dan tetap gunakan URL publik yang benar untuk tautan email HppApp.

### Menentukan ID produk

ID produk bundle saat ini sudah terverifikasi di atas. Untuk perubahan produk berikutnya, ambil ID dari data produk LRMobileID. Query berikut bersifat baca-saja, jalankan pada database LRMobileID yang benar:

```sql
SELECT id, name, slug, status
FROM products
WHERE name ILIKE '%kuliner%'
ORDER BY name;
```

Periksa hasil secara manual. Jangan otomatis memilih produk hanya karena namanya mengandung `kuliner`. Allowlist HPP mencocokkan `items[].product_id` dan tidak otomatis memperluas akses kategori LRMobileID.

## 3. Konfigurasi HppApp

### 3.1 Membuat secret

Jalankan sekali untuk membuat secret webhook:

```bash
openssl rand -hex 32
```

Simpan hasil dalam konfigurasi server kedua aplikasi. Buat `AUTH_SECRET` melalui pemanggilan terpisah sehingga nilainya berbeda. Jangan memakai SMTP key, password admin, atau secret payment gateway sebagai secret webhook.

### 3.2 Environment

Gunakan `.env.local` atau injeksi environment service. Jangan menimpa konfigurasi lokal yang sudah bekerja tanpa backup aman. Contoh berikut sengaja berisi placeholder:

```dotenv
APP_BASE_URL=https://DOMAIN-HPP
DATABASE_URL=postgresql://ROLE_HPP:GANTI_PASSWORD_DB@HOST_DB:5432/DB_HPP
AUTH_SECRET=GANTI_SECRET_AUTH_ACAK_MINIMAL_32_KARAKTER

PURCHASE_SOURCE_ID=app.lrmobileid.com
PURCHASE_WEBHOOK_KEYS='{"primary":{"source":"app.lrmobileid.com","secret":"GANTI_SECRET_WEBHOOK_ACAK_MINIMAL_32_KARAKTER"}}'
ELIGIBLE_AI_FOOD_PRODUCT_IDS=ID_PRODUK_ASLI
PROMPT_GALLERY_PRODUCT_IDS=ID_PRODUK_ASLI

EMAIL_FROM="HppApp <akses@mailer.lrmobileid.com>"
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=GANTI_LOGIN_SMTP_BREVO
SMTP_PASSWORD=GANTI_SMTP_KEY_BREVO
SUPPORT_CONTACT_URL=https://DOMAIN-KONTAK-BANTUAN
```

Ketentuan:

- `APP_BASE_URL` adalah origin aplikasi, tanpa `/login` dan sebaiknya tanpa slash akhir.
- Beberapa ID produk dipisahkan koma, misalnya `ID_PRODUK_1,ID_PRODUK_2`.
- `PURCHASE_WEBHOOK_KEYS` harus JSON valid. `primary` adalah key ID, bukan secret.
- `source` milik key harus cocok dengan `PURCHASE_SOURCE_ID` dan `source` payload.
- Allowlist kosong, source kosong, atau konfigurasi key tidak valid membuat endpoint menolak request dengan `503 WEBHOOK_CONFIG`.
- Secret yang mengandung `CHANGE_ME` ditolak. Placeholder lain juga wajib diganti meskipun panjangnya memenuhi validasi.
- URI database harus memakai encoding yang benar untuk karakter khusus pada password.
- SMTP user adalah login SMTP Brevo. SMTP password adalah SMTP key, bukan REST API key.
- Gunakan STARTTLS; contoh di atas memakai port 587, tetapi VPS ProjectLr aktif memakai port 2525 karena koneksi 587 timeout. Jangan mengatur `SMTP_SECURE=true` untuk konfigurasi ini. Lihat [panduan SMTP Brevo](https://help.brevo.com/hc/en-us/articles/10905415650322-Which-SMTP-port-should-I-use-Port-587-465-or-2525).
- Jangan menambahkan prefix `NEXT_PUBLIC_` pada secret atau kredensial database/SMTP.

### 3.3 Menjalankan aplikasi

Dari direktori HppApp, gunakan Node.js 22 dan database PostgreSQL khusus aplikasi:

```bash
npm ci
npm run db:migrate
npm run typecheck
npm run build
npm run smtp:verify
npm run start
```

Di terminal atau service terpisah:

```bash
npm run worker
```

`smtp:verify` memeriksa koneksi/autentikasi tanpa mengirim email. Hasil berhasil belum membuktikan email sampai ke inbox atau bahwa alamat From diizinkan.

Di produksi, web server dan worker harus menjadi service terpisah dengan restart otomatis. Pastikan keduanya memakai konfigurasi/database yang sama. Script `db:migrate`, `worker`, dan `smtp:verify` memuat `.env.local`; bila memakai environment service tanpa file, sesuaikan entrypoint, misalnya `node --import tsx scripts/worker.ts` setelah environment diinjeksi.

Setelah mengubah environment, restart web server dan worker terkait. Penetapan domain, reverse proxy, port, nama service, dan deployment adalah pekerjaan terpisah; jangan menimpa service aplikasi lain pada VPS bersama.

### 3.4 Admin

Jika belum ada admin, ikuti prosedur `npm run admin:create` pada [README](./README.md#membuat-admin). Jangan menyimpan password admin dalam dokumen, source, atau history shell. Password HppApp saat ini harus 12–128 karakter.

Masuk lewat `/login`, lalu buka `/admin/integrations` dan `/admin/access`. Admin tidak otomatis memiliki grant kalkulator atau akses resep pembeli.

## 4. Konfigurasi dan implementasi LRMobileID

### 4.1 Konfigurasi pengirim produksi

Pengirim produksi memakai tabel `outbound_webhook_endpoints` dan panel admin LRMobileID, bukan variabel `HPP_WEBHOOK_*` di bawah. Endpoint aktif bernama `Kuliner Kit` dan ber-ID `hook_815e55aa-d7ce-4569-982e-8a291145a97d`; format wajib `hpp`, URL/source/key ID/produk harus sesuai tabel bagian 2, dan secret disimpan terenkripsi. Jangan membuat endpoint kedua untuk produk yang sama karena satu pembelian dapat terkirim ganda.

Blok environment berikut hanya rancangan lama dan **jangan diterapkan** ke produksi saat ini:

```dotenv
HPP_WEBHOOK_URL=https://DOMAIN-HPP/api/webhooks/purchases
HPP_WEBHOOK_SOURCE=app.lrmobileid.com
HPP_WEBHOOK_KEY_ID=primary
HPP_WEBHOOK_SECRET=GANTI_SECRET_WEBHOOK_ACAK_MINIMAL_32_KARAKTER
HPP_ELIGIBLE_PRODUCT_IDS=ID_PRODUK_ASLI
```

Semua variabel harus server-only. Nilai URL, source, key ID, secret, dan produk harus konsisten dengan konfigurasi receiver.

### 4.2 Catatan implementasi awal

Tabel dan langkah bagian 4.2–4.3 adalah catatan rancangan sebelum sender paid/outbox LRMobileID diimplementasikan. Sender produksi kini memakai trigger database pada perubahan purchase menjadi `COMPLETED` dari source `APP`, membuat snapshot delivery immutable, dan worker outbound terpisah. Belum ada event refund/chargeback otomatis. Lokasi berikut ditemukan pada checkout lokal LRMobileID saat rancangan awal; periksa ulang terhadap kode aktif bila mengembangkan alur refund:

| Lokasi LRMobileID | Peran |
| --- | --- |
| `lib/server/purchases.ts` → `completePurchase()` | Penyelesaian pembayaran untuk beberapa gateway dan tindakan admin |
| `lib/server/purchases.ts` → `runPurchaseCompletionEffects()` | Efek setelah pembelian selesai; bukan outbox durable |
| `lib/server/sociabuzz.ts` | Jalur Sociabuzz tersendiri yang juga menjalankan completion effects |
| `app/api/admin/purchases/[purchaseId]/route.ts` | Konfirmasi manual serta perubahan status transaksi |
| `app/api/webhooks/ipaymu/route.ts` | Paid/refund iPaymu |
| `app/api/webhooks/doku/route.ts` | Paid/refund DOKU |
| `lib/db/schema.ts` → `purchases`, `products` | Sumber data transaksi dan ID produk |

Jangan hanya menambahkan `fetch()` dalam `Promise.allSettled()` completion effects. Itu tidak menjamin pengiriman setelah crash dan tidak mencakup semua jalur refund.

### 4.3 Langkah pengembangan lanjutan (bukan instruksi aktivasi saat ini)

1. Tambahkan konfigurasi server-only dan validasinya. Untuk produksi, batasi tujuan pengiriman ke domain HppApp yang disepakati, bukan URL arbitrer dari request pelanggan.
2. Tambahkan versi status integrasi per purchase dan tabel outbox pengiriman.
3. Saat status paid/refund/chargeback berubah, kunci purchase dan simpan perubahan status, versi baru, serta event outbox dalam satu transaksi database.
4. Buat snapshot payload dari data terverifikasi. Serialisasikan sekali dan simpan byte/string JSON final sebagai `raw_body` yang immutable.
5. Terapkan mekanisme enqueue yang sama pada jalur paid gateway, Sociabuzz, dan konfirmasi manual yang memenuhi syarat. Refund/chargeback harus berasal dari status provider yang terverifikasi atau tindakan operator yang sah.
6. Jalankan worker pengirim dengan timeout, locking/lease, retry, dan pencatatan status yang tidak membocorkan data sensitif.
7. Tambahkan pemantauan/retry pengirim. Panel HppApp tidak dapat memulihkan event yang belum pernah tiba di HppApp.
8. Uji semua jalur sebelum mengaktifkan pengiriman produksi.

LRMobileID sekarang menggunakan status transaksi seperti `PENDING`, `COMPLETED`, dan `FAILED`. Jangan memetakan setiap `FAILED` menjadi refund: pembayaran gagal/expired/cancelled bukan bukti refund. Catat alasan/provider event yang terverifikasi agar adapter dapat membedakannya.

Perubahan manual dari paid menjadi failed/pending dan penghapusan purchase juga membutuhkan kebijakan akses HppApp yang eksplisit. Jangan menghapus jejak transaksi yang dibutuhkan untuk rekonsiliasi. Jangan menganggap perubahan ini otomatis mencabut grant HppApp tanpa event yang sesuai.

### 4.4 Pemetaan data

| Payload HppApp | Sumber/aturan LRMobileID |
| --- | --- |
| `source` | Identitas integrasi `app.lrmobileid.com`, bukan enum `purchases.source` yang bernilai APP/dll. |
| `purchase.id` | `purchases.id`, stabil sepanjang siklus transaksi |
| `purchase.customer.email` | `purchases.customerEmail`, normalisasi trim/lowercase |
| `purchase.customer.name` | `purchases.customerName` |
| `items[].product_id` | `purchases.productId` / `products.id` asli |
| `items[].id` | ID item stabil yang disimpan; untuk single product dapat dirancang `${purchase.id}:main` |
| `items[].quantity` | `1` bila benar-benar satu produk; jangan mengarang jumlah bundle |
| `currency` | Mata uang yang benar-benar dibayar pembeli; cocok dengan nominal |
| `amount_paid` | Nominal pembayaran terverifikasi setelah diskon, string desimal tanpa pemisah ribuan |
| `state_version` | Counter baru yang disimpan, naik saat status relevan berubah; bukan nomor attempt pengiriman |
| `event_id` | ID event outbox yang stabil dan unik |
| `occurred_at` | Waktu perubahan status bisnis yang disimpan, ISO UTC |

Untuk nominal/mata uang, periksa `customerAmount`, `customerCurrency`, `amount`, serta data provider. Jangan mencampur nominal settlement IDR dengan mata uang customer MYR. Field numerik yang diubah menjadi string harus tetap memenuhi ketelitian kontrak; gunakan representasi desimal terkontrol, bukan format tampilan Rupiah.

## 5. Kontrak payload

### 5.1 Pembayaran berhasil

Contoh berikut adalah fixture, bukan transaksi nyata. Ganti ID produk dan email untuk pengujian terkontrol:

```json
{
  "schema_version": "1",
  "event_id": "evt_hpp_test_paid_001",
  "type": "purchase.paid",
  "source": "app.lrmobileid.com",
  "occurred_at": "2026-10-01T08:00:00Z",
  "purchase": {
    "id": "purchase_hpp_test_001",
    "state_version": 1,
    "payment_status": "paid",
    "currency": "IDR",
    "amount_paid": "149000",
    "customer": {
      "email": "pembeli-uji@example.test",
      "name": "Pembeli Uji Integrasi"
    },
    "items": [
      {
        "id": "purchase_hpp_test_001:main",
        "product_id": "ID_PRODUK_ASLI",
        "quantity": 1,
        "access_status": "paid"
      }
    ]
  }
}
```

Saat event benar-benar dibuat, `occurred_at` adalah waktu perubahan status tersebut. Waktu pada contoh tidak dipakai untuk validasi replay; replay memakai timestamp header pengiriman.

### 5.2 Refund penuh

Gunakan purchase ID, item ID, product ID, dan email awal yang sama. Buat event ID baru dan versi lebih tinggi:

```json
{
  "schema_version": "1",
  "event_id": "evt_hpp_test_refund_002",
  "type": "purchase.refunded",
  "source": "app.lrmobileid.com",
  "occurred_at": "2026-10-01T09:00:00Z",
  "purchase": {
    "id": "purchase_hpp_test_001",
    "state_version": 2,
    "payment_status": "refunded",
    "currency": "IDR",
    "amount_paid": "149000",
    "customer": {
      "email": "pembeli-uji@example.test",
      "name": "Pembeli Uji Integrasi"
    },
    "items": [
      {
        "id": "purchase_hpp_test_001:main",
        "product_id": "ID_PRODUK_ASLI",
        "quantity": 1,
        "access_status": "refunded"
      }
    ]
  }
}
```

Contoh ini mempertahankan nominal pembayaran awal. Kontrak belum memiliki field `amount_refunded`; sepakati semantik nominal secara konsisten. Pencabutan grant ditentukan oleh status item, bukan selisih nominal.

Chargeback menggunakan `type="purchase.chargeback"`, `payment_status="chargeback"`, dan status item terkait `chargeback`. Refund sebagian menggunakan `type="purchase.refunded"` dan status terkait `partially_refunded`; HppApp memasukkannya ke tinjauan, tidak mencabut grant item tersebut otomatis.

Kirim snapshot item terakhir secara lengkap. Untuk refund salah satu item, item lain tetap membawa status yang benar. Jangan menghilangkan item refund sehingga receiver kehilangan informasi pencabutan akses.

### 5.3 Validasi dan perilaku

- `schema_version` adalah string `"1"`, bukan angka `1`.
- Type yang diterima: `purchase.paid`, `purchase.refunded`, `purchase.chargeback`.
- ID string nonkosong maksimal 128 karakter. ID item harus unik dalam satu payload.
- `state_version` integer positif, maksimal `Number.MAX_SAFE_INTEGER`.
- Email valid maksimal 254 karakter; nama maksimal 120 karakter.
- `occurred_at` berupa datetime ISO UTC, misalnya hasil `new Date().toISOString()`.
- `payment_status`: `paid`, `pending`, `refunded`, `chargeback`, atau `partially_refunded`.
- `access_status` item: `paid`, `refunded`, `chargeback`, atau `partially_refunded`.
- Jumlah item 1–100; quantity integer 1–1.000.000.
- `currency` string tiga karakter; gunakan `IDR` untuk pilot yang didukung.
- `amount_paid` string nonnegatif, maksimal 30 karakter dan enam digit pecahan; contoh `"149000"` atau `"149000.50"`, bukan `149000` atau `"149.000,00"`.
- Body maksimal 256 KiB (262.144 byte), dihitung sebagai byte, bukan jumlah karakter.
- Akun/grant baru memerlukan kombinasi event `purchase.paid`, payment status `paid`, item `paid`, produk allowlist, dan mata uang `IDR`.
- Produk di luar allowlist menghasilkan `ignored_product`, bukan akun baru.
- Akun dengan email yang sama dipakai kembali; password/profil akun aktif tidak direset oleh pembelian ulang.
- Setiap item/purchase memberi grant independen. Refund satu purchase tidak menghapus grant aktif dari purchase lain.
- Event versi lama diabaikan. Versi sama dengan snapshot berbeda masuk `review_required`.
- Perubahan email purchase masuk `review_required`; tidak otomatis memindahkan akun/resep.
- Paid lama yang datang setelah refund versi lebih tinggi tidak mengaktifkan kembali grant.
- Pemulihan akses oleh admin harus memakai alasan dan mengikuti audit. Paid baru tidak otomatis menimpa keputusan grant bertanda alasan `admin:`.

## 6. Signature dan contoh pengiriman

### 6.1 Header

```text
Content-Type: application/json
X-HPP-Key-Id: primary
X-HPP-Timestamp: <Unix timestamp detik saat pengiriman>
X-HPP-Signature: sha256=<64 karakter hex HMAC>
```

Endpoint memakai HMAC server-to-server, bukan cookie login atau Bearer token admin. Tidak perlu menambahkan header Origin untuk webhook ini. Header khusus `X-HPP-*` dan timestamp merupakan kontrak HppApp, bukan header payment gateway/GitHub.

Rumus:

```text
message   = timestamp_header + "." + raw_body_bytes
signature = "sha256=" + HMAC_SHA256(secret, message).hex()
```

Timestamp harus Unix detik, bukan milidetik, dan selisih jam pengirim/receiver maksimal lima menit. Sinkronkan waktu server. Body yang ditandatangani harus identik dengan body yang dikirim, termasuk whitespace/newline dan urutan serialisasi. Receiver menggunakan raw bytes serta perbandingan constant-time.

API HMAC Node.js tersedia pada [dokumentasi `createHmac`](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptocreatehmacalgorithm-key-options). Prinsip secret server-only dan verifikasi body asli juga dibahas pada [panduan webhook GitHub](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries).

### 6.2 Contoh fungsi pengiriman LRMobileID

Contoh Node.js berikut adalah referensi rancangan awal, bukan kode sender produksi. LRMobileID kini memakai `lib/server/outbound-webhook-transport.ts`; fungsi produksinya menerima body yang sudah disimpan pada outbox, bukan membuat ulang payload saat retry:

```js
import { createHmac } from "node:crypto";

export async function deliverHppEvent(rawBody, config) {
  const target = new URL(config.url);
  if (target.protocol !== "https:") {
    throw new Error("Produksi wajib HTTPS");
  }
  if (!config.keyId || !config.secret || config.secret.length < 32) {
    throw new Error("Konfigurasi pengirim belum lengkap");
  }
  const body = Buffer.from(rawBody, "utf8");
  if (body.length > 256 * 1024) throw new Error("Payload terlalu besar");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const digest = createHmac("sha256", config.secret)
    .update(timestamp + ".")
    .update(body)
    .digest("hex");

  const response = await fetch(target, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      "X-HPP-Key-Id": config.keyId,
      "X-HPP-Timestamp": timestamp,
      "X-HPP-Signature": "sha256=" + digest
    },
    body
  });

  // Tidak menganggap sembarang 2xx sebagai penerimaan kontrak HppApp.
  return {
    accepted: response.status === 200 || response.status === 202,
    status: response.status,
    retryAfter: response.headers.get("retry-after")
  };
}
```

Caller harus menangkap timeout/network error dan memperbarui attempt/next-attempt pada outbox. Jangan mencetak config, signature, body lengkap, token email, atau header rahasia ke log. Batasi respons/error yang disimpan; contoh ini sengaja tidak mencetak response body.

Validasi domain tujuan yang disepakati dilakukan pada konfigurasi caller. HTTP hanya boleh menjadi pengecualian eksplisit untuk localhost/test, bukan dengan menonaktifkan verifikasi TLS produksi.

## 7. Outbox, idempotensi, dan retry

### 7.1 Rancangan outbox LRMobileID

Ini rancangan baru, bukan tabel existing. Sesuaikan migration dengan pola LRMobileID:

| Field | Fungsi |
| --- | --- |
| `event_id`, `source`, `purchase_id`, `state_version` | Identitas stabil event/status |
| `raw_body` | JSON final immutable; jangan hanya menyimpan JSONB lalu serialisasi ulang |
| `status` | Pending/sending/delivered/failed atau blocked, sesuai rancangan pengirim |
| `attempts`, `next_attempt` | Retry terjadwal |
| `lease_until`, `locked_by` | Klaim kerja yang bisa dipulihkan setelah crash |
| `last_http_status`, `last_error_code` | Diagnostik yang disanitasi |
| `created_at`, `delivered_at` | Jejak pengiriman |

Gunakan unique constraint untuk mencegah enqueue ganda dari callback paid yang berulang, misalnya identitas integrasi + purchase + versi. Tentukan versi dan event hanya sekali pada perubahan bisnis yang nyata.

Klaim job secara atomic (misalnya `FOR UPDATE SKIP LOCKED`), commit lease, kirim HTTP dengan timeout, lalu simpan hasil. Jangan membiarkan network call menahan transaksi bisnis pembayaran. Lease kedaluwarsa harus bisa direbut kembali. Apabila crash terjadi setelah receiver menerima tetapi sebelum sender menandai delivered, kirim ulang body/event yang sama.

### 7.2 Aturan retry

- Timeout/network error, `429`, dan `5xx`: retry dengan exponential backoff dan jitter.
- Jadwal awal rekomendasi: 1, 5, 15, dan 60 menit, lalu berkala sampai 24 jam. Ini kebijakan sender yang perlu dibuat, bukan konfigurasi yang otomatis tersedia.
- Ikuti `Retry-After` pada `429`.
- `400`, `401`, `409`, `413`, `415`, dan `422`: hentikan retry otomatis tanpa perbaikan; tampilkan untuk operator.
- `503` konfigurasi dapat diulang sebagai 5xx, tetapi beri alert dan perbaiki environment; retry saja tidak memperbaiki konfigurasi.
- Setiap delivery membuat timestamp/signature baru. `event_id`, `occurred_at`, `state_version`, dan byte body tetap sama.
- `200`/`202` mengakhiri delivery sender, bukan bukti email sudah diterima pembeli.
- Setelah retry 24 jam habis, sediakan resend admin dengan event ID/body tetap, timestamp baru, dan audit alasan.

Jika event pertama sudah diterima, jangan mengedit payload lalu memakai event ID yang sama. Perubahan bisnis yang sah harus mempunyai event ID baru dan versi berikutnya. Perbaikan atas event invalid yang pasti belum diterima dapat dirancang tersendiri; jika status penerimaan tidak pasti, rekonsiliasi dahulu agar tidak merusak dedup.

### 7.3 Respons receiver

| HTTP | Arti/tindakan |
| --- | --- |
| `202` + `ACCEPTED` | Event baru tersimpan; worker HppApp akan memproses |
| `200` + `DUPLICATE` | Byte body/event identik sudah tersimpan |
| `400` | JSON invalid |
| `401` | Signature/key/timestamp/source invalid |
| `409` | Event ID sama tetapi body berbeda; perlu rekonsiliasi |
| `413` | Body lebih dari 256 KiB |
| `415` | Content-Type bukan `application/json` |
| `422` | Schema invalid atau ID item duplikat |
| `429` | Batas request tercapai; ikuti `Retry-After` |
| `500`/5xx | Gangguan penerimaan; sender retry |
| `503` | Backend/webhook belum dikonfigurasi atau layanan belum siap |

Limit endpoint saat ini adalah 120 request per 60 detik per key ID. Penolakan juga dapat terjadi pada proxy sebelum mencapai aplikasi. Browser GET ke endpoint dapat menghasilkan `405`; itu bukan bukti webhook POST gagal.

## 8. Pengujian lokal dan staging

### 8.1 Dua tingkat pengujian

1. Pengujian otomatis HppApp: membuktikan kontrak, provisioning, grant, dedup, dan alur browser dengan database uji.
2. Pengujian end-to-end LRMobileID → HppApp: membuktikan adapter sender, perubahan pembayaran, outbox, jaringan, receiver, worker, dan email.

Fixture manual hanya menguji sisi receiver. Jangan menyatakan integrasi kedua aplikasi selesai hanya karena fixture berhasil.

### 8.2 Tes otomatis HppApp

Siapkan database khusus bernama `hpp_test` atau `hpp_test_suffix` di localhost/127.0.0.1, dengan role yang memang boleh memakai database itu. Ganti URI contoh dengan kredensial uji, bukan produksi:

```bash
npm run typecheck
HPP_TEST_DATABASE_URL='postgresql://ROLE_UJI:PASSWORD_UJI@127.0.0.1:5432/hpp_test' npm run test
npm run build
npx playwright install chromium
HPP_TEST_DATABASE_URL='postgresql://ROLE_UJI:PASSWORD_UJI@127.0.0.1:5432/hpp_test' SMTP_HOST='' SMTP_USER='' SMTP_PASSWORD='' EMAIL_FROM='' npm run test:e2e
```

URI di atas mengandung placeholder. Jangan mengetik kredensial asli ke history shell; gunakan konfigurasi uji yang aman atau environment dari secret manager. Backend integration tests dilewati bila `HPP_TEST_DATABASE_URL` tidak diisi. Runner menolak host/nama database di luar batas uji. Playwright memakai production server sementara port 3027; kosongkan port tersebut dahulu. Data uji ber-ID unik tetap ada untuk inspeksi.

### 8.3 Receiver lokal terpisah untuk fixture manual

Jangan memakai database HppApp harian atau worker produksi. Siapkan database `hpp_test_integrasi` tersendiri, role uji, dan file `.env.integration.local` dengan editor. File ini termasuk pola `.env*` yang diabaikan Git.

```dotenv
APP_BASE_URL=http://127.0.0.1:3028
DATABASE_URL=postgresql://ROLE_UJI:PASSWORD_UJI@127.0.0.1:5432/hpp_test_integrasi
AUTH_SECRET=GANTI_SECRET_AUTH_UJI_ACAK_MINIMAL_32_KARAKTER
PURCHASE_SOURCE_ID=app.lrmobileid.com
PURCHASE_WEBHOOK_KEYS='{"primary":{"source":"app.lrmobileid.com","secret":"GANTI_SECRET_WEBHOOK_UJI_ACAK_MINIMAL_32_KARAKTER"}}'
ELIGIBLE_AI_FOOD_PRODUCT_IDS=ID_PRODUK_ASLI
EMAIL_FROM="HppApp <akses@mailer.lrmobileid.com>"
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=false
SMTP_USER=
SMTP_PASSWORD=
SUPPORT_CONTACT_URL=http://127.0.0.1:3028/login
```

Ganti URI/secret/produk sebelum menjalankan. Secret uji harus berbeda dari produksi. SMTP sengaja kosong agar fixture tidak mengirim email sungguhan; email akan berstatus gagal/retry dan itu diharapkan pada tahap ini. Untuk menguji tautan aktivasi, gunakan SMTP penampung lokal yang Anda siapkan atau Brevo staging dengan inbox yang Anda kendalikan.

Jalankan migrasi sekali, lalu web server dan worker pada terminal terpisah. Entry point langsung memastikan file environment uji yang dipakai:

```bash
node --env-file=.env.integration.local --import tsx scripts/migrate.ts
node --env-file=.env.integration.local node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3028
```

Di terminal terpisah:

```bash
node --env-file=.env.integration.local --import tsx scripts/worker.ts
```

Jika Next dev harian masih berjalan dari checkout yang sama, jangan menjalankan dev kedua yang memperebutkan lock `.next/dev`. Gunakan checkout uji terpisah, atau hentikan dev harian dengan aman terlebih dahulu. Jangan menghentikan PostgreSQL atau service proyek lain.

Environment proses di atas mengungguli `.env.local`; tetap kosongkan seluruh kredensial SMTP di file uji agar konfigurasi email harian tidak terbawa. Tidak ada kebutuhan mengubah environment produksi.

### 8.4 Kirim fixture lokal

Dengan editor, salin JSON paid pada bagian 5.1 ke file `webhook-paid.test.json`. Simpan di direktori uji, gunakan ID/email sintetis, dan jangan commit fixture berisi data pelanggan. Cocokkan product ID dengan allowlist uji. Contoh berikut hanya mengizinkan tujuan localhost/127.0.0.1 port 3028, memakai konfigurasi receiver uji, dan tidak mencetak secret:

```bash
node --env-file=.env.integration.local --input-type=module - webhook-paid.test.json <<'NODE'
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = new URL(process.env.APP_BASE_URL);
if (base.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(base.hostname) ||
    base.port !== '3028') {
  throw new Error('Contoh ini hanya boleh dikirim ke receiver uji lokal port 3028');
}
const raw = readFileSync(process.argv[2]);
if (raw.length > 256 * 1024) throw new Error('Body terlalu besar');
const keys = JSON.parse(process.env.PURCHASE_WEBHOOK_KEYS || '{}');
const keyId = 'primary';
const key = keys[keyId];
if (!key || key.secret.length < 32 || key.secret.includes('GANTI_') ||
    key.secret.includes('CHANGE_ME') || key.source !== process.env.PURCHASE_SOURCE_ID) {
  throw new Error('Ganti dan cocokkan konfigurasi key uji terlebih dahulu');
}
const payload = JSON.parse(raw.toString('utf8'));
if (payload.source !== key.source) throw new Error('Source fixture tidak cocok');
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = 'sha256=' + createHmac('sha256', key.secret)
  .update(timestamp + '.').update(raw).digest('hex');
const response = await fetch(new URL('/api/webhooks/purchases', base), {
  method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
  headers: {
    'Content-Type': 'application/json',
    'X-HPP-Key-Id': keyId,
    'X-HPP-Timestamp': timestamp,
    'X-HPP-Signature': signature
  },
  body: raw
});
const result = await response.json().catch(() => ({}));
console.log({status: response.status, code: result.code});
if (![200, 202].includes(response.status)) process.exitCode = 1;
NODE
```

Jalankan ulang perintah tanpa mengedit file: hasil pertama `202 ACCEPTED`, berikutnya `200 DUPLICATE`. Jangan memperbarui `occurred_at` saat retry. Untuk menguji conflict, ubah fixture pada lingkungan uji dengan event ID tetap: hasil harus `409 EVENT_CONFLICT`.

Untuk refund, simpan JSON bagian 5.2 dalam file uji terpisah, cocokkan purchase/item/email dengan paid, lalu ganti argumen nama file pada perintah. Untuk purchase baru, buat purchase ID, item ID, dan event ID baru. Jangan menjalankan fixture terhadap produksi.

### 8.5 Uji dari LRMobileID

Setelah sender diimplementasikan:

1. Gunakan lingkungan staging LRMobileID dan HppApp, database terpisah, gateway sandbox bila tersedia, secret staging, dan inbox terkontrol.
2. Beli produk berhak atau jalankan konfirmasi manual yang sah di staging.
3. Pastikan perubahan paid menyimpan satu event outbox. Callback berulang tidak membuat event versi paid baru.
4. Worker sender harus mendapat `202` atau `200`, lalu menandai delivered.
5. HppApp harus menunjukkan webhook `processed`, akun `pending_activation`, serta grant `active`.
6. Antrean email harus benar-benar mengirim email `activation`. Job perantara `activation_request` berstatus sent saja belum membuktikan pengiriman SMTP.
7. Buka tautan dari inbox, buat password 12–128 karakter, login, dan gunakan kalkulator. Tautan aktivasi berlaku 24 jam dan sekali pakai.
8. Uji refund terverifikasi versi berikutnya, grant terkait menjadi `revoked`. Bila akun punya grant lain yang masih aktif, akses kalkulator tetap boleh tersedia.
9. Uji seluruh skenario checklist bagian 12, termasuk gangguan jaringan/worker/SMTP.

Production LRMobileID tidak dapat memanggil localhost laptop. Untuk pengujian jarak jauh, utamakan staging HTTPS. Jika memakai tunnel sementara, arahkan hanya ke lingkungan uji, gunakan key uji, lindungi akses, dan hentikan tunnel setelah selesai; jangan membuka database ke internet.

## 9. Pemantauan dan pemulihan

### 9.1 Di LRMobileID

Panel/log sender perlu menampilkan event ID, purchase ID, versi, umur pending, jumlah attempt, HTTP terakhir, serta error yang disanitasi. Jangan menampilkan secret, raw payload pelanggan, atau signature.

Event belum delivered menjadi tanggung jawab sender. Setelah `202`/`200`, pemrosesan domain menjadi tanggung jawab inbox HppApp. Jangan resend paid dengan versi baru hanya untuk memaksa email terkirim.

### 9.2 Di HppApp

- `/admin/integrations`: webhook, stage/status/attempt, email jobs, heartbeat worker, retry failed jobs.
- `/admin/access`: cari email, periksa grant, cabut/pulihkan akses dengan alasan, kirim ulang aktivasi untuk akun pending.
- Retry admin membutuhkan alasan minimal lima karakter dan menulis audit.
- Retry UI hanya tersedia bagi job `failed`. `review_required` dan `ignored` bukan job failed yang bisa diklik retry langsung.
- Worker webhook/email mencoba otomatis paling banyak 10 attempt, dengan backoff mulai sekitar 60 detik dan dibatasi 60 menit. Failed job yang sudah mencapai batas memerlukan pemulihan operator.
- Target operasional dari PRD: akses diproses dalam 60 detik pada kondisi normal; ini target, bukan jaminan SLA.
- Gagal SMTP tidak menghapus akun/grant. Akun pending tetap membutuhkan aktivasi sebelum memakai kalkulator.

Diagnosis baca-saja pada database HppApp, hanya oleh operator berwenang:

```sql
SELECT source, event_id, status, stage, attempts, last_error, created_at, next_attempt
FROM webhook_event
ORDER BY created_at DESC
LIMIT 20;

SELECT kind, status, attempts, last_error, created_at, next_attempt
FROM email_outbox
ORDER BY created_at DESC
LIMIT 20;

SELECT name, last_seen, now() - last_seen AS age
FROM worker_health;
```

Query ini tidak menampilkan payload/token. Heartbeat lama menunjukkan worker berhenti, tidak tersambung ke database, atau memakai database yang berbeda. Jangan menjalankan update manual untuk memaksa processed atau active tanpa rekonsiliasi dan audit.

### 9.3 Kasus khusus

- `version_conflict`: bandingkan status asli purchase dan event. Buat perubahan/koreksi terverifikasi dengan versi lebih tinggi bila memang sah; jangan mengubah body event yang sudah diterima.
- `email_changed`: verifikasi kepemilikan kedua email. Tidak ada transfer akun otomatis; grant restore tidak memindahkan akun atau resep.
- `partial_refund`: tentukan kebijakan bisnis per item. Cabut/pulihkan grant melalui admin bila keputusan membutuhkan perubahan akses.
- `unsupported_currency`: tentukan dukungan mata uang/adapter sebelum mengirim ulang; jangan memalsukan currency.
- Salah allowlist: perbaiki kedua sisi dan rekonsiliasi purchase. Event `ignored_product` yang sudah diterima tidak diproses ulang hanya dengan resend body/event yang sama. Siapkan prosedur koreksi versi baru atau tooling replay terkontrol; fitur replay ignored belum tersedia pada UI saat ini.
- Akun suspended: jangan mencabut suspension hanya karena purchase paid baru. Grant aktif saja tidak membuka kalkulator bagi akun suspended.
- Aktivasi kedaluwarsa: gunakan kirim ulang aktivasi, bukan mengulang paid sebagai purchase baru. Email reset password berlaku 60 menit dan tidak menggantikan aktivasi akun pending.

## 10. Troubleshooting

| Gejala | Pemeriksaan/tindakan |
| --- | --- |
| Tidak ada event di HppApp | Sender belum dibuat/berjalan, URL salah, outbox tidak enqueue, DNS/TLS/firewall, atau status provider belum terverifikasi |
| `503 BACKEND_NOT_CONFIGURED` | Periksa `DATABASE_URL`, `AUTH_SECRET`, `APP_BASE_URL`; pastikan proses memakai env yang benar |
| `503 WEBHOOK_CONFIG` | Periksa source, JSON keys, secret minimal 32 karakter, dan allowlist tidak kosong |
| `401 INVALID_SIGNATURE` | Key ID/secret berbeda, jam meleset, timestamp milidetik, atau body berbeda dari yang ditandatangani |
| `401 INVALID_SOURCE` | Source payload tidak sama dengan source key yang valid |
| `409 EVENT_CONFLICT` | Event ID dipakai dengan byte body berbeda, termasuk whitespace atau serialisasi ulang |
| `422 INVALID_WEBHOOK` | Angka uang bukan string, schema version salah tipe, ID/nama terlalu panjang, timestamp payload invalid, atau status tidak sesuai enum |
| `422 DUPLICATE_ITEMS` | Ada dua item memakai ID sama dalam satu payload |
| `415 CONTENT_TYPE` | Gunakan `application/json`, boleh disertai charset |
| `405` saat dibuka browser | Endpoint hanya menerima POST, bukan halaman web GET |
| `413` | Payload melebihi 256 KiB atau batas proxy; kurangi data ke kontrak minimum |
| `429` | Ikuti `Retry-After`; jangan membanjiri endpoint saat retry banyak job |
| `202` tetapi akun belum ada | Worker mati, job pending/failed, produk tidak eligible, currency tidak didukung, atau review diperlukan |
| `ignored_product` | Cocokkan ID asli produk dengan allowlist, bukan nama/slug |
| `older_version` | Event datang terlambat; receiver sudah memiliki versi lebih baru |
| Grant active tetapi gagal masuk kalkulator | Akun belum aktivasi/suspended, tidak ada grant aktif lain yang berlaku, atau session bermasalah |
| Email tidak sampai | Periksa job `activation`, From terverifikasi, SMTP credentials, worker, spam folder, serta log/delivery Brevo |
| `SMTP_NOT_CONFIGURED` | SMTP host/From kosong; pada fixture tanpa SMTP ini memang diharapkan |
| `SMTP_SEND_FAILED` | Periksa koneksi, TLS, autentikasi, izin sender, dan provider; jangan aktifkan debug yang membocorkan key |
| Tautan email menuju localhost/domain lama | `APP_BASE_URL` salah; restart worker lalu buat tautan aktivasi baru melalui prosedur admin |
| Refund tidak mencabut grant | Event refund belum dikirim, item ID berubah, status item salah, versi lebih lama, currency unsupported, atau grant lain masih aktif |

Untuk investigasi, korelasikan purchase ID, event ID, versi, dan stage antara sender/receiver. Jangan menyalin dump pelanggan, token, atau seluruh environment ke chat/log publik.

## 11. Keamanan, rotasi, dan peluncuran

### 11.1 Batas keamanan

- Secret berbeda untuk auth, webhook, database, dan SMTP; pisahkan pula staging/produksi.
- File env, `SMTP APIKEY.txt`, database dump, browser traces berisi token, dan fixture pelanggan tidak masuk Git. `.env.example` hanya berisi placeholder.
- Batasi izin file secret dan akses backup. Rotasi kredensial yang sudah terpapar.
- Jangan mengirim password pengguna di webhook; cukup data kontrak minimum.
- HTTPS produksi, sertifikat valid, server clock tersinkronisasi, dan proxy tidak memodifikasi raw body/header signature.
- Tidak perlu membuka CORS untuk komunikasi server-to-server. Jangan melemahkan proteksi origin endpoint akun/admin agar webhook bekerja.
- Jangan membuat endpoint pengirim publik yang bisa dipakai pelanggan untuk menandai dirinya paid.
- Bersihkan query token aktivasi/reset dari access log dan analytics. Database email outbox dapat berisi tautan rahasia sementara; lindungi aksesnya.
- Data diagnostik webhook terminal dipangkas setelah 30 hari oleh maintenance; dedup hash, state purchase, dan tombstone tetap dipertahankan. Review/failed disimpan untuk pemulihan.
- Pada VPS bersama, gunakan database, role, port, env, dan service HppApp tersendiri. Jangan mengubah LRMobileID/BGWHD secara tidak terkait.

### 11.2 Rotasi key webhook

1. Buat secret baru untuk key ID baru, misalnya `secondary`.
2. Tambahkan key baru di receiver, sambil mempertahankan key lama dengan source sama:

```dotenv
PURCHASE_WEBHOOK_KEYS='{"primary":{"source":"app.lrmobileid.com","secret":"GANTI_SECRET_LAMA"},"secondary":{"source":"app.lrmobileid.com","secret":"GANTI_SECRET_BARU"}}'
```

3. Restart receiver dan worker dengan konfigurasi baru.
4. Ganti key ID/secret sender ke `secondary`, lalu restart sender dan verifikasi event.
5. Pertahankan key lama selama masa transisi yang mencakup antrean/retry lama atau pastikan seluruh delivery lama memakai key baru secara aman. Body/event tetap tidak berubah.
6. Hapus key lama setelah tidak digunakan; restart proses terkait dan verifikasi.

Jika secret terkompromi, pencabutan segera dapat lebih penting dari kelancaran antrean. Koordinasikan pengiriman ulang dengan key baru tanpa mengganti event ID/body.

### 11.3 Urutan pilot/rilis

1. Domain dan ID produk bundle sudah ditetapkan. Lengkapi kebijakan refund dan dukungan currency bila menjual ke luar IDR.
2. Sender/outbox paid LRMobileID sudah aktif; implementasikan event refund/chargeback terverifikasi dan uji seluruh jalurnya sebelum mengandalkan pencabutan akses otomatis.
3. Jalankan tes otomatis, fixture, dan end-to-end staging.
4. Siapkan backup database dan rollback; deploy HppApp sebagai layanan terpisah dengan worker sehat.
5. Pasang konfigurasi/key produksi kedua sisi tanpa menyimpannya ke Git.
6. Aktifkan untuk produk pilot dan pembelian terkontrol setelah persetujuan operator.
7. Pantau outbox sender, inbox receiver, email, heartbeat, dan grant sebelum memperluas penggunaan.
8. Bila bermasalah, hentikan delivery sender/flag integrasi secara terkontrol tanpa menghapus antrean, database, atau grant. Rekonsiliasi event yang sudah diterima sebelum mengaktifkan kembali.

Pembelian historis tidak otomatis dikirim. Jika dibutuhkan, buat backfill terkontrol: hanya paid terverifikasi dan belum refund, dedup terhadap event/grant yang ada, pembatasan batch, serta keputusan eksplisit apakah email aktivasi perlu dikirim. Jangan backfill massal ke pembeli tanpa persetujuan dan pemeriksaan.

## 12. Checklist penerimaan

- [ ] Domain HppApp HTTPS dapat diakses server LRMobileID.
- [ ] ID produk asli, source, key ID, serta secret kedua sisi konsisten.
- [ ] Konfigurasi uji dan produksi terpisah; tidak ada secret dalam Git/dokumen/log.
- [ ] Sender benar-benar diimplementasikan; bukan sekadar penambahan env.
- [ ] Paid menyimpan perubahan status + versi + outbox dalam satu transaksi.
- [ ] Seluruh jalur pembelian yang berlaku, termasuk Sociabuzz/manual, tercakup.
- [ ] Pembelian eligible menghasilkan akun/grant/email aktivasi dan pembeli bisa login.
- [ ] Pembelian noneligible tidak menghasilkan akses.
- [ ] Callback/delivery ulang tidak menggandakan akun/grant/email.
- [ ] Byte body/event identik menghasilkan `200`; body berbeda dengan event ID sama menghasilkan `409`.
- [ ] Signature salah dan timestamp lama menghasilkan `401`.
- [ ] Timeout setelah receiver menerima dapat dipulihkan oleh retry identik.
- [ ] Web server dan kedua worker memiliki restart otomatis serta pemantauan.
- [ ] Worker HppApp berhenti tidak menghilangkan event yang sudah diterima.
- [ ] Gagal SMTP tidak menghilangkan grant; email berhasil dipulihkan tanpa paid palsu.
- [ ] Akun aktif yang membeli lagi tidak direset password/profilnya.
- [ ] Refund penuh/chargeback versi baru mencabut grant item yang tepat.
- [ ] Refund tiba sebelum paid lama tetap mencegah aktivasi oleh event lama.
- [ ] Refund sebagian/perubahan email/versi bentrok masuk tinjauan yang ditangani operator.
- [ ] Grant dari purchase lain tetap independen ketika satu purchase direfund.
- [ ] Transaksi MYR/settlement/bundle punya kebijakan eksplisit; tidak dipalsukan sebagai IDR.
- [ ] Rotasi key, resend failed, rollback, dan backfill memiliki prosedur yang diuji.
- [ ] Pembelian pilot end-to-end selesai; fixture receiver saja tidak dianggap selesai integrasi.

## 13. Rujukan

Sumber utama kontrak dan perilaku aplikasi:

- [PRD](./PRD.md), khususnya bagian 13–16, 19, dan 22.
- [README HppApp](./README.md).
- [Schema, signature, dan penerimaan webhook](./src/server/purchases.ts).
- [Route POST webhook](./src/app/api/webhooks/purchases/route.ts).
- [Worker provisioning/grant](./src/server/worker.ts).
- [Outbox email](./src/server/email.ts) dan [konfigurasi SMTP](./src/server/smtp.ts).
- [Schema database domain](./db/domain.sql).
- [Tes backend](./tests/backend.test.ts) dan [tes browser](./tests/e2e/app.spec.ts).

Rujukan eksternal untuk mekanisme keamanan dan SMTP, bukan pengganti kontrak khusus HppApp:

- [Node.js 22: createHmac](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptocreatehmacalgorithm-key-options).
- [GitHub: validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries).
- [Brevo: transactional email using SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP).

Dokumen ini tidak memuat secret asli, password admin, atau data pembeli. Perubahan implementasi sender, konfigurasi produksi, publikasi GitHub, dan deployment tetap memerlukan pekerjaan serta otorisasi sesuai lingkupnya.
