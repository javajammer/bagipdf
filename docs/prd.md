# Product Requirements Document (PRD) — BagiPDF

**Document Type:** PRD (Product Requirements Document)
**Version:** 1.2 (Updated)
**Date:** 14 Agustus 2026
**Author:** Muhammad Fahrizal Rahman
**Methodology:** Agile (indie / single-maintainer cadence)
**Audience:** VP / Product Owner
**Companion doc:** `docs/fsd.md` (spesifikasi fungsional & teknis)

---

## 1. Executive Summary

BagiPDF adalah **aplikasi desktop PDF all-in-one yang berjalan 100% offline** untuk
pengguna Windows & Linux. Produk ini menggabungkan enam alat utama — Split, Merge,
Watermark, Edit, PDF→Excel, dan Protect/Lock — ke dalam satu antarmuka gelap yang
ringan, tanpa instalasi (portable) untuk Windows. Differensiasi utama: **privasi
total (air-gapped), gratis, dan tanpa ketergantungan cloud**.

Status kode saat ini: aplikasi berbasis **Tauri + React + Rust** (implementasi legacy Python `main.py` dan Electron telah dipensiunkan dan hanya sebagai riwayat/historis). PRD ini mendefinisikan visi produk, ruang lingkup, metrik sukses, dan strategi monetisasi.

---

## 2. Problem Statement

Pengguna non-teknis sering butuh memotong/gabung/watermark PDF tetapi:
- Malas install software berat atau daftar akun cloud.
- Khawatir privasi dokumen sensitif (PDF berisi data pribahasa/keuangan) diunggah ke
  layanan online.
- Alat gratis umumnya berbasis web (butuh internet & unggah file).

BagiPDF menjawab dengan **toolkit lokal, offline, portable**.

---

## 3. Vision, Goals & Non-Goals

**Vision:** "PDF toolkit lengkap yang bisa dipercaya, gratis, dan privat — cukup
download satu file, jalan di komputer sendiri."

**Goals:**
- G-1: 6 fitur PDF inti dalam satu app offline.
- G-2: Enkripsi output setara standar industri (AES-256).
- G-3: Satu basis kode bermerek konsisten (hilangkan duplikasi).
- G-4: Build & rilis otomatis & reproducible via CI.

**Non-Goals:** OCR, editing vector mendalam, kolaborasi cloud, dukungan mobile,
lisensi enterprise (lihat FSD §2.2).

---

## 4. Target Users / Personas

| Persona | Kebutuhan | Fitur relevan |
|---|---|---|
| **Mahasiswa / Admin kantor** | Potong gabung modul, watermark "CONFIDENTIAL" | Split, Merge, Watermark |
| **Analis data** | Ekstrak tabel PDF ke Excel massal | PDF→Excel (batch) |
| **Pengguna privasi-sadar** | Kunci dokumen sensitif | Protect/Lock, offline |
| **Freelancer desain** | Cap logo ke proposal | Watermark gambar |

---

## 5. User Stories (prioritas P1/P2/P3)

| ID | Story | Priority | Acceptance |
|---|---|---|---|
| US-1 | Sebagai user, saya ingin memotong PDF berdasar rentang agar hanya bagian relevan tersimpan | P1 | FR-002/003/004/005 |
| US-2 | Sebagai user, saya ingin menggabung beberapa PDF berurutan | P1 | FR-006 |
| US-3 | Sebagai user, saya ingin menambah watermark agar dokumen teridentifikasi | P1 | FR-007/008 |
| US-4 | Sebagai analis, saya ingin konversi ratusan PDF ke Excel sekaligus | P1 | FR-010 |
| US-5 | Sebagai user privasi, saya ingin mengunci PDF dengan password kuat | P1 | FR-011, NFR-004 |
| US-6 | Sebagai user, saya ingin membuka PDF terkunci tanpa app lain | P1 | FR-012 |
| US-7 | Sebagai user, saya ingin preview halaman sebelum memproses | P2 | FR-013 |
| US-8 | Sebagai user, saya ingin menambah catatan ke PDF | P2 | FR-009 |

