# BagiPDF

Aplikasi desktop modern GUI untuk memotong/memisahkan file PDF dengan fitur lengkap, dikemas khusus dalam bentuk **satu file `.exe` portabel (standalone)** tanpa memerlukan proses instalasi. Ditujukan untuk sistem operasi **Microsoft Windows (Windows 11 & Windows 10) 64-bit (x86_64)**.

---

## 👨‍💻 Informasi Pengembang & Versioning

- **Nama Aplikasi**: BagiPDF
- **Versi**: `v2.1.0` (Rust & Tauri Engine)
- **Pengembang**: Franky Setiawan
- **Website**: [https://www.frm.web.id](https://www.frm.web.id)

---

## 🌟 Fitur Utama (Full PDF Suite)

1. **Split PDF (Pemotong PDF)**
   - **Custom Range**: Ekstrak rentang halaman kustom (`1-3, 5, 8-12`) terpisah atau digabung.
   - **Fixed Range**: Memotong PDF secara periodik tiap *N* halaman.
   - **Extract Pages**: Ekstrak halaman per halaman secara individual.
   - **Split by Size**: Membagi PDF agar setiap file tak melebihi target ukuran (MB).

2. **Merge PDF (Penggabung PDF)**
   - Mengunggah 2 atau lebih file PDF sekaligus.
   - Mengatur urutan file (naik/turun) sebelum digabungkan menjadi 1 file PDF tunggal.

3. **Watermark PDF (Cap & Stempel)**
   - Menambahkan Watermark **Teks** atau **Gambar Logo**.
   - Pengaturan kustom: Ukuran font, warna, sudut rotasi, dan transparansi (opacity) dengan simulasi pratinjau visual.

4. **Edit PDF (Tambah Catatan / Teks)**
   - Menambahkan teks/catatan ke halaman PDF manapun dengan pilihan font, warna, dan target halaman.

5. **PDF to Excel (Ekstrak ke Spreadsheet .xlsx)**
   - Mengekstrak data tabel/teks terstruktur dari halaman PDF langsung ke spreadsheet **Excel (`.xlsx`)**.

6. **Password & Keamanan PDF**
   - Mendukung pembukaan file PDF yang dilindungi kata sandi dengan modal prompt otomatis.
   - Pratinjau visual halaman modern gaya macOS Dark Mode Glassmorphism.

---

## 🛠️ Cara Membuat / Build File `.exe` Standalone (`BagiPDF-v2.0.0.exe`)

### Metode 1: Menggunakan GitHub Actions (Otomatis & Tanpa Install Apapun)
1. Push repositori ini ke GitHub.
2. Buka tab **Actions** di repositori GitHub Anda.
3. Jalankan workflow **Build Windows Executable (BagiPDF Rust & Tauri v2.0.0)**.
4. Setelah selesai, unduh artifact `BagiPDF-Windows-x64` yang berisi file `BagiPDF-v2.0.0.exe`.

### Metode 2: Kompilasi Lokal (OS Windows)
Jalankan perintah berikut di PowerShell / Command Prompt pada lingkungan Windows:

```bash
cd webapp
npm install
npm run dist:win
```

Hasil file executable akan berada di folder `dist_electron/BagiPDF-v2.0.0.exe`.

---

## ℹ️ Catatan Menjalankan File `.exe` di Windows (SmartScreen)

Tampilan **"Windows protected your PC" (Microsoft Defender SmartScreen)** adalah peringatan keamanan bawaan Windows untuk aplikasi baru/bebas komersial yang belum membeli sertifikat *Code Signing* berbayar.

### Cara Membuka Aplikasi:
1. Klik teks **"More info"** di bagian kiri atas jendela peringatan tersebut.
2. Klik tombol **"Run anyway"** yang muncul di sudut kanan bawah.
3. Aplikasi **BagiPDF** akan langsung terbuka dan siap digunakan.

