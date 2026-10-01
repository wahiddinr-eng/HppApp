# PRD Kalkulator HPP Kuliner

Versi: 1.0  
Tanggal: 1 Oktober 2026  
Pemilik produk: Pengelola AI Prompt Food  
Platform: aplikasi web Next.js  
Bahasa dan mata uang: Bahasa Indonesia dan Rupiah  
Dokumen utama pengembangan: `PRD.md`

## 1 Ringkasan produk

Kalkulator HPP Kuliner membantu pembeli AI Prompt Food menghitung biaya produksi makanan atau minuman per batch dan per satuan hasil, menentukan harga jual berdasarkan target margin, serta menyimpan dan mengekspor laporan perhitungannya.

Aplikasi memakai formulir modern berbasis blok. Pengguna mengisi informasi produk, bahan baku, kemasan, tenaga kerja, biaya produksi lainnya, pajak, dan pengaturan harga jual. Label menggunakan istilah singkat seperti **Nama produk**, **Jumlah digunakan**, dan **Harga per kg**. Petunjuk menjelaskan arti kolom tanpa mengubah formulir menjadi percakapan.

Akses diberikan melalui pembelian AI Prompt Food di `app.lrmobileid.com`. Setelah pembayaran dikonfirmasi oleh sistem penjualan, webhook membuat akun aplikasi HPP bila email pembeli belum terdaftar dan memberikan hak akses. Pembeli membuat password melalui tautan email, lalu login untuk memakai aplikasi.

Hasil yang ditampilkan merupakan estimasi berdasarkan biaya dan pengaturan yang diisi. Aplikasi menampilkan komponen yang belum dihitung sehingga pengguna dapat menilai kelengkapan hasil. Rekomendasi harga berasal dari biaya dan target margin pengguna; aplikasi tidak menentukan harga pasar secara otomatis.

## 2 Keputusan produk

### 2.1 Kebutuhan yang telah ditetapkan

| ID | Keputusan |
|---|---|
| D01 | Aplikasi web menggunakan Next.js dan mewajibkan akun untuk pemakaian. |
| D02 | Pembelian AI Prompt Food yang berhasil menjadi dasar pembuatan akun dan pemberian akses melalui webhook. |
| D03 | Form menggunakan blok input dengan label biasa, bukan pertanyaan interaktif. |
| D04 | Blok pertama memuat nama produk, nama usaha atau UMKM, ukuran batch, dan satuan hasil. |
| D05 | Bahan baku dapat ditambahkan berulang, dengan jumlah, satuan, harga, dan subtotal otomatis. |
| D06 | Perhitungan mencakup kemasan, tenaga kerja, listrik atau biaya produksi lain, dan pengaturan pajak. |
| D07 | Output memuat batas biaya, saran harga jual, target margin yang dapat diubah, dan harga pilihan pengguna. |
| D08 | Pengguna mendapatkan report yang rapi dan dapat diekspor. |

Revisi form berbasis rincian bahan menjadi acuan implementasi. Versi pertama menggunakan rincian bahan sebagai input utama; totalnya dihitung otomatis.

### 2.2 Default untuk implementasi versi pertama

Default berikut merupakan keputusan rancangan yang dapat diubah pemilik produk melalui konfigurasi atau revisi dokumen.

| Area | Default |
|---|---|
| Nama aplikasi | Kalkulator HPP Kuliner sebagai nama kerja. |
| Akses pembeli | Tidak memiliki tanggal kedaluwarsa otomatis; akses dapat dicabut berdasarkan kebijakan pembelian. |
| Akun | Satu email memiliki satu akun aplikasi HPP. Login aplikasi HPP berdiri sendiri; SSO belum diperlukan. |
| Profil usaha | Satu profil usaha default per akun; nama usaha pada setiap perhitungan dapat diedit. |
| Ekspor | PDF dan Excel `.xlsx`, keduanya termasuk versi pertama. |
| Pajak | Nonaktif saat membuat perhitungan baru; nama dan tarif diisi pengguna saat diaktifkan. |
| Target margin | 30% sebagai nilai awal simulasi yang dapat diubah, bukan patokan margin industri. |
| Pembulatan saran | Ke atas dalam kelipatan Rp500; tersedia pilihan Rp1, Rp500, dan Rp1.000. |
| Waktu | Data waktu disimpan UTC; UI dan laporan awal menampilkan Asia/Makassar atau WITA. |
| Hosting dan URL | Ditentukan saat implementasi melalui `APP_BASE_URL`; domain aplikasi HPP belum ditetapkan. |

## 3 Tujuan dan batas lingkup

### 3.1 Tujuan

1. Pemilik UMKM dapat menyelesaikan perhitungan tanpa memahami istilah akuntansi teknis.
2. Pengguna memahami apakah harga bahan berlaku per gram, kg, ml, liter, atau buah.
3. Hasil HPP dapat ditelusuri kembali ke komponen input.
4. Pengguna dapat mengubah margin atau harga jual dan melihat dampaknya langsung.
5. Report di layar, PDF, dan Excel menggunakan angka serta revisi perhitungan yang sama.
6. Pembeli mendapat akun dan akses secara otomatis dengan proses webhook yang dapat dipulihkan ketika gagal.

### 3.2 Termasuk versi pertama

- Aktivasi akun, login, logout, lupa password, profil usaha, dan pemeriksaan akses pembelian.
- Daftar perhitungan, pencarian, membuat, menyimpan draft, mengedit, menduplikasi, dan mengarsipkan perhitungan.
- Form blok dengan baris bahan, kemasan, tenaga kerja, dan biaya produksi lain yang dapat ditambah.
- HPP per batch dan per satuan hasil, rincian kategori, dan status kelengkapan biaya.
- Simulasi margin, pembulatan harga, harga jual manual, dan pajak penjualan sederhana.
- Report, PDF, dan Excel per perhitungan.
- Panel admin minimal untuk pemantauan akses, webhook, dan pengiriman email.
- Integrasi webhook dengan sistem penjualan yang sudah ada.

### 3.3 Di luar versi pertama

- POS, stok bahan, pembelian pemasok, pembukuan, dan pencatatan penjualan harian.
- OCR nota, input suara, AI pembuat resep, atau estimasi harga bahan otomatis.
- Resep bertingkat seperti saus yang otomatis dipakai sebagai subresep.
- Kalkulator watt alat, meter listrik, penyusutan aset, dan alokasi biaya bulanan otomatis.
- Komisi marketplace, diskon, service charge, serta simulasi beberapa kanal penjualan.
- Penentuan kewajiban pajak, pelaporan pajak, faktur pajak, dan perhitungan pajak penghasilan.
- Banyak anggota dalam satu usaha, undangan staf, SSO, aplikasi native, dan banyak mata uang.
- Konversi gram ke ml, konversi sendok ke gram, dan harga untuk ukuran kemasan pembelian yang berbeda.

## 4 Pengguna dan hak akses

| Peran | Kebutuhan | Hak akses |
|---|---|---|
| Pembeli UMKM | Mengetahui biaya dan harga jual produk sendiri | Profil dan perhitungan miliknya, simulasi, report, ekspor. |
| Pembeli belum aktivasi | Memulai pemakaian setelah membeli | Tautan aktivasi dan pengiriman ulang email aktivasi. |
| Pengguna tanpa akses aktif | Mengetahui status akses | Login, profil akun, halaman status akses, dan kontak bantuan. |
| Admin | Menangani kendala akun dan integrasi | Status pengguna dan akses, inbox webhook, status email, tindakan pemulihan dengan audit. |

Admin tidak otomatis memperoleh akses ke isi resep atau harga bahan pelanggan. Dukungan isi perhitungan dilakukan melalui report yang dibagikan pelanggan. Seluruh API perhitungan membatasi data berdasarkan pemilik akun.

## 5 Alur pengguna

### 5.1 Pembelian dan aktivasi

1. Pembeli menyelesaikan pembayaran AI Prompt Food di `app.lrmobileid.com`.
2. Sistem penjualan memverifikasi keberhasilan pembayaran melalui proses servernya.
3. Sistem penjualan mengirim webhook terautentikasi ke aplikasi HPP.
4. Aplikasi memvalidasi pengirim, event, email, status pembayaran, dan ID produk yang berhak mendapat akses.
5. Worker membuat atau menemukan akun berdasarkan email, kemudian mencatat grant akses.
6. Pembeli baru mendapat tautan aktivasi untuk membuat password. Pemilik akun yang sudah aktif mendapat pemberitahuan akses dan tautan login.
7. Setelah aktivasi dan login, pengguna masuk ke daftar perhitungan.

### 5.2 Membuat perhitungan

1. Pengguna memilih **Perhitungan baru**.
2. Pengguna mengisi informasi produk dan jumlah hasil produksi untuk satu batch.
3. Pengguna menambahkan bahan dan harga per satuan yang sesuai.
4. Pengguna melengkapi kemasan, tenaga kerja, dan biaya produksi lainnya, atau menandai status kategorinya.
5. Pengguna memilih pajak bila diperlukan, target margin, dan pembulatan.
6. Ringkasan biaya diperbarui selama input valid. Pengguna memilih **Hitung dan simpan** untuk menyimpan revisi final.
7. Halaman report menampilkan hasil, rincian, dan opsi ekspor.

### 5.3 Mengubah harga dan memakai ulang resep

