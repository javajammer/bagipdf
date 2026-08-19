# BagiPDF - Roadmap & Feature Implementation Plan

Dokumen ini mencatat seluruh rencana kerja, fitur utama, status implementasi **yang akurat**, serta histori pembaruan aplikasi **BagiPDF** (Powered by Rust & Tauri).

> **⚠️ Aturan Wajib:** Setiap kali fitur selesai dibuat atau diperbarui, perbarui dokumen ini sebelum commit.

---

## 📊 Status Ringkasan Proyek

- **Versi Saat Ini**: `v2.3.1`
- **Arsitektur**: 100% Offline Local First — React 19 + Vite + TailwindCSS + Rust + Tauri v2
- **Lisensi**: MIT License
- **Stack Aktif**: `webapp/` (Tauri). Legacy Python `main.py` dan Electron sudah pensiun (arsip di `legacy/`).
- **Network / Access Requirement**: Aplikasi restricted dan **HANYA dapat diakses jika perangkat terhubung dengan IP Publik: `182.253.235.144`**.

---

## 🎯 Daftar Fitur & Status Implementasi

> **Legenda:**
> - `[x]` = Selesai & berfungsi penuh
> - `[~]` = Sebagian terimplementasi / ada bug/gap yang diketahui
> - `[ ]` = Belum diimplementasikan

---

### 1. ✂️ Split PDF Suite (Pemotong PDF)
- [x] **Split per N Halaman (Fixed Range)**: Membagi PDF setiap sekian halaman yang ditentukan.
- [x] **Split Rentang Halaman Custom**: Memilih range tertentu (misal: hal 1-5, 8, 11-15).
- [x] **Split Berdasarkan Ukuran File Maximum (O(N))**: Memotong PDF agar tiap chunk hasil tidak melebihi batasan ukuran MB tertentu.
- [x] **Visual Thumbnail Page Selector**: Pratinjau visual per halaman dengan opsi pilih/hapus halaman sebelum dipotong.
- [x] **Export Multi-format**: Download sebagai single PDF atau arsip ZIP.
- [~] **Enkripsi Output Setelah Split**: Menggunakan `ignoreEncryption:true` sehingga PDF yang sudah terproteksi dapat diproses tanpa memasukkan password sebelumnya. *(Gap — lihat SEC-2 di fsd.md)*

### 2. 🧩 Merge & Organize PDF Suite (Penggabung PDF)
- [x] **Multi-file PDF Upload**: Menggabungkan banyak file PDF menjadi 1 file master.
- [x] **Drag & Drop Reordering**: Menyusun ulang urutan file PDF yang akan digabung.
- [x] **Per-file Page Selection**: Memilih halaman tertentu dari tiap file PDF.
- [~] **Proteksi Password Saat Merge**: File PDF terkunci dapat di-merge tanpa memasukkan password terlebih dahulu (bypass `ignoreEncryption:true`). *(Gap — SEC-2)*

### 3. 🔐 PDF Security & Encryption Suite (Proteksi PDF)
- [x] **Standalone Lock & Protect Module**: Modul khusus untuk mengunci PDF dengan kata sandi.
- [x] **AES-256 PDF Standard Encryption**: Menggunakan `@pdfsmaller/pdf-encrypt-lite` dengan standar enkripsi PDF 1.7. *(Berlaku penuh HANYA di modul Lock)*
- [x] **Password Protection Modal Prompt**: Modal interaktif otomatis saat membuka file PDF yang dienkripsi.
- [~] **Konsistensi Enkripsi di Semua Modul**: Split, Merge, Watermark, Edit masih menggunakan enkripsi RC4 legacy atau bypass `ignoreEncryption:true`. *(Gap HIGH — SEC-1, SEC-2 di fsd.md)*

### 4. 🏷️ Watermark & Edit Suite (Stempel & Editor Teks)
- [x] **Text Watermark**: Teks watermark dengan kustomisasi font size, warna, rotasi (-90° s/d 90°), dan transparansi.
- [x] **Image/Logo Watermark**: Upload gambar/logo (.png, .jpg) sebagai watermark overlay.
- [x] **Live Canvas Interactive Preview**: Simulasi pratinjau watermark real-time di atas halaman PDF.
- [x] **Annotation & Text Overlay**: Menambahkan catatan/teks kustom di halaman tertentu.
- [~] **Watermark Posisi Diagonal**: State `diagonal` sudah ada di kode tapi tidak ada opsi UI untuk memilihnya. *(Gap — CORR-3)*
- [~] **Dukungan Karakter Non-ASCII (CJK/Emoji)**: `sanitizeWinAnsi` menghapus semua karakter non-Latin sehingga teks bahasa Indonesia/Jepang/Mandarin tidak tampil di Edit PDF. *(Gap — CORR-2)*