---

## 6. Feature Scope (ringkasan → FSD §4)

Split (4 mode) · Merge · Watermark (teks/gambar) · Edit teks · PDF→Excel batch ·
Protect/Lock · Preview · Save dialog native · Premium Batch PDF to Excel & Licensing System (Monetisasi via Subscription). Lihat tabel FR-001..017 di `fsd.md`.

---

## 7. Success Metrics (KPI)

| Metric | Target (asumsi — konfirmasi AQ-OPEN-04) | Sumber ukur |
|---|---|---|
| Waktu proses PDF 50 halaman | < 5 detik | Benchmark lokal |
| Crash rate | < 1% sesi | Log lokal (belum ada — QA-2) |
| Adopsi | N unduhan/bulan via frm.web.id | Web analytics |
| Enkripsi strength | AES-256 terverifikasi | Security test (SR-1) |
| CSAT | ≥ 4/5 | Feedback form (belum ada) |

---

## 8. Competitive Landscape / Differentiation

| Dimensi | BagiPDF | iLovePDF / Smallpdf (web) | Adobe Acrobat |
|---|---|---|---|
| Offline / privasi | ✅ penuh | ❌ unggah ke cloud | ⚠️ campuran |
| Biaya | Gratis (asumsi) | Freemium | Berbayar |
| Install | Portable/installer | Tidak (web) | Berat |
| Batch 2.000 file | ✅ | ⚠️ limit | ✅ |

> **Catatan:** hindari klaim "iLovePDF Compatible" (ada di `main.py:17`/README) —
> potensi isu trademark (MAINT-3). Posisikan sebagai independen.

---

## 9. Roadmap (phasing — selaras FSD §13)

| Fase | Fokus produk | Outcome |
|---|---|---|
| P1 — Stabilisasi | Konsolidasi kode & branding (MAINT-1/2/3), versi seragam | 1 produk, 1 merek |
| P2 — Keamanan | AES-256, password enforcement (SEC-1/2) | SR-1/2 terpenuhi |
| P3 — Performa & UX | Preview virtualisasi, split-by-size efisien, toast error | NFR-001/002 |
| P4 — Kualitas | Test otomatis + CI test job (QA-1/2) | DoD terukur |
| P5 — Ekstensi (opsional) | OCR? kompresi? macOS? (AQ-OPEN-05/06) | Validasi pasar |

---

## 10. Dependencies & Constraints

- **Teknis (100% Active Stack)**: Tauri 2 + React 19 + Rust (Node 20 / Vite); OS Windows/Linux. *Catatan:* Python (`main.py`) dan Electron telah dipensiunkan & bersifat historis saja.
- **Constraint**: offline-only → tidak ada fitur berbasis AI cloud / translate.
- **Constraint**: single maintainer → throughput terbatas (AQ-OPEN-03).

---

## 11. Risks

| Risk | Dampak | Mitigasi |
|---|---|---|
| Enkripsi lemah terekspos | Reputasi & keamanan user | P2 prioritas (SEC-1) |
| Isu trademark | Legal | Ganti branding (MAINT-3) |
| Burnout single maintainer | Delivery lambat | Fokus P1→P2, batasi scope |
| Build CI flaky (Rust/Linux) | Rilis tertunda | Pin & cache dependency |

---

## 12. Improvement Suggestions (dari source code — rekap untuk Product)

Daftar perbaikan arsitektural dan legalitas yang **telah diselesaikan**:

1. **SEC-1/SEC-2 (SELESAI)** — Enkripsi ditingkatkan ke AES-256 menggunakan `@pdfsmaller/pdf-encrypt-lite` pada semua alur output. Penggunaan `ignoreEncryption:true` telah dihapus.
2. **MAINT-1 (SELESAI)** — Duplikasi diakhiri; `main.py` dan spec PyInstaller diarsipkan ke folder `legacy/`. Single source of truth untuk versi (v2.3.0) diseragamkan di `package.json`, `Cargo.toml`, `tauri.conf.json`, `README.md`, dan About modal.
3. **LEGAL-1 (SELESAI)** — Kata "iLovePDF Compatible" telah dibersihkan total. File lisensi terbuka `LICENSE` (MIT License) telah ditambahkan.
4. **PERF-1/MEM-1 (SELESAI)** — Rendering pratinjau grid telah divirtualisasi/dipaginasi (50 baris/halaman). Algoritma *split-by-size* telah dioptimasikan ke pendekatan $O(N)$ berbasis estimasi ukuran PDF.