- Perubahan target margin memperbarui saran harga. Harga pilihan manual yang sudah diisi tetap disimpan.
- Perubahan harga pilihan memperbarui margin aktual dan status pencapaian target.
- Pengguna dapat menduplikasi perhitungan untuk membuat varian dengan nama baru.
- Perubahan ukuran batch tidak otomatis mengubah jumlah bahan, jumlah kemasan, upah, atau biaya lain. Form menampilkan petunjuk untuk memeriksa semua input batch.
- Mengedit perhitungan yang tersimpan menghasilkan draft perubahan. Report dan ekspor baru tersedia setelah perubahan dihitung dan disimpan.

## 6 Halaman dan navigasi

| Halaman | Isi utama | Tindakan utama |
|---|---|---|
| Login | Email, password, tampilkan password, lupa password | Masuk. |
| Aktivasi akun | Email readonly, password, konfirmasi password | Aktifkan akun. |
| Lupa password | Email dan status pengiriman generik | Kirim tautan. |
| Status akses | Aktif, belum diberikan, atau dicabut; kontak bantuan | Kembali atau hubungi bantuan. |
| Perhitungan saya | Nama produk, nama usaha, jumlah hasil, HPP, tanggal, status | Baru, buka, duplikat, arsipkan. |
| Form perhitungan | Seluruh blok input dan ringkasan | Simpan draft; hitung dan simpan. |
| Report | Ringkasan, rincian biaya, grafik, harga dan pajak | Edit; ekspor PDF; ekspor Excel. |
| Profil | Nama tampilan dan nama usaha default | Simpan profil; ubah password. |
| Admin akses | Email, grant akses, sumber transaksi, status | Pengiriman ulang dan tindakan akses. |
| Admin integrasi | Event, job, email, error ringkas | Lihat status; proses ulang kegagalan. |

Tidak ada halaman pendaftaran umum. Sesi yang valid belum cukup untuk memakai kalkulator: pengguna juga harus memiliki akses aktif.

## 7 Spesifikasi form

### 7.1 Prinsip tampilan

- Satu halaman form dengan blok terpisah, judul pendek, batas visual halus, dan ruang antarinput yang cukup.
- Urutan blok: informasi produk, bahan baku, kemasan, tenaga kerja, biaya produksi lainnya, pajak, harga jual.
- Semua judul blok terlihat. Field pajak baru muncul saat pajak diaktifkan.
- Desktop memakai grid dua atau tiga kolom untuk informasi produk dan baris biaya yang mudah dipindai.
- HP memakai kartu per baris bahan atau biaya. Tidak ada tabel input yang harus digeser horizontal.
- Label tetap terlihat setelah mengetik. Satuan dan prefix Rp berada dekat angka, bukan hanya di placeholder.
- Tombol **Tambah bahan baku**, **Tambah kemasan**, **Tambah tenaga kerja**, dan **Tambah biaya** berada di blok masing-masing.
- Tidak ada pertanyaan seperti “Mau menghitung produk apa?” dalam UI. Gunakan label **Nama produk**.

### 7.2 Blok informasi produk dan produksi

| Field | Tipe | Ketentuan | Contoh |
|---|---|---|---|
| Nama produk | Teks | Wajib untuk hasil final; 1 sampai 120 karakter | Brownies cokelat. |
| Nama usaha atau UMKM | Teks | Wajib untuk hasil final; default dari profil; dapat diedit | Dapur Rasa. |
| Ukuran batch | Angka bulat | Jumlah hasil yang layak dijual; 1 sampai 1.000.000 | 10. |
| Satuan hasil | Select | Wajib; box, pack, cup, porsi, buah, botol, atau lainnya | box. |
| Nama satuan lainnya | Teks | Muncul jika lainnya; 1 sampai 30 karakter | loyang. |
| Catatan produksi | Teks | Opsional; maksimal 500 karakter | Ukuran box 15 cm. |

Helper ukuran batch: **Jumlah hasil produksi yang bisa dijual dari satu kali produksi.**

Versi pertama menghitung satuan hasil sebagai jumlah unit bulat. Pilihan lainnya mengganti nama unit tersebut. Jumlah bahan baku tetap boleh pecahan, misalnya 0,5 kg.

### 7.3 Blok bahan baku

| Field per baris | Tipe | Ketentuan |
|---|---|---|
| Nama bahan | Teks | Wajib untuk baris terisi; maksimal 100 karakter. |
| Jumlah digunakan | Desimal | Lebih dari 0; maksimal 6 angka desimal. |
| Satuan | Select | g, kg, ml, liter, atau buah. |
| Harga per satuan | Rupiah | Angka >= 0; maksimal 6 desimal untuk harga satuan kecil. |
| Subtotal | Readonly | Jumlah digunakan dikali harga per satuan yang dipilih. |
| Hapus | Tombol | Menghapus baris; perubahan masuk ke draft. |

Label harga mengikuti satuan, misalnya **Harga per kg** atau **Harga per gram**. Helper: **Harga untuk 1 satuan yang dipilih.** Helper jumlah: **Jumlah bahan yang dipakai untuk batch ini.**

Contoh: tepung 10 kg dengan harga Rp15.000 per kg menghasilkan subtotal Rp150.000. Bahan yang tidak habis digunakan tidak dimasukkan seluruh jumlah pembeliannya.

- Baris pertama tersedia saat form dibuka. Minimal satu baris bahan lengkap untuk hasil final.
- Maksimal 100 baris bahan per perhitungan.
- Baris seluruhnya kosong diabaikan. Baris sebagian terisi wajib dilengkapi atau dihapus.
- Bahan dengan harga 0 dapat dicatat sebagai bahan tanpa biaya; aplikasi menampilkan penanda **Harga Rp0** agar mudah diperiksa.
- Nama bahan yang sama boleh muncul lebih dari sekali; tidak ada penggabungan otomatis.

### 7.4 Blok kemasan

Field per baris: **Nama kemasan**, **Jumlah**, **Harga per buah**, dan **Subtotal**. Jumlah berupa angka bulat > 0; subtotal = jumlah x harga per buah.

Contoh: 10 box x Rp1.000 = Rp10.000. Box, label, sendok, dan perlengkapan lain dapat menjadi baris terpisah. Jumlah kemasan tidak diasumsikan sama dengan jumlah hasil; pengguna tetap menentukan jumlahnya.

Maksimal 50 baris. Tombol **Tambah kemasan** dan total kategori muncul di akhir blok.

### 7.5 Blok tenaga kerja

Field per baris: **Keterangan pekerjaan**, **Jumlah orang**, **Upah per orang untuk batch ini**, dan **Subtotal**.

- Jumlah orang berupa angka bulat > 0; default 1 ketika menambah baris.
- Upah >= 0; subtotal = jumlah orang x upah per orang untuk batch tersebut.
- Helper upah: **Biaya pekerjaan untuk batch ini. Jika memakai upah harian atau bulanan, masukkan bagian yang dialokasikan untuk batch ini.**
- Pengguna dapat memasukkan nilai waktu kerjanya sendiri sebagai estimasi biaya; nilai tersebut ditentukan pengguna.
- Maksimal 50 baris. Versi pertama tidak menghitung jam kerja atau penggajian otomatis.

### 7.6 Blok biaya produksi lainnya

Field per baris: **Jenis biaya**, **Keterangan**, dan **Biaya untuk batch ini**.

Jenis biaya: listrik, gas, air, alokasi sewa ruang produksi, alokasi penggunaan alat, dan lainnya. Jika memilih lainnya, keterangan wajib. Nominal biaya >= 0; total kategori merupakan penjumlahan nominal.

Helper: **Masukkan bagian biaya yang digunakan untuk batch ini, bukan seluruh tagihan jika tagihan mencakup produksi lain.**

Maksimal 50 baris. Aplikasi tidak otomatis menentukan alokasi tagihan; nominal dapat berupa estimasi pengguna. Biaya administrasi, iklan, dan distribusi tidak ditambahkan ke HPP produksi oleh sistem.

### 7.7 Status kategori biaya

Untuk kemasan, tenaga kerja, dan biaya produksi lainnya tersedia status:

| Status | Perlakuan |
|---|---|
| Diisi | Ada minimal satu baris lengkap; nilai dihitung dalam total. |
| Tidak ada biaya | Kategori bernilai 0 dengan keputusan eksplisit pengguna. |
| Belum dihitung | Kategori sementara bernilai 0 untuk penjumlahan, dengan penanda hasil belum lengkap. |

Kategori opsional awalnya **Belum dihitung**. Menambahkan baris mengubah status menjadi **Diisi**. Menghapus semua baris mengembalikan status **Belum dihitung**. Pemilihan **Tidak ada biaya** hanya diperbolehkan ketika tidak ada baris terisi.

Jangan menghapus baris terisi diam-diam saat status kategori berubah. Hasil final tetap boleh disimpan ketika ada kategori **Belum dihitung**, tetapi ringkasan dan report wajib menampilkan daftar kategori tersebut. Status tidak boleh disebut **HPP lengkap** hanya karena form lolos validasi.

### 7.8 Blok pajak

