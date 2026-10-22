# Penyiapan dan rilis KulinerKit di VPS ProjectLr

Status per 22 Oktober 2026: rilis `20261022-kulinerkit-79453e9` (commit `79453e9`) **aktif** di `https://hpp.lrmobileid.com`. Target Untung & Titik Impas kini memakai tiga isian untuk target usaha keseluruhan; perkiraan jumlah produk memakai riwayat rekap jika sudah cukup. Build VPS dan smoke test kandidat internal lulus. Setelah pengalihan, login KulinerKit, LRMobileID, dan BGWHD masing-masing memberi HTTP 200 dari jalur internal dan HTTPS publik; halaman Target Untung mengarahkan pengunjung yang belum login (307), dan API-nya menolak akses tamu (401). Web dan worker aktif, masing-masing `NRestarts=0`; `nginx -t` lulus, dan tidak ada galat tingkat `err` pada jurnal kedua unit saat pemeriksaan. Ruang disk VPS tersisa 9,5 GB (80% terpakai). Backup pra-rilis `/var/backups/kulinerkit/pre-release-79453e9.dump` dan `pre-release-79453e9-media.tgz` lulus `pg_restore --list` dan `gzip -t`; rilis sebelumnya `20261022-kulinerkit-05425dd` disimpan untuk rollback kode. Admin `wahiddr734@gmail.com` telah dibuat pada rilis awal; penerimaan email di inbox belum diverifikasi.

Rilis ini menambahkan tabel `profit_target` secara idempoten. Sebelum pengalihan, kandidat dibangun dan diuji di port loopback `3103`; setelah rilis aktif, proses kandidat dihentikan. Tes lokal untuk API, hitungan target, serta alur browser desktop dan ponsel lulus. Migrasi hanya menambah tabel, sehingga kode rilis sebelumnya masih dapat dijalankan bila perlu rollback kode.

Domain HPP kini lewat Cloudflare Proxied dengan sertifikat origin Let’s Encrypt. Ketika menguji origin lokal, gunakan `curl --noproxy '*' --resolve hpp.lrmobileid.com:443:127.0.0.1 https://hpp.lrmobileid.com/login`; tanpa `--noproxy`, proxy lingkungan dapat mengembalikan 503 palsu. Jangan mengubah firewall bersama secara spekulatif.

Checkout satu produk dikonfigurasi: produk LRMobileID `prd_344a58e2-23f3-4c33-84d0-cf0f9c52f9d0` memberi hak Kalkulator HPP **dan** Galeri Prompt. Kedua allowlist HPP menunjuk ID ini; koleksi dan 26 kartu prompt telah dipindahkan ke ID yang sama. Endpoint outbound LRMobileID `hook_815e55aa-d7ce-4569-982e-8a291145a97d` aktif, format `hpp`, source `app.lrmobileid.com`, key ID `primary`, hanya untuk produk ini. Shared secret tersimpan terenkripsi di LRMobileID dan cocok dengan receiver HPP; jangan salin nilainya ke dokumen atau log. Uji transport awal bertanda tangan membuktikan jalur dan signature, bukan keberhasilan transaksi. Pada pemeriksaan rilis terbaru, database HPP berisi satu purchase state dan dua grant. Pengiriman email oleh SMTP tidak membuktikan penerimaan di inbox pelanggan.

Backup sebelum pemetaan produk dan pemasangan endpoint juga masih tersedia: `/var/backups/kulinerkit/pre-bundle-hpp-20261021.dump`, `pre-bundle-lrmobileid-20261021.dump`, dan `pre-bundle-media-20261021.tgz`. Dump lolos `pg_restore --list`, arsip media lolos `gzip -t`; direktori backup root-only. LRMobileID sender saat ini hanya menghasilkan event `purchase.paid`; refund/chargeback belum otomatis dikirim, sehingga pencabutan akses harus ditangani operator sampai alur tersebut diimplementasikan.

## Isolasi yang sudah dibuat