### 5. 📊 Batch PDF to Excel Suite (Konversi Massal PDF ke Excel)
- [x] **Scale Hingga 2.000 File PDF**: Chunked async processing tanpa UI freeze.
- [x] **Folder Upload Support (`webkitdirectory`)**: Pembacaan seluruh folder lokal sekaligus.
- [x] **Ebupot Unifikasi 21/26 (DJP) Extractor**: Ekstraksi otomatis 19 kolom terstruktur Bukti Potong Pajak DJP (BPPU).
- [x] **Generic Table Extractor**: Ekstraksi tabel generik berbasis posisi koordinat teks.
- [x] **Output Mode**: 1 File Excel Master (.xlsx konsolidasi) atau Arsip ZIP file Excel individual.
- [x] **Formula Injection Safe Guard**: Netralisasi karakter `=`, `+`, `-`, `@` dari sel Excel.
- [x] **Real-time Progress & Paginated Grid Preview**: Visualisasi progres real-time, pencarian, dan paginasi (50 baris/hal).
- [x] **Sticky Action Buttons (UX Upgrade v2.3.1)**: Tombol "Mulai Konversi" & "Unduh Hasil Excel" berada di atas sidebar, tanpa perlu scroll.
- [x] **Per-item Delete dari Batch List**: Tombol hapus individual file dari daftar antrian batch.
- [~] **Y-axis Grouping Akurasi**: Pengelompokan baris berdasarkan bucket Y `round(y/10)*10` masih kasar untuk dokumen dengan layout rapat. *(Gap — CORR-4)*

### 6. 🚀 Packaging, Deployment & CI/CD
- [x] **Windows Portable (.exe via NSIS)**: Build biner portabel.
- [x] **Windows Installer (.msi)**: Paket installer resmi Windows.
- [x] **Linux Debian Package (.deb)**: Distribusi untuk Pop!_OS/Ubuntu/Debian.
- [x] **Linux AppImage**: Format portabel untuk semua distro Linux.
- [x] **GitHub Actions CI/CD**: Cross-platform build otomatis & upload GitHub Releases.
- [ ] **Automated Unit Tests di CI**: Tidak ada job test (Vitest / cargo test). *(Gap HIGH — QA-1)*

---

## 🐛 Known Bugs & Technical Debt (Harus Diselesaikan Sebelum Fitur Baru)

> Ini bukan backlog fitur baru, tapi **utang teknis** yang mempengaruhi kualitas & keamanan produk.

| ID | Tingkat | Deskripsi | Status |
|---|---|---|---|
| SEC-1 | 🔴 HIGH | Enkripsi RC4 40-bit masih digunakan di jalur Split/Merge output (bukan hanya Lock) | Belum diperbaiki |
| SEC-2 | 🔴 HIGH | `ignoreEncryption:true` di Split/Merge/Watermark/Edit — PDF terkunci bisa diproses tanpa password | Belum diperbaiki |
| QA-1 | 🔴 HIGH | Tidak ada unit test & tidak ada test job di CI GitHub Actions | Belum diperbaiki |
| CORR-2 | 🟡 MED | Karakter Non-ASCII dihapus di Edit PDF (`sanitizeWinAnsi`) | Belum diperbaiki |
| CORR-4 | 🟡 MED | Grouping baris Y di PDF→Excel kasar (bucket 10-unit) | Belum diperbaiki |
| MEM-1 | 🟡 MED | Semua thumbnail halaman di-render sekaligus (risiko OOM di PDF >200 hal) | Belum diperbaiki |
| CORR-3 | 🟢 LOW | Watermark posisi `diagonal` mati — tidak ada UI untuk memilihnya | Belum diperbaiki |
| MAINT-4 | 🟢 LOW | `greet()` di `main.rs` adalah dead code | Belum diperbaiki |

---

## 🔮 Roadmap Fitur Mendatang

> **Penting:** Backlog di bawah hanya mulai dikerjakan **setelah** semua bug 🔴 HIGH di atas selesai.

### Phase 3.1 — Security Hardening (Prioritas Tertinggi)
*Estimasi: 1–2 sprint indie*
- [ ] **Perbaiki SEC-2**: Hapus `ignoreEncryption:true`. Muat PDF terkunci dengan password; tolak proses jika password salah di semua modul (Split, Merge, Watermark, Edit).
- [ ] **Perbaiki SEC-1**: Terapkan AES-256 (`@pdfsmaller/pdf-encrypt-lite`) secara konsisten di semua modul yang menghasilkan output PDF, bukan hanya modul Lock.
- [ ] **Tambah Unit Test**: Setup Vitest untuk `parseRanges`, `sanitizeExcelCell`, split-by-size logic; tambahkan job `test` di GitHub Actions CI.

### Phase 3.2 — UX & Correctness Polish
*Estimasi: 1 sprint indie*
- [ ] **Perbaiki CORR-2**: Ganti `sanitizeWinAnsi` dengan font embedding yang mendukung Unicode penuh (untuk Edit PDF).
- [ ] **Perbaiki MEM-1**: Virtualisasi render thumbnail — hanya render halaman yang terlihat di viewport, bukan semua halaman sekaligus.
- [ ] **Perbaiki CORR-3**: Tambahkan opsi UI "Posisi Diagonal" di Watermark Suite.
- [ ] **Ganti `alert()` dengan Toast/Modal**: Standarisasi error handling agar konsisten di seluruh aplikasi.

