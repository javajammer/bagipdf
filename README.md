# BagiPDF

Aplikasi desktop modern GUI untuk memotong/memisahkan file PDF dengan fitur lengkap, dikemas khusus dalam bentuk **satu file `.exe` portabel (standalone)** tanpa memerlukan proses instalasi. Ditujukan untuk sistem operasi **Microsoft Windows (Windows 11 & Windows 10) 64-bit (x86_64)**.

---

## 👨‍💻 Informasi Pengembang & Versioning

- **Nama Aplikasi**: BagiPDF
- **Versi**: `v1.1.0`
- **Pengembang**: Franky Setiawan
- **Website**: [https://www.frm.web.id](https://www.frm.web.id)

---

## 🌟 Fitur Utama

1. **Custom Range (Rentang Halaman Kustom)**
   - Ekstrak rentang halaman tertentu (misal: `1-3, 5, 8-12`).
   - Pilihan untuk menggabungkan (*merge*) rentang terpilih ke dalam 1 file PDF tunggal atau dipisah per rentang.

2. **Fixed Range (Rentang Halaman Tetap)**
   - Memotong PDF secara konstan setiap *N* halaman (misal: setiap 2 halaman menjadi 1 PDF terpisah).

3. **Extract Pages (Ekstraksi Halaman Halaman demi Halaman)**
   - Ekstrak seluruh halaman menjadi PDF terpisah (*1 file per halaman*).
   - Ekstrak halaman-halaman pilihan spesifik.

4. **Split by File Size (Split berdasarkan Ukuran File)**
   - Membagi PDF menjadi beberapa bagian sesuai target ukuran maksimal file (misal: maks 2MB per file).

5. **Visual Page Preview (macOS Style Viewer)**
   - Menampilkan pratinjau visual seluruh halaman PDF secara nyata dengan desain macOS Dark Mode Glassmorphism.

---

## 🛠️ Cara Membuat / Build File `.exe` Standalone (`BagiPDF-v1.1.0.exe`)

### Metode 1: Menggunakan GitHub Actions (Otomatis & Tanpa Install Apapun)
1. Push repositori ini ke GitHub.
2. Buka tab **Actions** di repositori GitHub Anda.
3. Jalankan workflow **Build Windows Executable (BagiPDF)**.
4. Setelah selesai, unduh artifact `BagiPDF-Windows-x64` yang berisi file `BagiPDF-v1.1.0.exe`.

### Metode 2: Kompilasi Lokal (OS Windows)
Jalankan perintah berikut di PowerShell / Command Prompt pada lingkungan Windows:

```bash
cd webapp
npm install
npm run dist:win
```

Hasil file executable akan berada di folder `dist_electron/BagiPDF-v1.1.0.exe`.
