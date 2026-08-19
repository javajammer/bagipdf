[![Build BagiPDF Executables & Packages (Windows & Linux)](https://github.com/javajammer/bagipdf/actions/workflows/build-windows.yml/badge.svg)](https://github.com/javajammer/bagipdf/actions/workflows/build-windows.yml)

# BagiPDF

Aplikasi desktop modern GUI untuk memotong/memisahkan, menggabungkan, mengedit, serta mengekstraksi data PDF ke Excel secara otomatis. Dikembangkan menggunakan teknologi modern **Rust & Tauri v2**, bebas ketergantungan server (100% lokal & aman).

---

## 👨‍💻 Informasi Pengembang & Versioning

- **Nama Aplikasi**: BagiPDF (Edisi Terbatas / Restricted Edition)
- **Versi**: `v2.3.2-restricted` (Rust & Tauri Engine)
- **Pengembang**: Muhammad Fahrizal Rahman
- **Keamanan IP Access**: HANYA dapat diakses dari IP Publik **`182.253.235.144`**
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

5. **PDF to Excel (Batch Ekstrak ke Spreadsheet .xlsx)**
   - Mengekstrak data tabel/teks terstruktur dari halaman PDF langsung ke spreadsheet **Excel (`.xlsx`)**.
   - Mendukung parsing format **Ebupot Unifikasi 21/26** (Nomor Dokumen, NPWP, NITKU / Subunit Organisasi Pemotong, Nama Pemotong, Tanggal, dll).

6. **Password & Keamanan PDF**
   - Mendukung pembukaan file PDF yang dilindungi kata sandi dengan modal prompt otomatis.
   - Enkripsi AES-256 lokal tanpa server.

---

## 🛠️ Cara Kompilasi / Build Executable

### 1. Build Lokal di Laptop (Menggunakan `build_local.sh`)

Gunakan script [`build_local.sh`](build_local.sh) untuk melakukan build executable langsung di laptop Anda tanpa menunggu CI/CD GitHub.

#### Prasyarat System Linux (Ubuntu / Pop!_OS / Debian):
Jika Anda kompilasi di OS Linux, install seluruh pustaka pengembangan Tauri berikut:
```bash
sudo apt-get update && sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  libwayland-dev \
  libsoup-3.0-dev
```

#### Menjalankan Script Build Lokal:
```bash
# Berikan akses eksekusi & jalankan script:
chmod +x build_local.sh
./build_local.sh
```

Hasil file executable & package installer akan otomatis dihasilkan di:
- **Binary/Exe**: `webapp/src-tauri/target/release/`
- **Package (.deb/.msi/.exe/AppImage)**: `webapp/src-tauri/target/release/bundle/`

---

### 2. Build Otomatis via GitHub Actions (Windows & Linux)
Setiap kali melakukan `git push` ke repositori ini, GitHub Actions akan otomatis memicu kompilasi executable Windows (`.exe` / `.msi`) dan Linux (`.deb` / `AppImage`).

- Hasil build dapat diunduh di tab **Actions** pada bagian **Artifacts**.

---

## ℹ️ Catatan SmartScreen Windows

Tampilan **"Windows protected your PC" (Microsoft Defender SmartScreen)** adalah peringatan keamanan bawaan Windows untuk aplikasi bebas komersial yang belum membeli sertifikat *Code Signing* berbayar.

### Cara Membuka Aplikasi:
1. Klik teks **"More info"** di bagian kiri atas jendela peringatan tersebut.
2. Klik tombol **"Run anyway"** yang muncul di sudut kanan bawah.
3. Aplikasi **BagiPDF** akan langsung terbuka dan siap digunakan.