| Field | Ketentuan |
|---|---|
| Pajak penjualan | Switch; nonaktif secara default. |
| Nama pajak | Teks maksimal 60 karakter; wajib ketika aktif; contoh label PBJT atau pajak penjualan. |
| Tarif pajak | Persen manual; 0 sampai 100; maksimal 2 desimal. |
| Dasar perhitungan | Readonly: harga jual sebelum pajak per satuan. |
| Perlakuan harga | Pilihan **Belum termasuk pajak** atau **Sudah termasuk pajak**. |

Pajak versi pertama adalah simulasi satu pungutan penjualan dengan dasar 100% harga sebelum pajak. Tarif tidak diisi otomatis berdasarkan jenis usaha. Pungutan penjualan dihitung terpisah dari biaya produksi dan tidak menjadi pendapatan yang digunakan menghitung margin.

Helper: **Gunakan nama dan tarif yang berlaku untuk usaha Anda. Pengaturan ini menghitung harga dan pajak, bukan menentukan kewajiban pajak usaha.**

Makanan dan minuman tertentu yang menjadi objek pajak daerah memiliki perlakuan berbeda dari PPN. Karena itu, UI tidak memberi label PPN atau tarif umum kepada seluruh pengguna kuliner. Rujukan konteks: [JDIH Kementerian Keuangan PMK 70 tahun 2022](https://jdih.kemenkeu.go.id/dok/70-pmk-03-2022/view).

### 7.9 Blok harga jual dan margin

| Field | Ketentuan |
|---|---|
| Target margin | Persen; 0 sampai 99,99; maksimal 2 desimal; default simulasi 30%. |
| Pilihan cepat | 20%, 30%, dan 40%; hanya mengubah target margin. |
| Pembulatan saran | Kelipatan Rp1, Rp500, atau Rp1.000; selalu ke atas. |
| Harga jual pilihan | Opsional; Rupiah > 0 jika diisi; harga sebelum atau termasuk pajak sesuai mode. |
| Saran harga jual | Readonly; dihitung dari HPP, target margin, pajak, dan pembulatan. |

Helper margin: **Persentase harga jual sebelum pajak yang tersisa setelah biaya produksi yang dimasukkan.**

Harga pilihan kosong berarti report memakai saran harga. Bila harga manual terisi, report menampilkan saran dan pilihan sebagai dua angka berbeda. Harga manual tidak dibulatkan atau diubah otomatis.

## 8 Perilaku form dan validasi

### 8.1 Input angka dan format

- Tampilan memakai format Indonesia: `Rp15.000`, jumlah `0,5`, persen `30%`.
- Kolom jumlah menerima `0,5` maupun `0.5` sebagai pecahan. Pemisah ribuan tidak digunakan dalam kolom jumlah.
- Kolom Rupiah menerima `15000` atau `15.000` sebagai Rp15.000; koma dipakai untuk desimal, misalnya `15,5`. Titik pada kolom Rupiah merupakan pemisah ribuan.
- Format diterapkan saat blur tanpa mengganggu posisi kursor ketika mengetik.
- Nilai API berupa string desimal dengan titik, tanpa `Rp`, simbol persen, atau pemisah ribuan.
- Angka negatif, NaN, infinity, teks tak dapat diparse, dan nilai di luar batas ditolak pada client dan server.
- Batas jumlah atau nominal per input: <= 1.000.000 untuk jumlah dan <= Rp1.000.000.000.000 untuk harga atau biaya. Maksimal 6 desimal untuk jumlah dan uang; rate maksimal 2 desimal.
- Password tidak mengalami trim atau normalisasi karakter. Email memiliki normalisasi tersendiri pada modul akun.

### 8.2 Validasi dan status

- Validasi ditampilkan saat blur atau ketika **Hitung dan simpan** dipilih.
- Error muncul dekat field; ringkasan error mengarahkan fokus ke field pertama yang perlu diperbaiki.
- Field kosong tidak langsung diperlakukan sebagai 0 ketika pengguna masih mengetik.
- **Simpan draft** menerima form belum lengkap. Draft menyimpan nilai mentah dan tidak menghasilkan report final.
- **Hitung dan simpan** memerlukan informasi produk lengkap, minimal satu bahan lengkap, kategori konsisten, pajak valid, dan total biaya produksi > 0.
- Kalkulasi pratinjau boleh tampil dari input yang lengkap, dengan badge **Pratinjau belum disimpan**. Pratinjau tidak dapat diekspor.
- Hasil dengan biaya > 0 tetapi kategori belum dihitung diberi label **Estimasi dengan biaya belum lengkap**.
- Harga pilihan di bawah biaya bukan error input. Tampilkan selisih negatif dan pesan **Harga belum menutup biaya yang dimasukkan**.

Contoh pesan: **Nama produk wajib diisi**, **Jumlah digunakan harus lebih dari 0**, **Harga per kg belum diisi**, **Target margin harus kurang dari 100%**, **Lengkapi atau hapus baris bahan ini**.

### 8.3 Penyimpanan dan perubahan

- Draft server disimpan otomatis 2 detik setelah perubahan terakhir, dengan indikator **Menyimpan**, **Tersimpan**, atau **Gagal menyimpan**.
- Penyimpanan manual tetap tersedia; kegagalan tidak menghapus form yang sedang terbuka.
- Gunakan `draft_version` untuk mencegah perubahan antar-tab saling menimpa. Konflik memberi pilihan memuat versi terakhir atau menyimpan sebagai perhitungan baru.
- Navigasi meninggalkan form yang belum tersimpan menampilkan konfirmasi sederhana.
- Nama produk hasil duplikasi ditambah **Salinan**; semua nilai input disalin, ID dan waktu baru, status draft.
- Arsip menyembunyikan perhitungan dari daftar utama, tetap dapat dibuka pada filter arsip, dan dapat dipulihkan. Penghapusan permanen bukan tindakan versi pertama.
- Nama usaha dalam report merupakan snapshot perhitungan; perubahan profil tidak mengubah report lama.

## 9 Mesin perhitungan

### 9.1 Definisi variabel

| Simbol | Arti |
|---|---|
| N | Jumlah hasil batch yang layak dijual. |
| B | Total bahan baku untuk batch. |
| K | Total kemasan untuk batch. |
| L | Total tenaga kerja untuk batch. |
| O | Total biaya produksi lainnya untuk batch. |
| T | Total biaya produksi batch. |
| C | HPP atau estimasi biaya produksi per satuan hasil. |
| m | Target margin sebagai pecahan; 30% menjadi 0,30. |
| t | Tarif pajak sebagai pecahan; 10% menjadi 0,10. |
| P | Harga jual per satuan sebelum pajak. |
| G | Total harga per satuan yang dibayar pelanggan termasuk pajak. |
| s | Kelipatan pembulatan harga. |

### 9.2 Rumus dasar

```text
Subtotal bahan i       = jumlah_digunakan_i x harga_per_satuan_i
Subtotal kemasan j     = jumlah_j x harga_per_buah_j
Subtotal tenaga k      = jumlah_orang_k x upah_per_orang_untuk_batch_k

B = jumlah seluruh subtotal bahan
K = jumlah seluruh subtotal kemasan
L = jumlah seluruh subtotal tenaga kerja
O = jumlah seluruh nominal biaya produksi lainnya
T = B + K + L + O
C = T / N

Harga target sebelum pajak = C / (1 - m)
Selisih per satuan          = P - C
Margin aktual              = (P - C) / P x 100%
Selisih untuk seluruh batch = (P - C) x N
```

Selisih seluruh batch merupakan simulasi jika semua hasil batch terjual pada harga tersebut. Label tidak boleh menyatakan angka itu sebagai laba penjualan yang sudah terjadi.

Margin memiliki dasar harga jual, sedangkan markup memiliki dasar biaya. Aplikasi memakai target margin dan tidak menggunakan `C x (1 + m)` untuk menghasilkan harga target. Rujukan definisi: [Xero margin dan markup](https://www.xero.com/uk/glossary/margin-vs-markup/).

### 9.3 Satuan bahan

Harga selalu berlaku per satuan yang dipilih. Jika jumlah 10 kg dan harga per kg Rp15.000, subtotalnya Rp150.000; tidak perlu dikali 1.000 lagi.

Konversi yang didukung saat satuan pada baris lengkap diubah:

| Kelompok | Faktor terhadap satuan dasar |
|---|---|
| Massa | g = 1; kg = 1.000. |
| Volume | ml = 1; liter = 1.000. |
| Hitungan | buah = 1; tidak dikonversi ke massa atau volume. |

Untuk perubahan dalam kelompok yang sama:

```text
Jumlah baru = jumlah lama x faktor lama / faktor baru
Harga baru  = harga lama x faktor baru / faktor lama
```

Contoh: 10 kg x Rp15.000/kg menjadi 10.000 g x Rp15/g. Subtotal tetap Rp150.000. UI memberi notifikasi bahwa jumlah dan harga disesuaikan. Jika hasil konversi tidak dapat direpresentasikan dalam 6 desimal, perubahan ditolak dengan petunjuk memakai satuan sebelumnya atau memasukkan ulang; jangan melakukan pembulatan diam-diam.

Perubahan antar-kelompok pada baris terisi memerlukan konfirmasi dan pengisian ulang jumlah serta harga. Tidak ada konversi densitas makanan otomatis.

### 9.4 Pembulatan dan ketelitian

- Pakai aritmetika decimal dengan presisi minimal 50 digit untuk perhitungan agar rentang input dan operasi antara tetap tertampung; jangan mengandalkan floating point JavaScript untuk uang.
- Jangan membulatkan subtotal bahan sebelum dijumlahkan, atau HPP sebelum menghitung target harga.
- Snapshot menyimpan input dan hasil canonical dengan decimal, formula version, serta aturan pembulatan.
- Pembulatan harga: `ceil(nilai / s) x s`. Kelipatan Rp1 berarti pembulatan ke atas ke Rupiah utuh.
- Total kategori, subtotal, HPP, dan pajak pada report dapat menampilkan sampai 2 desimal; selisih dan harga menyesuaikan kebutuhan pembacaan.
- Margin ditampilkan 2 desimal, tetapi perbandingan target menggunakan nilai presisi, bukan nilai tampilan.
- Excel menyediakan nilai rincian sampai 6 desimal agar penjumlahan dapat diperiksa. Bila format 2 desimal menimbulkan selisih tampilan kecil, report memberi catatan pembulatan.
- Jumlah hasil tidak menjadi jumlah pelanggan yang benar-benar membeli. Produk tersisa atau rusak setelah produksi tidak dicatat sebagai transaksi di aplikasi.

## 10 Perhitungan pajak dan harga

Pajak penjualan tidak ditambahkan ke `T`, `C`, atau grafik biaya produksi. Rumus berikut berlaku untuk model pajak sederhana dalam lingkup aplikasi.

### 10.1 Pajak nonaktif

```text
Harga target = C / (1 - m)
Saran harga  = ceil(Harga target / s) x s
Harga pilihan efektif = harga manual jika diisi; selain itu saran harga
P = G = harga pilihan efektif
Pajak = 0
Batas biaya sebelum pajak = C
Batas harga pelanggan untuk menutup biaya = C
```

### 10.2 Harga belum termasuk pajak

```text
Harga target sebelum pajak = C / (1 - m)
Saran harga sebelum pajak  = ceil(Harga target sebelum pajak / s) x s
P = harga manual jika diisi; selain itu saran harga sebelum pajak
Pajak per satuan = P x t
G = P x (1 + t)
Batas harga pelanggan untuk menutup biaya = C x (1 + t)
```

Label input: **Harga jual sebelum pajak**. Report menampilkan harga sebelum pajak, pajak, dan total yang dibayar pelanggan. Pembulatan pilihan s diterapkan pada harga sebelum pajak; pajak tidak dibulatkan ke kelipatan s.

### 10.3 Harga sudah termasuk pajak

```text
Harga target sebelum pajak = C / (1 - m)
Harga target pelanggan     = Harga target sebelum pajak x (1 + t)
Saran harga termasuk pajak = ceil(Harga target pelanggan / s) x s
G = harga manual jika diisi; selain itu saran harga termasuk pajak
P = G / (1 + t)
Pajak per satuan = G - P
Batas harga pelanggan untuk menutup biaya = C x (1 + t)
```

Label input: **Harga jual termasuk pajak**. Margin aktual tetap memakai P, bukan G. Bila mode pajak berubah, harga manual tidak ditafsirkan ulang tanpa pemberitahuan: form mengosongkan harga manual setelah konfirmasi agar pengguna menetapkannya kembali.

### 10.4 Interpretasi batas biaya

- **Batas biaya per satuan** selalu C, berdasarkan komponen yang dimasukkan.
- **Batas harga pelanggan untuk menutup biaya** mempertimbangkan pajak bila aktif.
- Dalam UI, gunakan label **Harga minimum menutup biaya** untuk batas harga pelanggan tersebut, dengan keterangan **Berdasarkan biaya yang dimasukkan**.
- Kedua angka tersebut tidak diberi label **Harga pasti untung** atau **Harga aman**.
- Pajak yang dipungut dan kategori biaya yang belum dihitung harus terlihat dekat ringkasan harga.
- Margin ini belum merupakan laba bersih usaha bila biaya di luar produksi belum dimasukkan.

Status harga pilihan mengikuti urutan: bila P < C, tampilkan **Belum menutup biaya**; bila P >= C dan margin aktual < target, tampilkan **Menutup biaya, target margin belum tercapai**; bila margin aktual >= target, tampilkan **Target margin tercapai**. Status dihitung dari nilai presisi. Jika ada kategori belum dihitung, status tetap disertai peringatan kelengkapan.

Untuk menghindari salah status di batas pembagian berulang, gunakan perbandingan yang setara tanpa pembagian: tanpa pajak atau mode belum termasuk pajak, target tercapai jika `P x (1 - m) x N >= T`; mode sudah termasuk pajak, target tercapai jika `G x (1 - m) x N >= T x (1 + t)`. Harga menutup biaya mengikuti rumus yang sama dengan m = 0. Angka margin yang ditampilkan tetap memakai rumus bagian 9.

## 11 Contoh perhitungan acuan

Seluruh angka pada bagian ini adalah data uji, bukan rekomendasi harga bahan atau tarif pajak untuk suatu usaha.

### 11.1 Brownies satu batch

Jumlah hasil: 10 box.

| Komponen | Jumlah | Harga | Subtotal |
|---|---:|---:|---:|
| Tepung | 1 kg | Rp15.000 per kg | Rp15.000 |
| Gula | 0,5 kg | Rp20.000 per kg | Rp10.000 |
| Telur | 10 buah | Rp2.000 per buah | Rp20.000 |
| Cokelat | 0,5 kg | Rp30.000 per kg | Rp15.000 |
| Mentega | 0,5 kg | Rp20.000 per kg | Rp10.000 |
| Box | 10 buah | Rp1.000 per buah | Rp10.000 |
| Tenaga kerja | 1 orang | Rp15.000 untuk batch | Rp15.000 |
| Listrik | Untuk batch | Rp2.000 | Rp2.000 |
| Gas | Untuk batch | Rp3.000 | Rp3.000 |

```text
B = Rp70.000
K = Rp10.000
L = Rp15.000
O = Rp5.000
T = Rp100.000
C = Rp10.000 per box
```

### 11.2 Harga dan pajak

| Skenario | Output yang diharapkan |
|---|---|
| Margin 30%, pajak nonaktif, kelipatan Rp500 | Harga target Rp14.285,714286; saran Rp14.500; selisih Rp4.500; margin aktual 31,034483%. |
| Harga manual Rp15.000, pajak nonaktif | Selisih Rp5.000; margin aktual 33,333333%; target 30% tercapai. |
| Harga manual Rp13.000, pajak nonaktif | Selisih Rp3.000; margin aktual 23,076923%; target 30% belum tercapai. |
| Harga manual Rp9.000, pajak nonaktif | Selisih -Rp1.000; margin aktual -11,111111%; harga belum menutup biaya. |
| Pajak uji 10%, belum termasuk pajak, margin 30%, kelipatan Rp500 | Saran sebelum pajak Rp14.500; pajak Rp1.450; pelanggan membayar Rp15.950; margin aktual 31,034483%. |
| Pajak uji 10%, sudah termasuk pajak, margin 30%, kelipatan Rp500 | Target pelanggan Rp15.714,285714; saran termasuk pajak Rp16.000; P Rp14.545,454545; pajak Rp1.454,545455; margin aktual 31,25%. |
| Pajak uji 10%, harga termasuk pajak manual Rp15.000 | P Rp13.636,363636; pajak Rp1.363,636364; selisih Rp3.636,363636; margin aktual 26,666667%. |
| Pajak uji 10% dan C Rp10.000 | Batas harga pelanggan untuk menutup komponen biaya Rp11.000. |

## 12 Report dan ekspor

### 12.1 Struktur report di layar

1. Header: nama produk, nama usaha, waktu perhitungan, jumlah batch, satuan hasil, dan ID revisi.
2. Ringkasan utama: total biaya batch, HPP per satuan, harga minimum menutup biaya, saran harga, harga pilihan efektif, margin aktual, dan status pencapaian target. Harga minimum dan saran diberi label sebelum atau termasuk pajak yang konsisten dengan nilainya.
3. Status kelengkapan: kategori belum dihitung, biaya Rp0, dan peringatan harga di bawah biaya.
4. Grafik komposisi: bahan baku, kemasan, tenaga kerja, dan biaya produksi lainnya; nominal dan persentase terhadap T.
5. Rincian: seluruh baris bahan, kemasan, tenaga kerja, dan biaya lainnya beserta total kategori.
6. Simulasi harga: target margin, harga target, pembulatan, harga manual jika ada, selisih per satuan, dan simulasi selisih seluruh batch.
7. Pajak: status, nama, tarif, dasar harga sebelum pajak, nilai pajak, dan harga pelanggan.
8. Catatan: batas interpretasi, kategori yang belum dihitung, waktu data, dan formula version.

Ringkasan menampilkan istilah **per box**, **per pack**, atau satuan yang dipilih. Selisih disebut **Estimasi selisih harga dan biaya produksi**. Jika data belum lengkap, label itu tetap membawa status estimasi.

### 12.2 Kualitas tampilan

- Desain bersih dengan latar terang, teks gelap, warna aksen konsisten, dan angka mudah dibaca.
- Grafik boleh berupa donut dengan legenda atau bar horizontal; angka kategori tetap tersedia dalam tabel.
- Pajak tidak dimasukkan dalam komposisi biaya produksi.
- Persentase kategori dihitung terhadap total biaya; angka tampilan boleh tidak tepat 100% karena pembulatan.
- Tidak ada watermark besar, dekorasi makanan, atau elemen pemasaran yang menghalangi angka.
- Nama panjang membungkus tanpa menutupi nominal. Nilai uang rata kanan dan label rata kiri.

### 12.3 PDF

- Tombol **Ekspor PDF** membuat PDF langsung yang dapat diunduh; bukan hanya membuka dialog print browser.
- Ukuran A4 portrait; halaman pertama menampilkan identitas dan ringkasan, diikuti rincian sesuai jumlah baris.
- Header tabel berulang pada halaman lanjutan. Satu baris tidak terpotong melintasi halaman.
- Footer memuat nomor halaman, waktu ekspor, dan revisi perhitungan.
- File mempertahankan keterbacaan saat dicetak hitam putih.
- Filename: `HPP-{nama-produk-aman}-{YYYYMMDD}-r{revision}.pdf`.
- Tidak memuat email pembeli, ID pembayaran, token, atau rincian akun.

### 12.4 Excel

Workbook `.xlsx` memiliki sheet:

| Sheet | Isi |
|---|---|
| Ringkasan | Identitas produk, batch, total, HPP, status biaya, margin, harga, pajak. |
| Bahan Baku | Nama, jumlah, satuan, harga per satuan, subtotal. |
| Kemasan | Nama, jumlah, harga per buah, subtotal. |
| Tenaga Kerja | Keterangan, orang, upah per orang untuk batch, subtotal. |
| Biaya Produksi | Jenis biaya, keterangan, nominal batch. |
| Harga dan Pajak | Target, pembulatan, harga sebelum pajak, pajak, harga pelanggan, margin aktual. |

Ketentuan: angka berupa numeric cells; uang dan persen memiliki number format; header dibekukan; lebar kolom disesuaikan; filter untuk sheet rincian; total dan revisi jelas. Input teks disimpan sebagai teks literal sehingga awalan `=`, `+`, `-`, atau `@` tidak dijalankan sebagai formula.

Excel memiliki batas presisi angka. Bila nilai rincian yang akan diekspor sampai 6 desimal memerlukan lebih dari 15 digit signifikan, ekspor menyertakan nilai decimal canonical sebagai teks pada kolom pendamping dan menandai nilai numeric sebagai pendekatan. Nilai canonical tetap menjadi acuan; ekspor tidak diam-diam mengklaim presisi yang tidak didukung Excel. Rujukan: [Microsoft spesifikasi dan batasan Excel](https://support.microsoft.com/id-id/excel/excel-specifications-and-limits).

Versi pertama mengekspor snapshot angka yang sudah dihitung, tanpa formula spreadsheet yang harus dihitung ulang. File bukan pengganti mesin kalkulasi aplikasi. Filename mengikuti pola PDF dengan ekstensi `.xlsx`.

### 12.5 Konsistensi ekspor

- Ekspor hanya dari revisi final tersimpan. Jika ada perubahan, pengguna menyimpan dan menghitungnya dahulu.
- Server memeriksa pemilik dan akses aktif sebelum membuat file.
- Report, PDF, dan Excel membaca snapshot yang sama, termasuk versi formula dan status kategori.
- Tidak membuat URL download publik permanen. File dapat dikirim langsung sebagai attachment dari endpoint terautentikasi.
- Error ekspor menampilkan **Ekspor gagal. Coba lagi.** dan mempertahankan data.

## 13 Akun dan pemberian akses

### 13.1 Status akun dan akses

Status akun: `pending_activation`, `active`, atau `suspended`. Status setiap grant akses: `active` atau `revoked`. Keduanya disimpan terpisah.

Pengguna dapat memakai perhitungan ketika akun aktif, tidak suspended, dan memiliki minimal satu grant aktif untuk fitur `hpp_calculator`. Pembelian ulang dapat memberi grant baru tanpa membuat akun baru. Pencabutan satu grant tidak mencabut grant lain yang masih aktif.

Default grant tidak kedaluwarsa. Struktur data menyediakan `expires_at` nullable untuk mendukung kebijakan akses bila kelak diperlukan.

### 13.2 Aktivasi dan password

- Email pembelian dinormalisasi dengan trim dan lowercase untuk kunci akun; jangan menghapus titik atau bagian `+` ala provider tertentu.
- User baru dibuat dengan status pending dan tanpa password yang diketahui pengguna atau dikirim melalui email.
- Tautan aktivasi sekali pakai berlaku 24 jam sejak diterbitkan. Membuka halaman melalui GET tidak menghabiskan token; token dikonsumsi ketika aktivasi berhasil di-submit.
- Aktivasi menegaskan kontrol email, mengatur password melalui library autentikasi, dan membuat akun aktif.
- Password 12 sampai 128 karakter; boleh passphrase dan karakter Unicode, dengan indikator tampilkan password. Tidak ada pemaksaan kombinasi simbol yang rumit.
- Token baru untuk aktivasi membatalkan token aktivasi sebelumnya. Token reset password berlaku 60 menit.
- Reset password mencabut sesi lain. Logout membatalkan sesi terkait.
- Akun aktif yang membeli lagi tidak direset passwordnya dan tidak diubah nama atau profilnya oleh webhook.
- Jika akun pending sudah ada, gunakan akun tersebut dan kirim ulang aktivasi secara terkendali.
- Akun suspended tidak aktif kembali melalui pembelian ulang secara otomatis; admin meninjau status.

Gunakan library autentikasi yang mendukung sesi, credential, token reset, dan provisioning server. Better Auth menjadi rekomendasi awal. Adapter aktivasi harus memakai API resmi library dan diuji lebih awal; password tidak disimpan sebagai kolom plaintext pada tabel profil pengguna. Rujukan: [Better Auth email dan password](https://better-auth.com/docs/authentication/email-password).

### 13.3 Email transaksi

Jenis email: aktivasi akun baru, akses diberikan untuk akun aktif, kirim ulang aktivasi, dan reset password. Email memuat nama aplikasi, tautan yang relevan, masa berlaku bila ada, dan kanal bantuan.

Email diproses melalui outbox durable dan tidak menentukan keberhasilan webhook. Kegagalan email tidak menghilangkan akun atau grant. Pengiriman dapat dicoba ulang dan dipantau admin. Request kirim ulang atau lupa password selalu memberi respons generik agar keberadaan akun tidak dibocorkan.

### 13.4 Kebijakan pencabutan

Default rancangan: refund penuh atau chargeback terkonfirmasi atas item AI Prompt Food mencabut grant transaksi tersebut. Refund sebagian memerlukan tinjauan admin dan tidak otomatis mencabut akses. Data perhitungan tidak dihapus ketika akses dicabut.

Kebijakan refund dan durasi akses harus diselaraskan dengan penawaran bisnis sebelum peluncuran. Pencabutan tidak boleh berdasarkan perubahan status pembayaran yang belum terverifikasi.

## 14 Kontrak webhook

### 14.1 Sumber dan batas kepercayaan

Pengirim adalah backend `app.lrmobileid.com`, setelah backend tersebut memverifikasi pembayaran. Aplikasi HPP tidak membuat akun berdasarkan redirect checkout sukses, event browser, atau request client.

Endpoint usulan: `POST /api/webhooks/purchases`. Payload di bawah adalah kontrak integrasi baru yang perlu dipetakan dari data transaksi nyata di sistem penjualan. Nama field maupun ID produk contoh bukan klaim tentang API existing.

Produk yang berhak mendapat akses ditentukan melalui allowlist ID atau SKU stabil. Nama produk tidak dipakai sebagai dasar pemberian akses. Jika pembelian memiliki beberapa item, cukup satu item yang memenuhi syarat dan terkonfirmasi paid untuk memberi grant.

### 14.2 Header dan payload

```text
Content-Type: application/json
X-HPP-Key-Id: primary
X-HPP-Timestamp: <Unix timestamp pengiriman saat ini>
X-HPP-Signature: sha256=<HMAC hex>
```

```json
{
  "schema_version": "1",
  "event_id": "evt_example_001",
  "type": "purchase.paid",
  "source": "app.lrmobileid.com",
  "occurred_at": "2026-10-01T08:00:00Z",
  "purchase": {
    "id": "order_example_001",
    "state_version": 1,
    "payment_status": "paid",
    "currency": "IDR",
    "amount_paid": "149000",
    "customer": {
      "email": "pembeli@example.com",
      "name": "Nama Pembeli"
    },
    "items": [
      {
        "id": "line_example_001",
        "product_id": "AI_FOOD_PRODUCT_ID",
        "quantity": 1,
        "access_status": "paid"
      }
    ]
  }
}
```

Semua ID wajib berupa string nonkosong dengan panjang <= 128; nama maksimal 120; email valid maksimal 254. `state_version` integer >= 1, meningkat saat status purchase atau item yang relevan berubah. Jumlah item maksimal 100; body maksimal 256 KB. Nilai uang nonnegatif berupa decimal string. `quantity` integer >= 1.

Event yang diterima: `purchase.paid`, `purchase.refunded`, dan `purchase.chargeback`. Status item: `paid`, `refunded`, `chargeback`, atau `partially_refunded`. Refund dan chargeback membawa snapshot status item terakhir, bukan hanya teks notifikasi. Produk lain dan status belum lunas tidak memberi grant.

### 14.3 Signature dan replay

```text
message   = timestamp_header + "." + raw_body_bytes
signature = HMAC_SHA256(secret_sesuai_key_id, message)
```

Receiver memverifikasi raw bytes sebelum parsing atau normalisasi JSON, format signature, key ID, dan timestamp dalam toleransi 5 menit. Perbandingan digest menggunakan metode constant time. Pengirim membuat timestamp dan signature baru ketika retry, tetapi mempertahankan event ID serta isi event yang sama.

Secret hanya di server, memiliki mekanisme rotasi key ID, dan tidak dikirim ke browser. Source dipetakan berdasarkan konfigurasi key yang valid, lalu harus cocok dengan field source. Pola validasi HMAC pada raw payload didukung oleh [GitHub Docs mengenai validasi webhook](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries); nama header dan timestamp di atas merupakan rancangan aplikasi ini.

### 14.4 Inbox durable dan worker

1. Verifikasi signature, timestamp, schema, dan sumber.
2. Simpan event ke inbox dengan unique key `(source, event_id)` dan hash body.
3. Return `202 Accepted` hanya setelah inbox tersimpan durable. Jika database gagal, return 5xx sehingga sender retry.
4. Worker mengambil job dengan lock yang mencegah pemrosesan paralel event sama.
5. Bandingkan `state_version` dengan snapshot purchase terakhir. Event lebih lama diabaikan; versi sama dengan isi status berbeda masuk error tinjauan. Kunci record purchase untuk mencegah dua event berbeda pada purchase yang sama berlomba memperbarui status. Pemeriksaan versi serta perubahan snapshot dan grant dilakukan dalam satu transaksi; jika provisioning akun berlangsung di luar transaksi tersebut, periksa versi kembali sebelum commit.
6. Untuk paid yang memenuhi syarat, upsert akun berdasarkan normalized email, upsert grant per item, dan tulis job email.
7. Untuk refund penuh atau chargeback, simpan status dan cabut grant item yang sesuai. Event paid lama tidak dapat mengaktifkannya lagi.
8. Tandai event processed beserta hasil ringkas. Error transient dijadwalkan ulang; error permanen terlihat pada admin.

Provisioning auth mungkin memiliki transaksi tersendiri. Worker mencatat tahap dan dapat melanjutkan dari akun yang sudah dibuat; perubahan grant, status domain, dan enqueue email harus atomic. Pemulihan tidak boleh membuat akun kedua atau grant kedua.

### 14.5 Idempotensi dan kasus khusus

- Event ID sama dan body hash sama: respons `200`, tanpa job baru.
- Event ID sama dengan body berbeda: respons `409`, jangan melakukan perubahan; tampilkan pada admin.
- Unique grant: `(source, purchase_id, item_id, feature_key)`.
- Event ID berbeda untuk transaksi yang sama tidak membuat grant atau akun tambahan.
- Purchase baru dengan email sama memakai akun lama dan memberi grant dari purchase baru.
- Refund yang datang sebelum paid tetap menyimpan snapshot dan tombstone grant item. Paid dengan versi lebih lama tidak mengaktifkan akses.
- Perubahan email purchase setelah provisioning masuk tinjauan admin; tidak otomatis memindahkan akun atau data.
- Event valid tanpa produk yang cocok disimpan dengan hasil `ignored_product`; tetap diakui agar tidak retry terus.
- Status item refund sebagian menghasilkan `review_required` dan tidak menghapus grant otomatis.
- Akun dan grant tetap ada ketika SMTP gagal. Pengulangan event tidak menjadwalkan email pembelian yang sama berulang kali.

### 14.6 Respons dan retry

| Respons | Makna |
|---|---|
| 202 | Event baru valid dan tersimpan untuk diproses. |
| 200 | Duplikat identik sudah diterima. |
| 400 atau 422 | Payload invalid; sender memperbaiki schema. |
| 401 | Signature, key, atau timestamp invalid. |
| 409 | Event ID bentrok dengan payload berbeda. |
| 413 | Payload terlalu besar. |
| 429 | Rate limit; sender mengikuti `Retry-After`. |
| 5xx | Kegagalan sebelum penerimaan durable; sender retry. |

Sender memakai outbox sendiri setelah transaksi paid, dengan retry eksponensial dan jitter hingga 24 jam. Rekomendasi awal jadwal: 1, 5, 15, dan 60 menit, lalu berkala hingga 24 jam. Kegagalan akhir memerlukan resend admin dengan event ID yang sama dan timestamp delivery baru.

Setelah receiver mengakui 202, pemulihan proses menjadi tanggung jawab inbox worker. Target pemrosesan akses <= 60 detik dalam kondisi normal. Rekonsiliasi manual harus tersedia saat source tidak memiliki API baca status; jangan mengandalkan retry browser pelanggan.

## 15 Penyimpanan data

### 15.1 Entitas inti

| Entitas | Data utama dan ketentuan |
|---|---|
| Auth user dan tabel library | ID, normalized email unik, credential dan session sesuai library. |
| UserProfile | Auth user ID unik, nama tampilan, nama usaha default, status akun, role. |
| AccessGrant | User ID, feature, source, purchase ID, item ID, product ID, status, expires_at nullable, alasan status. |
| PurchaseState | Source dan purchase ID unik, state_version, status terakhir, email awal, status item termasuk tombstone. |
| Calculation | Owner ID, draft input JSON, draft_version, nama produk, status draft/final/archived, latest revision. |
| CalculationRevision | Calculation ID dan revision unik, input canonical, hasil canonical, status kategori, formula_version, waktu. |
| WebhookEvent | Source/event ID unik, hash, payload minimal, status, tahap proses, attempts, last error, waktu retry. |
| EmailOutbox | Jenis email, user ID, dedup key, status, attempts, next attempt, provider message ID. |
| AuditLog | Aktor admin atau sistem, aksi, target, alasan, waktu; tidak menyimpan secret atau isi password. |

Gunakan PostgreSQL dengan transaksi, unique constraints, dan locking worker. Nilai uang dan jumlah pada snapshot menggunakan decimal string atau tipe numeric yang mempertahankan presisi. Tidak menggunakan tipe float untuk hasil uang.

Data draft dan snapshot memiliki `schema_version`. Versi formula awal `hpp-v1`. Mengubah rumus tidak boleh mengubah revisi report lama secara diam-diam. Revisi baru dihitung dengan versi formula yang berlaku dan mencatat versinya.

### 15.2 Konsistensi dan retensi

- Revisi final immutable. Input berubah menghasilkan draft lalu revisi final baru.
- Snapshot hasil dihitung server dari input tervalidasi; total hasil yang dikirim client diabaikan.
- Semua data perhitungan dan file export mengikuti pemilik user ID.
- Log webhook menyimpan data minimum untuk pemulihan; payload diagnostik dapat dipangkas setelah 30 hari sesuai kebijakan retensi.
- Grant, tombstone transaksi, dan dedup ledger dipertahankan lebih lama daripada payload diagnostik agar event lama tidak memberi akses lagi setelah refund.
- Token, password, dan secret tidak masuk analytics atau log. Tautan aktivasi di email outbox harus diperlakukan sebagai data rahasia dan dihapus setelah selesai/kedaluwarsa.
- Permintaan koreksi atau penghapusan akun ditangani admin melalui proses dukungan yang terdokumentasi; fitur penghapusan mandiri belum termasuk versi pertama.

## 16 Arsitektur dan kontrak aplikasi

### 16.1 Stack yang disarankan

| Bagian | Rekomendasi |
|---|---|
| Aplikasi | Next.js App Router, TypeScript, Node.js runtime. |
| UI | React, Tailwind CSS, komponen form yang aksesibel. |
| Form dan validasi | React Hook Form dan Zod, atau setara dengan shared schema. |
| Database | PostgreSQL dan ORM dengan dukungan transaksi serta decimal. |
| Auth | Better Auth atau library setara; provisioning server dan signup publik nonaktif. |
| Kalkulasi | Modul TypeScript murni dengan decimal arithmetic, dipakai client dan server. |
| PDF | Renderer server yang menghasilkan PDF teks/vector dan pagination stabil. |
| Excel | Generator XLSX dengan numeric cells dan teks literal yang aman. |
| Email | Penyedia email transaksi atau SMTP yang dipilih pemilik produk. |
| Worker | Inbox dan outbox berbasis database; worker durable dari repositori yang sama. |

Pilih versi stable yang masih didukung dan memiliki patch keamanan saat implementasi, lalu pin melalui lockfile. Aplikasi tidak memerlukan mikroservice terpisah untuk kalkulator.

Validasi sesi, akses, dan ownership dilakukan di server untuk setiap mutasi, pembacaan data privat, dan ekspor. Pemeriksaan pada menu atau layout UI hanya mendukung navigasi. Rujukan: [Next.js authentication](https://nextjs.org/docs/app/guides/authentication) dan [Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).

### 16.2 Route pengguna

| Route | Akses |
|---|---|
| `/login` | Publik. |
| `/activate` | Token aktivasi valid. |
| `/forgot-password` dan `/reset-password` | Publik dengan rate limit dan token untuk reset. |
| `/app/calculations` | Akun dan grant aktif. |
| `/app/calculations/new` | Akun dan grant aktif. |
| `/app/calculations/[id]/edit` | Pemilik dengan akses aktif. |
| `/app/calculations/[id]/report` | Pemilik dengan akses aktif. |
| `/app/profile` dan `/app/access` | Akun login; sesuai status akses. |
| `/admin/access` dan `/admin/integrations` | Admin terotorisasi. |

### 16.3 API domain

| Endpoint | Fungsi |
|---|---|
| `GET /api/calculations` | Daftar milik sendiri; search, status, pagination 20 per halaman. |
| `POST /api/calculations` | Membuat draft dan ID. |
| `GET /api/calculations/{id}` | Input draft dan metadata milik sendiri. |
| `PATCH /api/calculations/{id}` | Simpan draft dengan expected draft_version. |
| `POST /api/calculations/{id}/finalize` | Validasi, hitung server, simpan revisi final. |
| `POST /api/calculations/{id}/duplicate` | Salin input menjadi draft baru. |
| `POST /api/calculations/{id}/archive` | Arsipkan atau pulihkan. |
| `GET /api/calculations/{id}/revisions/{revision}/report` | Snapshot final untuk report. |
| `GET /api/calculations/{id}/revisions/{revision}/export?format=pdf` | File PDF; format xlsx untuk Excel. |
| `POST /api/webhooks/purchases` | Menerima event terverifikasi dari source. |
| `POST /api/account/resend-activation` | Request generik dan rate limit. |

Endpoint auth memakai API library, bukan implementasi hashing sendiri. Client tidak boleh mengirim owner ID sebagai penentu kepemilikan. Semua error domain memiliki kode stabil, pesan Indonesia, dan field errors bila perlu. API memakai 401 untuk belum login, 403 untuk akses tidak aktif, 404 untuk ID milik user lain, dan 409 untuk konflik versi.

`finalize` memiliki request ID idempotent. Mengulang request setelah timeout tidak membuat revisi final dua kali. Server menolak finalize jika draft_version sudah berubah.

### 16.4 Config dan secret

```text
APP_BASE_URL
DATABASE_URL
AUTH_SECRET
PURCHASE_SOURCE_ID
PURCHASE_WEBHOOK_KEYS
ELIGIBLE_AI_FOOD_PRODUCT_IDS
EMAIL_FROM
SMTP_* atau EMAIL_PROVIDER_*
SUPPORT_CONTACT_URL
WORKER_CONFIG
```

Secret tidak memakai prefix `NEXT_PUBLIC_`. Konfigurasi signup publik harus menolak request tanpa entitlement/provisioning server, termasuk request langsung ke API auth. Origin allowlist bukan pengganti autentikasi.

## 17 Panel admin minimal

- Cari akun berdasarkan email; lihat status akun, akses, waktu pemberian, dan referensi purchase.
- Kirim ulang aktivasi melalui job email dengan cooldown.
- Lihat webhook failed, review_required, processed, dan ignored; tampilkan error yang sudah disanitasi.
- Proses ulang job yang gagal secara transient tanpa mengganti identity event.
- Cabut atau pulihkan grant secara manual dengan alasan wajib dan audit log; jangan mengaktifkan akun suspended diam-diam.
- Penyesuaian email pembelian memerlukan pemeriksaan purchase oleh admin dan audit; tidak memindahkan data resep tanpa keputusan yang jelas.
- Tidak ada impersonation pelanggan atau tombol membuka seluruh isi perhitungan pelanggan.
- Credential admin tidak berasal dari payload purchase. Admin pertama dibuat melalui proses server yang terkontrol.

## 18 Persyaratan nonfungsional

| Area | Target penerimaan |
|---|---|
| Responsif | Dapat digunakan pada lebar 360 px tanpa horizontal scroll form. |
| Aksesibilitas | Label eksplisit, navigasi keyboard, fokus terlihat, error terkait field, kontras setara WCAG AA. |
| Perhitungan | Perubahan input valid memperbarui ringkasan dalam <= 300 ms setelah debounce pada dataset 50 bahan. |
| Penyimpanan | Respons simpan normal p95 <= 2 detik pada lingkungan uji yang disepakati. |
| Ekspor | PDF dan XLSX contoh 50 bahan masing-masing selesai <= 10 detik pada lingkungan uji. |
| Webhook | Acknowledgement durable normal p95 <= 2 detik; provisioning normal <= 60 detik setelah diterima. |
| Keandalan | Restart app/worker tidak menghilangkan event atau email yang sudah tersimpan. |
| Browser | Chrome, Safari, Firefox, dan Edge versi yang masih didukung saat rilis; uji Safari iPhone dan Chrome Android. |
| Locale | Bahasa Indonesia, IDR, dan waktu WITA yang diberi label. |

Keamanan wajib: HTTPS; cookie session HttpOnly, Secure, dan SameSite sesuai library; CSRF/origin checks untuk mutasi dengan cookie; rate limit login, reset, aktivasi, webhook, dan ekspor; output escaping; validasi file name; pembatasan body; private cache policy untuk report dan API akun.

Auth atau proxy bukan satu-satunya lapisan kontrol. Setiap query memastikan user ID yang sesuai. UUID tidak dianggap sebagai pengganti ownership check. Rate limit dan lock worker menggunakan penyimpanan bersama, bukan memory satu proses.

Target backup awal: database harian, retensi minimal 7 hari, dan uji restore sebelum rilis. Pantau error server, umur job pending, kegagalan worker, email failed, webhook conflicts, serta ekspor gagal. Log memakai request ID dan event ID tanpa token atau password.

## 19 Kriteria penerimaan dan pengujian

### 19.1 Matriks fungsional

| ID | Skenario | Hasil yang wajib |
|---|---|---|
| AC01 | Form dibuka pada HP | Blok dan kartu bahan terbaca; label tetap terlihat; tidak ada input bergaya percakapan. |
| AC02 | Input nama usaha dan produk | Nama yang tersimpan muncul sama di report, PDF, dan Excel. |
| AC03 | Tambah atau hapus bahan | Total diperbarui; baris sebagian terisi ditandai saat finalize. |
| AC04 | Bahan 10 kg x Rp15.000 | Subtotal Rp150.000, tanpa pengalian faktor 1.000 tambahan. |
| AC05 | Ubah bahan tersebut ke gram | Jumlah 10.000 g, harga Rp15/g, subtotal tetap Rp150.000. |
| AC06 | Ubah gram menjadi ml | Tidak ada konversi otomatis; pengguna mengonfirmasi pengisian ulang. |
| AC07 | Skenario brownies bagian 11 | B Rp70.000, K Rp10.000, L Rp15.000, O Rp5.000, T Rp100.000, C Rp10.000. |
| AC08 | Kategori tenaga kerja belum dihitung | Hasil dapat disimpan sebagai estimasi; label belum dihitung muncul pada semua report. |
| AC09 | Kategori tidak ada biaya | Nilai 0 dibedakan dari belum dihitung. |
| AC10 | Target margin 30% tanpa pajak | Harga target dan saran sama dengan bagian 11.2. |
| AC11 | Harga manual Rp13.000 atau Rp9.000 | Margin lebih rendah atau negatif; status tepat; input tidak ditolak karena di bawah biaya. |
| AC12 | Pajak exclusive dan inclusive | Nilai sesuai bagian 11.2; pajak tidak menambah HPP atau margin. |
| AC13 | Pajak nonaktif | Tarif yang tersimpan sebelumnya tidak memengaruhi harga; report menampilkan nonaktif. |
| AC14 | Target 100%, N 0, atau jumlah negatif | Finalize ditolak dengan field error; tidak ada infinity/NaN. |
| AC15 | Total biaya 0 | Draft dapat disimpan; finalize tidak menghasilkan saran harga. |
| AC16 | Ganti batch 10 menjadi 20 | Jumlah bahan dan upah tidak diam-diam digandakan; petunjuk pemeriksaan muncul. |
| AC17 | Margin atau bahan diubah setelah harga manual | Harga manual tetap; margin aktual diperbarui; saran baru terpisah. |
| AC18 | Dua tab mengubah draft | Konflik versi 409; tidak ada overwrite diam-diam. |
| AC19 | Retry finalize karena timeout | Revisi baru hanya dibuat sekali untuk request ID yang sama. |
| AC20 | Duplikat dan arsip | ID baru dan draft untuk duplikasi; arsip dapat dipulihkan. |
| AC21 | Export revisi yang sama | Angka dan status biaya cocok antara layar, PDF, dan Excel. |
| AC22 | Report 100 bahan dan nama panjang | PDF memiliki pagination baik; header berulang; nominal tidak terpotong. |
| AC23 | Teks bahan diawali = atau @ | Excel menyimpan teks, bukan formula. |

### 19.2 Matriks akun dan integrasi

| ID | Skenario | Hasil yang wajib |
|---|---|---|
| AC24 | Purchase paid eligible, email baru | Satu akun pending, satu grant per item eligible, job aktivasi dibuat. |
| AC25 | Email sudah aktif | Akun lama digunakan; password dan profil tidak ditimpa. |
| AC26 | Event sama dikirim berulang | Tidak ada akun, grant, atau job email pembelian tambahan. |
| AC27 | Event ID sama dengan isi berbeda | Respons 409; tidak ada perubahan akses. |
| AC28 | Signature salah atau expired delivery | Ditolak 401; akun dan grant tidak dibuat. |
| AC29 | Produk tidak eligible atau belum paid | Tidak diberi akses meskipun body memiliki nama AI Prompt Food. |
| AC30 | SMTP gagal | Akun dan grant tetap; retry email tercatat. |
| AC31 | Database gagal sebelum inbox tersimpan | Tidak mengakui 202; sender dapat retry. |
| AC32 | Worker crash setelah akun dibuat | Pemrosesan pulih; akun kedua tidak dibuat. |
| AC33 | Refund versi 2 tiba sebelum paid versi 1 | Paid lama tidak mengaktifkan kembali grant. |
| AC34 | Dua pembelian, satu refund penuh | Grant refund dicabut; grant paid lain mempertahankan akses. |
| AC35 | Refund sebagian | Review admin; akses tidak dicabut otomatis. |
| AC36 | Token aktivasi dipakai dua kali | Submit kedua ditolak; GET pemindai email tidak menghabiskan token. |
| AC37 | Reset password berhasil | Sesi lain dicabut; token reset tidak dapat digunakan kembali. |
| AC38 | Pengguna A meminta report/ekspor milik B | Ditolak 404; data tidak bocor. |
| AC39 | User login tanpa grant aktif | Tidak dapat memakai form, report, atau export melalui UI maupun API. |
| AC40 | Signup publik dipanggil langsung | Tidak membuat akun atau akses kalkulator. |

### 19.3 Strategi pengujian

- Unit test mesin decimal: seluruh contoh harga, pajak, subtotal, margin, dan konversi.
- Property test yang bermakna: konversi dalam kelompok tidak mengubah subtotal; pembulatan tidak menurunkan harga target; pajak tidak mengubah C.
- Integration test: transaksi, dedup concurrent, worker retry, token, access checks, dan snapshot export.
- End to end: aktivasi sampai report, edit harga, save conflict, ekspor, dan isolasi data dua akun.
- Uji manual pada HP dan desktop: input angka, label, fokus, error, serta PDF multi-halaman.
- Uji pemahaman dengan 5 calon pengguna UMKM: target awal 4 dari 5 dapat menyelesaikan satu contoh dan menjelaskan jumlah bahan serta harga per satuannya tanpa bantuan lisan.

Tidak menguji hanya keberadaan komponen. Pengujian harus membuktikan ketepatan angka, akses, dan pemulihan alur yang dapat gagal.

## 20 Pengukuran keberhasilan

| Metrik | Definisi | Target awal rancangan |
|---|---|---|
| Aktivasi pembeli | Akun baru yang mengaktifkan password dibanding akun baru yang mendapat akses | Dipantau pada pilot; baseline dari data nyata. |
| Keberhasilan perhitungan pertama | User aktif yang menyimpan hasil pertama setelah mulai form | >= 80% pada uji usability. |
| Waktu form contoh | Durasi menyelesaikan resep uji dengan 5 bahan dan biaya lain | Median <= 5 menit pada uji terarah. |
| Ketepatan kalkulasi | Kasus acuan dan invariants lulus | 100% sebelum rilis. |
| Keandalan provisioning | Event eligible valid yang akhirnya diproses | Semua event uji berhasil termasuk setelah retry. |
| Ekspor berhasil | Request export sukses dari snapshot valid | >= 99% pada pilot, jika volume memadai untuk penilaian. |

Event analytics minimum: `activation_completed`, `calculation_started`, `calculation_finalized`, `export_completed`, `export_failed`, dan `provisioning_failed`. Tidak mengirim nama bahan, harga rinci, isi resep, email, atau token ke analytics pihak ketiga.

## 21 Tahap pengembangan dan peluncuran

### Tahap 1 Fondasi

- Buat Next.js, database, schema input, dan mesin decimal.
- Implementasi auth dan uji provisioning server, aktivasi, signup tertutup, serta ownership.
- Bangun inbox/outbox, source adapter, signature, dedup, dan worker sebelum menyambungkan transaksi produksi.

### Tahap 2 Form dan hasil

- Blok input responsif, status biaya, validasi, draft, serta finalize revision.
- Report dengan rincian, margin, pajak, dan contoh acuan yang lulus.
- Daftar perhitungan, profil, duplikasi, arsip, dan konflik antar-tab.

### Tahap 3 Ekspor dan operasional

- PDF dan XLSX membaca snapshot yang sama.
- Panel admin integrasi minimal, retry, audit, dan monitoring.
- Rate limit, backup, restore, dan konfigurasi server.

### Tahap 4 Pilot dan rilis

- Uji contoh lengkap, webhook berulang, refund tidak berurutan, kegagalan SMTP, dan akses dua akun.
- Uji calon pengguna dan revisi label yang terbukti membingungkan.
- Hubungkan source penjualan dengan allowlist produk yang benar.
- Rilis setelah checklist selesai; pantau aktivasi, job tertunda, error ekspor, dan pertanyaan dukungan.

Checklist rilis:

- [ ] Semua AC01 sampai AC40 lulus atau memiliki penyesuaian spesifikasi tertulis yang disetujui pemilik produk.
- [ ] Source membuktikan pembayaran verified server dan mengirim ID produk stabil.
- [ ] Secret, URL, allowlist produk, SMTP, serta kontak bantuan terisi.
- [ ] Kebijakan akses dan refund cocok dengan penawaran AI Prompt Food.
- [ ] Public signup tertutup dan tidak ada bypass akses produksi.
- [ ] Worker berjalan durable; retry dan monitoring aktif.
- [ ] Report dan export tepat serta terbaca pada dataset panjang.
- [ ] Backup dan pemulihan pernah diuji.
- [ ] Pilot menunjukkan pengguna memahami jumlah dipakai dan harga per satuan.

## 22 Konfigurasi yang perlu dilengkapi sebelum integrasi produksi

| Item | Yang harus disediakan | Pengembangan yang dapat berjalan dahulu |
|---|---|---|
| ID atau SKU AI Prompt Food | Allowlist dari sistem penjualan nyata | Auth, form, kalkulasi, dan webhook fixture. |
| Format transaksi existing | Mapping ke kontrak bagian 14 dan cara menghasilkan state_version | Source adapter dengan contoh event uji. |
| URL aplikasi HPP | APP_BASE_URL dan origin yang disetujui | Route relatif dan development environment. |
| Email transaksi | Sender, provider, credential, serta template final | Outbox dan fake email provider pada test. |
| Kebijakan akses | Konfirmasi tanpa expiry atau batas lain | Grant expires_at nullable dengan default dokumen. |
| Kebijakan refund | Pencabutan penuh dan penanganan refund sebagian | State machine dan audit sesuai default dokumen. |
| Brand report | Nama aplikasi final dan identitas ringan | Report dengan nama kerja. |
| Hosting | Runtime Node, PostgreSQL, worker, HTTPS, backup | Aplikasi lokal dan test environment. |

Kekosongan konfigurasi tidak menghalangi pembangunan fitur lokal, tetapi integrasi paid produksi tidak boleh memakai ID contoh, signature bypass, atau status pembayaran buatan. Dokumen ini mendefinisikan kontrak usulan; perubahan pada checkout existing harus berdasarkan struktur backend yang benar-benar tersedia.

## 23 Rujukan implementasi

Rujukan diperiksa pada 1 Oktober 2026. Spesifikasi UX, batas input, default, endpoint domain, dan kebijakan operasional dalam dokumen merupakan rancangan produk ini.

1. [Next.js authentication](https://nextjs.org/docs/app/guides/authentication) untuk pemisahan autentikasi, sesi, dan otorisasi server.
2. [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route) untuk endpoint aplikasi.
3. [Better Auth email dan password](https://better-auth.com/docs/authentication/email-password) untuk auth, reset password, dan konfigurasi credential.
4. [Better Auth admin](https://better-auth.com/docs/plugins/admin) sebagai salah satu rujukan provisioning terkontrol.
5. [GitHub webhook validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) untuk validasi HMAC pada body asli.
6. [Xero margin dan markup](https://www.xero.com/uk/glossary/margin-vs-markup/) untuk definisi serta rumus margin.
7. [Dinas Koperasi dan UKM Jawa Tengah mengenai HPP](https://diskop-ukm.jatengprov.go.id/berita/pentingnya-harga-pokok-produksi-(hpp)-bagi-umkm) untuk komponen biaya produksi.
8. [JDIH Kementerian Keuangan PMK 70 tahun 2022](https://jdih.kemenkeu.go.id/dok/70-pmk-03-2022/view) untuk konteks perbedaan perlakuan makanan/minuman dan PPN.
9. [W3C form instructions](https://www.w3.org/WAI/tutorials/forms/instructions/) untuk label dan petunjuk form yang dapat diakses.
10. [Microsoft spesifikasi dan batasan Excel](https://support.microsoft.com/id-id/excel/excel-specifications-and-limits) untuk batas presisi sel numerik.

## 24 Definisi selesai

Versi pertama selesai ketika pembeli yang berhak dapat memperoleh akun melalui webhook, mengaktifkannya, mengisi form blok tanpa bantuan teknis, mendapatkan HPP dan simulasi harga yang tepat, menyimpan perhitungan miliknya, serta mengunduh PDF dan Excel yang konsisten. Kegagalan transaksi integrasi dapat dipulihkan dan data satu akun tidak dapat diakses akun lain.