### Phase 3.3 — Monetisasi PRO License System
*Prasyarat: Phase 3.1 harus selesai terlebih dahulu (keamanan minimum)*
*Estimasi: 3–4 sprint indie*

**Model Bisnis:**
- **Gratis**: Semua fitur (Split, Merge, Watermark, Edit, Protect) + Ebupot 1 file.
- **PRO (berbayar)**: Batch/Folder Ebupot s/d 2.000 file.
- **Payment Gateway**: Midtrans Snap.js (akun sudah tersedia).

**Implementasi — Urutan Wajib Berurutan:**

1. **[Server] Setup RSA Keypair** — Generate RS256 keypair. Private key di server, public key di-embed ke binary Rust. *Ini wajib pertama karena semua fase bergantung padanya.*
2. **[Server] Backend Web Portal** (Node.js/PHP):
   - Endpoint `POST /v1/checkout` → integrasi Midtrans Snap.js
   - Webhook Midtrans: handle `payment.success` → generate License Key `BPDF-XXXX-XXXX-XXXX-XXXX`
   - Kirim key via email otomatis
   - Endpoint `POST /v1/licenses/activate` → verifikasi key + device fingerprint → return signed JWT
   - Endpoint `POST /v1/licenses/deactivate` → hapus binding device
   - Halaman web "Kelola Perangkat" — lihat & deactivate device terdaftar
3. **[Rust] License Layer** (`src-tauri/src/main.rs`):
   - `activate_license(key, device_fp)` → hit server, simpan JWT terenkripsi AES-256-GCM (`license.dat`)
   - `check_license()` → verifikasi JWT offline dengan public key embedded; cek `device_fp == claims.device_fp`
   - Anti clock-rollback: simpan & cek `last_seen` timestamp
   - Multi-checkpoint: cek di startup, sebelum batch, tiap 50 file dalam loop, sebelum export
   - `clear_license()` → hapus `license.dat` (untuk deaktivasi manual)
4. **[React UI] Activation Flow**:
   - Modal aktivasi: input license key → invoke `activate_license` → feedback sukses/gagal
   - Badge "PRO" di header jika lisensi aktif
   - Gate fitur batch Ebupot (>1 file): tampilkan prompt beli jika bukan PRO
5. **[QA] Security Testing Monetisasi**:
   - Test bypass DevTools (semua verifikasi di Rust, bukan JS)
   - Test salin `license.dat` antar PC (harus gagal karena fingerprint berbeda)
   - Test manipulasi clock system
   - Test rate limit aktivasi
6. **[Release] v2.4.0** — Deploy server, update build, release.

**Hardening Anti-Gandakan (wajib ada di langkah 3):**
- Device fingerprint 4–5 sumber: Windows (MachineGuid + SMBIOS UUID + disk serial + MAC) / Linux (machine-id + DMI product_uuid + disk serial + MAC) → SHA-256 + salt app. Toleransi 1 sumber berubah.
- Nonce aktivasi single-use + rate limit di server
- Key rotation support via `kid` di JWT header
- Batas aktivasi per key (mis. 3 device); server-side management

### Phase 4.0 — Extended Features (Opsional / Validasi Pasar Dulu)
*Hanya dikerjakan setelah Phase 3.3 selesai dan ada permintaan nyata dari pengguna*
- [ ] **PDF Compress & Lossless Optimization**: Pengecilan ukuran file PDF (kompresi gambar & font stream). *Feasibility: Sedang — perlu library Rust (lopdf) atau WASM*
- [ ] **PDF to Image (PNG/JPG High-Res)**: Ekspor halaman PDF menjadi gambar batch resolusi tinggi. *Feasibility: Mudah — bisa menggunakan canvas pdfjs-dist yang sudah ada*
- [ ] **OCR (Optical Character Recognition)**: Ekstraksi teks dari PDF scan/gambar. *Feasibility: Kompleks — perlu Tesseract WASM (~10MB) atau Rust native; hati-hati terhadap ukuran bundle*
- [ ] **Digital Signature (e-Sign)**: Tanda tangan digital berbasis sertifikat .p12/.pfx. *Feasibility: Sangat Kompleks — perlu library kriptografi PDF yang mendukung CMS/PKCS#7; belum ada library JS/WASM yang matang*

---

## 📋 Open Questions yang Masih Belum Dijawab (dari FSD)

| ID | Pertanyaan | Status |
|---|---|---|
| PQ-03 | Platform pembayaran untuk monetisasi? | ✅ Midtrans (akun sudah ada) |
| PQ-04 | Apakah macOS masuk roadmap? | ❌ Backlog — tidak dijadwalkan |
| AQ-OPEN-04 | Target performa riil (NFR-001/002)? | ❌ Belum pernah dibenchmark |

---

## 📝 Changelog Pembaruan Dokumen Ini

| Versi | Tanggal | Perubahan |
|---|---|---|
| v2.3.1 | 14 Agt 2026 | Revisi major: koreksi status `[~]` untuk fitur partial, reorder backlog (security dulu), detil monetisasi diperjelas dengan urutan dependency, tambah Known Bugs table, tambah feasibility notes di Phase 4 |
| v2.3.0 | 14 Agt 2026 | Dokumen pertama dibuat |