---

## 13. Monetization Strategy (Zero Friction Freemium)

- **Freemium Core:** 5 alat utama (Split, Merge, Watermark, Edit, Protect) 100% GRATIS dan bisa digunakan offline selamanya tanpa batasan.
- **Premium Feature:** Batch PDF Folder to Excel/CSV. User dapat mengkonversi 1 file secara gratis. Mengkonversi seluruh folder (batch) membutuhkan lisensi "PRO / SUBSCRIBE".
- **Metode Lisensi:** **License Key**. User membeli langganan via Web Portal, menerima Key via email, dan memasukkannya ke dalam modal aktivasi di aplikasi desktop.
- **Verifikasi Lokal:** Aplikasi mengontak server *hanya sekali* untuk aktivasi, dan menyimpan token (RSA-256 Signed JWT) secara lokal agar dapat digunakan offline (air-gapped) selama masa langganan aktif.
- **Implementasi (Langkah Selanjutnya):** 
  1. Siapkan endpoint di Backend Web Portal (e.g. Node.js/PHP) untuk generate License Key saat pembayaran sukses.
  2. Siapkan endpoint aktivasi (`POST /api/activate`) yang mengembalikan Signed JWT berisi masa kedaluwarsa langganan.
  3. Integrasikan pengecekan dan penyewaan form aktivasi di UI React (`App.tsx`).
  4. Pindahkan logika dekripsi JWT ke backend Rust di `src-tauri/src/main.rs` untuk proteksi keamanan dari bypass DevTools.

---

## 14. Open Questions

| ID | Pertanyaan | Status |
|---|---|---|
| PQ-01 | Apakah `main.py` akan dihapus/diarsip atau dipertahankan? | ✅ Diarsip ke `legacy/` (MAINT-1) |
| PQ-02 | Lisensi distribusi apa? | ✅ MIT License (`LICENSE`) |
| PQ-03 | Platform pembayaran yang digunakan untuk Monetisasi Batch Excel? | Open (Duitku / Midtrans / Stripe) |
| PQ-04 | Apakah macOS masuk roadmap? (AQ-OPEN-05) | Backlog |
| PQ-05 | Siapa pemilik sah & author final? (AQ-OPEN-03) | Muhammad Fahrizal Rahman |

---

## 15. Completeness Check

| Area PRD | Status |
|---|---|
| Executive Summary | ✅ |
| Problem Statement | ✅ |
| Vision / Goals / Non-Goals | ✅ |
| Target Users | ✅ |
| User Stories | ✅ |
| Feature Scope | ✅ |
| Success Metrics | ✅ (target asumsi) |
| Competitive / Differentiation | ✅ |
| Roadmap | ✅ |
| Dependencies & Constraints | ✅ |
| Risks | ✅ |
| Improvement Suggestions | ✅ |
| Monetization Strategy | ✅ |
| Open Questions | ✅ |

---

## 16. Security & Confidentiality Notes

- Input diperlakukan CONFIDENTIAL; tidak ada credential di repo.
- Produk offline → risiko eksfiltrasi data minimal; satu-satunya akses jaringan adalah
  `open_url` manual ke website dev (`App.tsx:2382`) dan endpoint aktivasi License Key saat verifikasi.
- **Blocker rilis**: perbaiki enkripsi lemah & bypass password (lihat FSD §10/§11).
- Pastikan Public Key untuk validasi JWT disematkan di dalam binary Rust dan dicek di layer Rust (bukan JS).

---

*End of PRD — BagiPDF v1.2 (Updated).*