| Komponen | KulinerKit | Tetangga yang tidak diubah |
| --- | --- | --- |
| User Unix | `kulinerkit` | `lrmobileid`, layanan BGWHD |
| Kode rilis | `/srv/kulinerkit/releases/`, symlink `/srv/kulinerkit/current` saat rilis | `/var/www/lrmobileid`, `/srv/bgwhd-production` |
| Data gambar privat | `/var/lib/kulinerkit/prompt-gallery` | storage aplikasi lain |
| PostgreSQL | database dan role `kulinerkit`, login melalui Unix socket/peer; tidak ada password DB di file | database/role `lrmobileid` |
| Environment | `/etc/kulinerkit/kulinerkit.env`, root:`kulinerkit`, mode `0640` | environment aplikasi lain |
| Proses | `kulinerkit-web.service` dan `kulinerkit-worker.service`, enabled/active | service aplikasi lain |
| Port | `127.0.0.1:3102` | LRMobileID `127.0.0.1:3000`, BGWHD `127.0.0.1:3001` |
| Web | vhost Nginx `kulinerkit`, sertifikat tersendiri `hpp.lrmobileid.com` | vhost dan sertifikat tetangga |

File konfigurasi sumber ada di direktori ini. `nginx-live.conf` sedang aktif; salinan konfigurasi pra-rilis ada di `/etc/nginx/sites-available/kulinerkit.pending-20261021` untuk rollback. Hanya vhost HPP yang dialihkan. SMTP Brevo menggunakan port **2525** dengan STARTTLS karena port 587 dari VPS timeout; `smtp:verify` di 2525 berhasil tanpa mengirim email. [Brevo mendukung port 2525](https://help.brevo.com/hc/en-us/articles/10905415650322-Which-SMTP-port-should-I-use-Port-587-465-or-2525).

Impor satu kali memakai `PROMPT_IMPORT_ORIGIN=http://127.0.0.1:3000` karena VPS tidak dapat menjangkau IP publik Cloudflare milik LRMobileID dari dalam. Importer hanya mengizinkan pengecualian HTTP untuk origin loopback itu; gambar tetap divalidasi dan disimpan di storage privat HPP. Patch importer ini dipasang setelah ekstraksi arsip awal, sehingga hash pada nama rilis mencatat arsip awal, bukan seluruh isi direktori setelah patch. Sertakan versi importer terbaru saat membuat artefak rilis berikutnya.

## Prasyarat sebelum rilis

1. Pastikan kode yang akan dirilis sudah committed/terarsip secara utuh dan lolos `npm test`, `npm run typecheck`, dan `npm run build` secara lokal. Jangan menganggap working tree lokal atau push GitHub otomatis menjadi rilis VPS.
2. Periksa ulang ruang disk (`df -h /`), kesehatan `app.lrmobileid.com` dan `bgwhd.my.id`, serta `sudo nginx -t`. Saat penyiapan tersisa sekitar 14 GB; angka ini dapat berubah.
3. Siapkan nilai produksi sesuai `.env.example`: `APP_BASE_URL=https://hpp.lrmobileid.com`, `DATABASE_URL=postgresql://kulinerkit@/kulinerkit?host=/var/run/postgresql`, `AUTH_SECRET` acak minimal 32 karakter, `PROMPT_MEDIA_ROOT=/var/lib/kulinerkit/prompt-gallery`, identitas source/product webhook, SMTP Brevo, `EMAIL_FROM`, dan kontak dukungan. `prepare-env.sh` menerima **hanya tujuh baris pengaturan SMTP** melalui stdin, lalu membuat rahasia auth/webhook baru di VPS. Jangan unggah `.env.local` utuh atau menaruh kunci di Git/log/riwayat shell. Default kedua allowlist produk di `prepare-env.sh` menunjuk ID bundle di atas; pada rilis ulang cocokkan ulang dengan produk LRMobileID aktif dan endpoint outbound, jangan mengganti secret produksi tanpa rotasi terkoordinasi.
4. Buat `/etc/kulinerkit/kulinerkit.env` dengan hak `root:kulinerkit 0640`. Direktori `/etc/kulinerkit` sudah disiapkan `0750`. `scripts/migrate.ts` dan `scripts/worker.ts` menggunakan `--env-file=.env.local`, jadi setiap direktori rilis perlu symlink `.env.local` menuju file environment tersebut. Pastikan format nilai cocok dengan parser Node env-file dan systemd EnvironmentFile, terutama JSON `PURCHASE_WEBHOOK_KEYS`.
5. Tinjau konfigurasi trusted proxy/rate limit Better Auth sesuai jalur akses aktual. Vhost live mempercayai `CF-Connecting-IP` hanya dari CIDR Cloudflare resmi, lalu menimpa `X-Real-IP`/`X-Forwarded-For` dengan alamat hasil verifikasi. Better Auth hanya membaca `X-Real-IP`. Bandingkan ulang CIDR di `nginx-live.conf` dengan [daftar resmi Cloudflare](https://www.cloudflare.com/ips/) sebelum rilis dan setelah perubahan jaringan; jangan mempercayai header IP arbitrer.
6. Siapkan kebijakan backup database dan `/var/lib/kulinerkit/prompt-gallery` sebelum menerima pelanggan. Backup pra-migrasi dan pra-impor di `/var/backups/kulinerkit/` telah diuji dengan `pg_restore --list`. **Jadwal backup otomatis belum dibuat**; jangan menganggap backup satu kali ini cukup untuk operasi pelanggan. Migrasi rilis berikutnya harus didahului backup baru yang dapat dipulihkan.

## Urutan aktivasi rilis pertama (catatan untuk rilis ulang)

1. Salin artefak sumber rilis ke direktori baru di `/srv/kulinerkit/releases/<id-rilis>` dan pastikan dimiliki `kulinerkit:kulinerkit`. Jangan menimpa direktori rilis lama atau aplikasi tetangga.
2. Sebagai user `kulinerkit`, tautkan `.env.local` ke `/etc/kulinerkit/kulinerkit.env`, jalankan `npm ci`, `npm run build`, lalu `npm run db:migrate` di direktori rilis baru. `npm ci` harus menyertakan dev dependency karena `tsx` dipakai migrasi/worker.
3. Periksa skema DB dan jalankan web secara sementara pada `127.0.0.1:3102` dengan konfigurasi rilis. Uji login, sesi/logout, halaman customer/admin, penyimpanan resep, gambar prompt, dan worker secara internal. Jangan gunakan transaksi pembelian nyata sebagai smoke test.
4. Setelah lulus, arahkan symlink `/srv/kulinerkit/current` secara atomik ke rilis baru, aktifkan `kulinerkit-web.service` dan `kulinerkit-worker.service`, dan periksa `systemctl status`/journal serta endpoint internal. Pastikan tidak ada restart berulang.
5. Ganti hanya `/etc/nginx/sites-available/kulinerkit` dengan `nginx-live.conf`, jalankan `nginx -t`, kemudian reload Nginx. Periksa HTTPS publik, login/logout, gambar privat, serta respons LRMobileID dan BGWHD. Jangan menyalakan vhost live jika web belum sehat.
6. Verifikasi webhook memakai event uji resmi dari pengirim, termasuk signature, idempotensi, retry, dan akses customer. Uji transport bertanda tangan dengan payload invalid sudah lulus, tetapi alur pembelian nyata dan email aktivasi pelanggan belum diuji. Ikuti [panduan integrasi](../../PANDUAN-INTEGRASI-WEBHOOK.md), terutama batas refund/chargeback yang belum otomatis.

## Rollback

Jika web gagal setelah aktivasi, kembalikan vhost KulinerKit ke `nginx-pending.conf`, uji `nginx -t`, reload Nginx, dan hentikan kedua unit KulinerKit. Untuk regresi kode tanpa perubahan skema yang tidak kompatibel, arahkan `current` ke rilis sebelumnya lalu hidupkan kembali unit dan uji. Jangan otomatis melakukan rollback database setelah migrasi; gunakan backup dan rencana pemulihan yang telah diverifikasi. Periksa kembali kedua aplikasi tetangga setelah setiap perubahan Nginx.

Saat kondisi pending, `https://hpp.lrmobileid.com` memberi 503 dengan TLS valid. Pada kondisi aktif saat ini, `/login` memberi 200. LRMobileID dan BGWHD sama-sama memberi 200 pada pemeriksaan pasca-aktivasi.
