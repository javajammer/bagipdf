# Functional Specification Design (FSD) — BagiPDF

**Document Type:** FSD (Functional Specification Design)
**Version:** 1.1 (Updated)
**Date:** 14 Agustus 2026
**Author:** Muhammad Fahrizal Rahman
**Methodology:** Agile (indie / single-maintainer cadence)
**Audience:** VP / Product Owner (helicopter view + technical drill-down)
**Prepared from:** Source code review `main.py`, `webapp/src/App.tsx`, `webapp/src-tauri/src/main.rs`, `package.json`, `tauri.conf.json`, `.github/workflows/build-windows.yml`, `README.md`

---

## 1. Project Background & Objectives

### 1.1 Background (Fakta dari source code)

BagiPDF adalah aplikasi **desktop mandiri (standalone, offline)** untuk manipulasi
PDF. Arsitektur produksi yang digunakan 100% berbasis **Tauri + React 19 + Rust**:

1. **Arsitektur Utuh (React + Tauri + Rust)** — Berada di folder `webapp/`. Frontend React 19
   + Vite + Tailwind, backend native Rust (Tauri 2). Dependensi inti: `pdf-lib`, `pdfjs-dist`,
   `xlsx`, `jszip`, `@pdfsmaller/pdf-encrypt-lite`, `lucide-react`. Dibatasi penuh pada installer/portable Tauri.
2. **Historis / Legacy (Pensiun)** — Kode legacy Python (`main.py`) dan Electron (`electron.cjs`) pada riwayat awal proyek **sudah tidak digunakan lagi** dan hanya disimpan sebagai catatan sejarah evolusi aplikasi.

Seluruh fitur inti (Split, Merge, Watermark, Edit, Ebupot/PDF→Excel, dan Protect) diproses penuh di layer React & Tauri Rust.

### 1.2 Objectives

| # | Objective |
|---|---|
| O1 | Menyediakan toolkit PDF lengkap (Split, Merge, Watermark, Edit, PDF→Excel, Protect) dalam satu aplikasi desktop offline. |
| O2 | Menghasilkan output berkualitas tinggi tanpa ketergantungan server/cloud (air-gapped compliant — `App.tsx:48` worker pdf.js lokal). |
| O3 | Mengonsolidasi dua implementasi paralel menjadi satu produk bermerek konsisten (lihat AQ-OPEN-01). |
| O4 | Menjamin keamanan dokumen (enkripsi, proteksi formula Excel) dengan standar modern. |

### 1.3 Success Definition (Draft — perlu konfirmasi)

- Waktu proses < 5 detik untuk PDF ≤ 50 halaman pada hardware target (asumsi; belum ada benchmark).
- 0 dependensi jaringan saat runtime.
- Build reproducible via CI (`build-windows.yml`).

---

## 2. Project Scope

### 2.1 In Scope

- **Split PDF**: Custom Range, Fixed Range, Extract Pages, Split by Size (`App.tsx:563-665`, `main.py:283-405`).
- **Merge PDF**: gabung ≥ 2 file dengan reorder (`App.tsx:727-755`).
- **Watermark**: teks & gambar, font/warna/rotasi/opacity (`App.tsx:768-850`).
- **Edit PDF**: tambah teks/catatan per halaman (`App.tsx:871-920`).
- **PDF → Excel**: batch hingga 2.000 file, konsolidasi atau per-file ZIP (`App.tsx:1012-1195`).
- **Protect & Lock**: enkripsi kata sandi (`App.tsx:1253-1281`, `main.py` tidak punya fitur ini).
- **Preview visual** halaman (thumbnail) macOS-style dark mode (`App.tsx:226-245`).
- **Packaging**: Windows (nsis/msi + Electron portable), Linux (deb/appimage).

### 2.2 Out of Scope (asumsi — konfirmasi AQ-OPEN-02)

- OCR / ekstraksi dari scan gambar (pdf.js hanya baca teks tersembunyi).
- Edit konten berbasis vector (hapus/ubah teks existing, rotate halaman, kompresi).
- Kolaborasi cloud / sync / akun pengguna.
- Dukungan macOS & mobile (target eksplisit Windows & Linux per `tauri.conf.json`).
- Pemrosesan server-side / API publik.

---

## 3. Stakeholder Identification

| Stakeholder | Peran | Kepentingan |
|---|---|---|
| End User (umum) | Pengguna final Windows/Linux | Alat PDF gratis, cepat, offline, aman. |
| Developer / Maintainer | Muhammad Fahrizal Rahman (per `package.json`/`Cargo.toml`) | Kualitas kode, kemudahan maintenance, branding. |
| Distributor / Website | frm.web.id | Reputasi, lisensi, kepatuhan trademark. |
| Security Reviewer | (internal/VP) | Enkripsi, perlindungan data, kepatuhan. |

> **Catatan Asumsi:** Terdapat ketidakcocokan atribusi — `README.md` menyebut *Franky Setiawan*,
> sedangkan `package.json`/`Cargo.toml`/`About` menyebut *Muhammad Fahrizal Rahman* (dengan typo
> "Muhammmad" di `App.tsx:2381`). Satu pemilik resmi harus ditetapkan (AQ-OPEN-03).

---

## 4. Functional Requirements

Prioritas: **P1** = wajib, **P2** = penting, **P3** = nice-to-have.

| ID | Requirement | Priority | Acceptance Criteria (Given/When/Then) | Owner |
|---|---|---|---|---|
| FR-001 | User dapat memilih 1 file PDF dari disk | P1 | *Given* aplikasi terbuka, *When* user klik "Pilih File PDF", *Then* dialog OS muncul & file termuat dengan jumlah halaman & ukuran tampil. | Frontend |
| FR-002 | Split — Custom Range (mis. `1-3, 5, 8-12`) | P1 | *When* user masukkan range valid, *Then* tiap rentang jadi file terpisah ATAU 1 file gabungan (checkbox). | Frontend |
| FR-003 | Split — Fixed Range tiap N halaman | P1 | *When* N positif, *Then* PDF terbagi rata tiap N halaman. | Frontend |
| FR-004 | Split — Extract Pages (all / select) | P1 | *When* mode extract, *Then* tiap halaman jadi PDF sendiri atau digabung. | Frontend |
| FR-005 | Split — Split by Size (target MB) | P1 | *When* target MB>0, *Then* tiap bagian ≤ target (kecuali 1 halaman > target). | Frontend |
| FR-006 | Merge ≥ 2 PDF dengan urutan bisa diubah | P1 | *When* ≥2 file ditambah, *Then* user bisa up/down/remove & hasil mengikuti urutan. | Frontend |
| FR-007 | Watermark teks (font, warna, rotasi, opacity) | P1 | *When* watermark teks diterapkan, *Then* teks ter-render di semua halaman sesuai style. | Frontend |
| FR-008 | Watermark gambar (logo) | P2 | *When* file PNG/JPG dipilih, *Then* gambar ter-render sebagai watermark. | Frontend |
| FR-009 | Edit — tambah teks/catatan per halaman | P2 | *When* anotasi ditambah & disimpan, *Then* teks muncul di koordinat halaman target. | Frontend |
| FR-010 | PDF → Excel (single & batch ≤ 2000 file) | P1 | *When* folder/file diproses, *Then* teks per baris diekstrak ke `.xlsx` (konsolidasi atau ZIP). | Frontend |
| FR-011 | Protect & Lock dengan kata sandi | P1 | *When* password diisi & dikunci, *Then* output tidak bisa dibuka tanpa password. | Rust+Frontend |
| FR-012 | Buka PDF terenkripsi via prompt password | P1 | *When* PDF terkunci, *Then* modal password muncul & preview hanya setelah benar. | Frontend |
| FR-013 | Preview thumbnail semua halaman | P2 | *When* file termuat, *Then* grid thumbnail tampil (dark mode). | Frontend |
| FR-014 | Save dialog native (Tauri) dengan fallback | P1 | *When* proses selesai, *Then* user pilih lokasi simpan (Tauri IPC → web `showSaveFilePicker` → download). | Rust+Frontend |
| FR-015 | Proteksi Formula Injection Excel | P2 | *When* teks diawali `= + - @`, *Then* diprefix `'` agar aman dibuka Excel (`App.tsx:924-931`). | Frontend |
| FR-016 | Cancel batch process | P2 | *When* user klik "Hentikan", *Then* loop batch berhenti di file berikutnya (`cancelBatchRef`). | Frontend |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement | Target (asumsi) |
|---|---|---|---|
| NFR-001 | Performance | Waktu proses split/merge untuk PDF 50 halaman | < 5 detik (belum dibenchmark — AQ-OPEN-04) |
| NFR-002 | Performance | Memory saat preview | Tidak OOM untuk PDF ≤ 200 halaman (lihat §10 finding MEM-1) |
| NFR-003 | Availability | Aplikasi offline (no network) | 100% fitur jalan tanpa internet |
| NFR-004 | Security | Enkripsi PDF output | AES-256 (V5/R6) — **saat ini tidak terpenuhi**, lihat §10 SEC-1 |
| NFR-005 | Portability | Single-file executable Windows | Portable `.exe` tanpa install (Electron) atau installer (Tauri) |
| NFR-006 | Compatibility | OS target | Windows 10/11 x64, Linux (deb/appimage) |
| NFR-007 | Usability | Bahasa UI | Bahasa Indonesia |
| NFR-008 | Maintainability | Satu implementasi utama | Konsolidasi legacy Python → dihapus/diarsip (AQ-OPEN-01) |
| NFR-009 | Reliability | Penanganan file rusak | Error ditangkap & pesan ke user (saat ini `alert()` — lihat §10 UX-1) |

---

## 6. Data Architecture / Data Model

Aplikasi **stateless & lokal** — tidak ada database. Data mengalir di memori:

```
File PDF (input)
   └─ arrayBuffer ─┬─ pdf-lib PDFDocument (manipulasi)
                   └─ pdf.js Document (render thumbnail + ekstrak teks)
                        └─ PageThumb[] { pageIndex, dataUrl, w, h }   (App.tsx:51)
                        └─ textContent.items → consolidatedRows[][]    (App.tsx:1027)

MergeFileItem { id, file, totalPages, sizeMB }            (App.tsx:58)
PDFAnnotation { id, pageIndex, text, x%, y%, fontSize, color } (App.tsx:65)
BatchPdfItem   { id, file, status, pageCount, rowCount, ... }      (App.tsx:75)
```

- **Tidak ada penyimpanan persisten** metadata/riwayat antar sesi (kecuali file output di disk user).
- **Password** disimpan di React state (`pdfPassword`) — volatile, hilang saat tutup app.
- Output disimpan ke lokasi pilihan user via `save_file_dialog` (Rust, `main.rs:13`).

---

## 7. System Architecture / Integration Design

```
┌─────────────────────────────────────────────┐
│  Frontend (React 19 + Vite + Tailwind)        │
│  App.tsx — semua logic manipulasi PDF         │
│  pdf-lib / pdfjs-dist / xlsx / jszip          │
└───────────────┬─────────────────────────────┘
                │ Tauri IPC  (invoke)
┌───────────────┴─────────────────────────────┐
│  Rust Backend (Tauri 2)                       │
│  - save_file_dialog(defaultName, contents)    │  main.rs:13
│  - open_url(url)                              │  main.rs:40
│  - greet()  [dead code]                       │  main.rs:11
└─────────────────────────────────────────────┘
        │ (alternatif) Electron (electron.cjs)
        └─ BrowserWindow loadFile(dist/index.html)
```

### 7.1 Monetization Architecture (Batch PDF to Excel)

Sistem langganan divalidasi pada layer Rust untuk mencegah bypass JavaScript DevTools.
Aliran data verifikasi:
```
[ UI React (Pilih Folder Batch) ] 
  ├──> Invoke: `verify_license_key(key)` ──> [ Backend Rust ]
                                                  │
                                   (Cek Cache License File Lokal)
                                                  │
                                     ┌────────────┴────────────┐
                              (Valid / Ada Cache)     (Offline / Baru)
                                     │                         │
                              Return true              Hit Server Auth API
                                                       (/v1/licenses/activate)
                                                               │
                                                       Verifikasi & Simpan 
                                                       Encrypted RSA Token (JWT)
```
- **Keamanan:** Public Key JWT ditanam (hardcoded) pada biner Rust. Hanya server Auth yang memegang Private Key.

- **Build**: `npm run build` → `dist/` → `tauri build` (nsis/msi/deb/appimage) ATAU
  `tauri:build`/`dist:win` (`package.json`).
- **CI**: GitHub Actions `build-windows.yml` — build Windows (windows-latest) & Linux
  (ubuntu-22.04), upload artifact. **Tidak ada job test** (lihat §10 QA-1).
- **CSP**: `tauri.conf.json` strict (`default-src 'self'`, `img-src 'self' data: blob:`).
  `style-src` mengizinkan `'unsafe-inline'` (acceptable untuk inline Tailwind, namun catat di SEC-4).

---

## 8. UI/UX Specifications

- **Layout**: Header macOS-style (traffic-light dots) + nav bar 6 tools + workspace
  sidebar kiri / preview kanan (`App.tsx:1283-1340`).
- **Tools**: Split, Merge, Protect & Lock, Watermark, Edit, PDF to Excel (`App.tsx:86`).
- **Theme**: Dark mode glassmorphism (`bg-[#1E1E24]`, slate/indigo).
- **Feedback**: Toast notification (`App.tsx:1286`), progress bar batch (`App.tsx:2183`).
- **Modal**: Password prompt (`App.tsx:2343`), About (`App.tsx:2367`).
- **Preview**: grid thumbnail 2–5 kolom responsif (`App.tsx:1518`).

> **Gap UX**: status hanya warna + ikon; tidak ada dukungan keyboard penuh; `select-none`
> di root membatasi seleksi teks (acceptable untuk app, namun aksesibilitas rendah — UX-2).

---

## 9. Business Rules & Logic

| Rule | Deskripsi | Sumber |
|---|---|---|
| BR-1 | Range halaman 1-indexed; validasi `1 ≤ p ≤ total`. | `parseRanges` `App.tsx:522` |
| BR-2 | Split by Size: jika 1 halaman sendiri > target, tetap diletakkan sendiri. | `App.tsx:648` |
| BR-3 | PDF→Excel: baris dikelompokkan per `round(transform[5]/10)*10` (Y position). | `App.tsx:1063` |
| BR-4 | PDF→Excel: batas 2.000 file (hardcoded di 3 lokasi). | `App.tsx:945,985,1003` |
| BR-5 | Enkripsi output diterapkan bila `lockOutputWithPassword` aktif. | `App.tsx:385` |
| BR-6 | Formula Excel diawali `= + - @ \t \r` di-prefix `'`. | `App.tsx:924` |
| BR-7 | File non-PDF ditolak (`accept="application/pdf"` + cek type). | `App.tsx:174` |

---

## 10. Improvement Suggestions (dari review source code — WAJIB)

Berikut temuan konkret dari kode eksisting. **Tidak ada source code yang diubah**;
ini daftar rekomendasi perbaikan untuk iterasi berikutnya.

### SEC — Security

- **SEC-1 (HIGH): Enkripsi PDF buatan tangan sangat lemah.** `applyPasswordToDoc`
  (`App.tsx:384-416`) mengimplementasikan PDF Standard Security **V1/R2 (RC4 40-bit)**
  via MD5 buatan tangan (`md5Bytes`, `App.tsx:287-381`). Ini sudah usang & mudah di-crack.
  Lebih buruk: `O` dan `U` hash diisi dengan buffer password **yang sama** (`App.tsx:397-398`),
  sehingga tidak ada pemisahan owner/user password, dan `P: -44` di-hardcode.
  **Rekomendasi:** gunakan library teruji (`@pdfsmaller/pdf-encrypt-lite` seperti pada
  fitur Lock, `App.tsx:1271`) dengan **AES-256 (V5/R6)**; hapus implementasi MD5/RC4 kustom.
- **SEC-2 (HIGH): `ignoreEncryption: true` membypass proteksi.** `PDFDocument.load(..., {ignoreEncryption:true})`
  di `App.tsx:194, 696, 740, 779, 886` memuat PDF terenkripsi **tanpa password**. Artinya
  fitur Merge/Watermark/Edit/Split dapat membaca & menulis ulang isi PDF terkunci tanpa
  pernah meminta password (modal password hanya untuk preview thumbnail). **Rekomendasi:**
  muat dengan password; tolak manipulasi jika dekripsi gagal.
- **SEC-3 (MED): Password di state React tanpa zeroing.** `pdfPassword` (`App.tsx:105`)
  tetap di memori; acceptable untuk app lokal, namun catat di threat model.
- **SEC-4 (LOW): CSP `style-src 'unsafe-inline'`** (`tauri.conf.json`) — diperlukan Tailwind
  inline; pantau agar tidak digunakan untuk inject script.

### PERF — Performance / Memory

- **MEM-1 (MED): Thumbnail semua halaman di-render sekaligus** (`App.tsx:226-245`).
  PDF 1.000 halaman → 1.000 `dataURL` canvas di memori → risiko OOM. **Rekomendasi:**
  virtualisasi / render lazim (windowing) / batasi & render on-demand.
- **PERF-1 (MED): Split by Size O(n²) & tulis temp file.** Web (`App.tsx:633-665`)
  membuat `PDFDocument` baru per halaman & memanggil `.save()` untuk ukur byte; Python
  (`main.py:362-404`) menulis `_temp_check.pdf` ke disk per halaman. **Rekomendasi:** estimasi
  ukuran dari offset xref sumber, hindari re-serialisasi berulang.
- **PERF-2 (LOW): Tidak ada guard ukuran file.** PDF sangat besar dapat hang UI.
  **Rekomendasi:** batasi ukuran input (mis. 500 MB) dengan pesan jelas.

### CORR — Correctness / Robustness

- **CORR-1 (MED): Parsing range inkonsisten antar implementasi.** Python `parse_page_ranges`
  (`main.py:245`) diam mengabaikan part dengan `len(subparts)!=2` (mis. `"1-3-5"`, `"1-"`, `"-3"`);
  web `parseRanges` (`App.tsx:522`) melempar error. Sinkronkan & tangani edge case.
- **CORR-2 (MED): Edit PDF buang semua non-ASCII.** `sanitizeWinAnsi` (`App.tsx:270-277`)
  `.replace(/[^\x00-\x7F]/g,'')` menghapus karakter non-Latin; hanya font HelveticaBold
  (WinAnsi) → CJK/emoji tidak render. **Rekomendasi:** dukung font embedded / subsetting.
- **CORR-3 (LOW): Watermark posisi `diagonal` terdefinisi di state** (`App.tsx:136`)
  tapi UI hanya render center/top/bottom (`App.tsx:806-810`) → fitur mati / incomplete.
- **CORR-4 (LOW): PDF→Excel grouping Y pakai bucket 10-unit** (`App.tsx:1063`) kasar;
  layout rapat/multi-kolom bisa salah baris. **Rekomendasi:** pakai `hasEOL` / deteksi kolom.
- **CORR-5 (LOW): `applyPasswordToDoc` mutate `doc.context.trailerInfo.Encrypt`**
  (`App.tsx:412`) — bergantung pada internal pdf-lib, rapuh antar versi.

### MAINT — Maintainability / Consistency

- **MAINT-1 (HIGH): Dua implementasi paralel** (`main.py` Python vs `webapp/` React).
  Logika & penamaan output berbeda, beban maintenance ganda, risiko divergensi bug.
  **Rekomendasi:** tentukan satu produk utama (webapp/Tauri), arsipkan `main.py`.
- **MAINT-2 (MED): Version drift.** README `v2.1.0`, package.json/Cargo `2.2.0`,
  About `2.2.0`, Rust `greet` hardcode `v2.1.0` (`main.rs:11`), artifact CI `v2.1.0`
  (`build-windows.yml`). **Rekomendasi:** single source of truth (baca dari `package.json`).
- **MAINT-3 (MED): Author/branding mismatch.** README "Franky Setiawan" vs kode
  "Muhammad Fahrizal Rahman" (typo "Muhammmad" `App.tsx:2381`). `main.py:17` & README
  pakai merek **"iLovePDF Compatible"** → potensi isu trademark. **Rekomendasi:** seragamkan.
- **MAINT-4 (LOW): `greet()` Rust tidak terpakai** (`main.rs:11`) — dead code.
- **MAINT-5 (LOW): Dual packaging Electron + Tauri** (`electron.cjs`, `electron-builder`)
  memperbesar attack surface & maintenance. Pilih satu jalur rilis utama.
- **MAINT-6 (LOW): Magic number 2.000** di 3 tempat (`App.tsx:945,985,1003`) → jadikan konstanta.

### QA — Quality / Testing

- **QA-1 (HIGH): Tidak ada automated test & tidak ada test job di CI.** `build-windows.yml`
  hanya build. **Rekomendasi:** tambah unit test (`parseRanges`, split-by-size, enkripsi) &
  job `test` di CI (Vitest + cargo test).
- **QA-2 (LOW): Error handling pakai `alert()`** (`App.tsx:175,257,676,...`) — UX buruk &
  sulit diotomatisasi. **Rekomendasi:** gunakan toast/modal konsisten.
- **UX-1 (LOW): Toast dedup rapuh** (`App.tsx:282`) — pesan sama bisa salah di-clear.

---

## 11. Security Requirements

| ID | Requirement | Status saat ini |
|---|---|---|
| SR-1 | Output enkripsi minimal AES-128, target AES-256 | ❌ RC4 40-bit (SEC-1) |
| SR-2 | PDF terkunci tidak bisa dibaca tanpa password | ❌ `ignoreEncryption:true` (SEC-2) |
| SR-3 | Proteksi formula Excel (OWASP) | ✅ `sanitizeExcelCell` (App.tsx:924) |
| SR-4 | CSP strict di renderer | ✅ `tauri.conf.json` (kecuali unsafe-inline) |
| SR-5 | Tidak ada transmisi data ke jaringan | ✅ offline (kecuali `open_url` ke website dev) |
| SR-6 | Secret/credential management | ✅ tidak ada secret di repo (confidential per skill) |

---

## 12. Testing Strategy & Acceptance Criteria

| Level | Strategi | Pass/Fail |
|---|---|---|
| Unit | `parseRanges`, `sanitizeExcelCell`, `sanitizeWinAnsi`, split-by-size | 100% case valid & invalid lolos |
| Integration | Pipeline split→merge→watermark→excel pada 5 PDF sample | Output bisa dibuka & isi benar |
| Security | Buka PDF terkunci tanpa password harus GAGAL | Enkripsi AES-256 terverifikasi |
| Performance | PDF 50 & 200 halaman | < target NFR-001/002 |
| UAT | 3 user non-teknis selesaikan 6 task utama | Tanpa bantuan developer |

---

## 13. Implementation Timeline (Agile — estimasi indie)

| Sprint | Fokus | Deliverable |
|---|---|---|
| S1 | Konsolidasi & version/branding fix (MAINT-1/2/3) | 1 produk utama, versi seragam |
| S2 | Security hardening (SEC-1/2, SR-1/2) | Enkripsi AES-256, password enforcement |
| S3 | Performance (MEM-1, PERF-1/2) | Virtualisasi preview, split-by-size efisien |
| S4 | Correctness (CORR-1..5) | Parser & edit PDF konsisten |
| S5 | QA & tests (QA-1/2) | CI test job, unit tests |

---

## 14. Dependencies & Assumptions

- **Dependencies**: Rust toolchain, Node 20, Tauri 2 CLI, library npm (pdf-lib, pdfjs-dist,
  xlsx, jszip, @pdfsmaller/pdf-encrypt-lite, lucide-react). Sistem: Windows SDK (nsis),
  Linux GTK/webkit (deb/appimage).
- **Assumptions**: lihat §16 Assumptions & Open Questions.

---

## 15. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Enkripsi lemah (RC4) → data bocor | High | Medium | Ganti AES-256 (SEC-1) |
| Bypass password via ignoreEncryption | High | Medium | Load dgn password (SEC-2) |
| OOM preview PDF besar | Medium | Medium | Virtualisasi (MEM-1) |
| Divergensi 2 implementasi | Medium | High | Konsolidasi (MAINT-1) |
| Isu trademark "iLovePDF" | Medium | Low | Ganti branding (MAINT-3) |
| Build gagal di CI (Rust/Linux dep) | Medium | Medium | Pin dependency, cache |

---

## 16. Change Management Plan

- Setiap perubahan fitur diajukan sebagai PR → review (analyse-fsd) → merge ke `main`.
- Versioning di-single-source (`package.json`) → otomatis ke About & artifact CI.
- Breaking change enkripsi (SEC-1) harus diumumkan: file lama tetap bisa dibuka,
  namun tool baru menulis format lebih kuat.

---

## 17. Handover & Support Plan

- **Owner pasca go-live**: Maintainer tunggal (Muhammad Fahrizal Rahman) — harus
  dikonfirmasi (AQ-OPEN-03).
- **Support**: website frm.web.id (About modal `App.tsx:2382`).
- **No telemetry/crash log** saat ini → untuk support, tambahkan log lokal opsional (QA-2).

---

## 18. Sign-off / Approval Matrix

| Role | Name | Status |
|---|---|---|
| Product Owner / VP | [TBD] | Pending |
| Tech Lead | [TBD] | Pending |
| Security Reviewer | [TBD] | Pending |
| Maintainer | Muhammad Fahrizal Rahman | Draft |

---

## 19. Methodology Notes (Agile alignment)

Sesuai `references/methodology-matrix.md` — Agile:

| Area | Check | Severity | Status |
|---|---|---|---|
| Sprint Planning | Time-boxed sprint (§13) | HIGH | ✅ (proposed) |
| Backlog | FR/NFR terprioritaskan (§4/5) | HIGH | ✅ |
| User Stories | INVEST (FR pakai G/W/T) | MEDIUM | ✅ |
| Definition of Done | §12 acceptance | HIGH | ✅ |
| Technical Debt | §10 improvement terjadwal (S1-S5) | MEDIUM | ✅ |
| Retrospectives | (belum ada proses) | MEDIUM | ⚠️ open |
| Velocity | (belum dilacak) | LOW | ⚠️ open |
| Cross-functional | Single maintainer | HIGH | ⚠️ open (AQ-OPEN-03) |

---

## 20. Assumptions & Open Questions

| ID | Item | Asumsi / Tanya |
|---|---|---|
| AQ-OPEN-01 | Implementasi mana yang resmi? | Asumsi: `webapp/` (Tauri) adalah produk utama; `main.py` diarsip. **Konfirmasi.** |
| AQ-OPEN-02 | Fitur di luar scope (§2.2) | Asumsi benar. **Konfirmasi** (OCR? kompresi?) |
| AQ-OPEN-03 | Pemilik resmi & author | README vs kode berbeda. **Konfirmasi** pemilik sah & perbaiki typo. |
| AQ-OPEN-04 | Target performa (NFR-001/002) | Belum dibenchmark. **Konfirmasi** angka riil. |
| AQ-OPEN-05 | Dukungan macOS? | `tauri.conf.json` hanya Windows/Linux. **Konfirmasi** apakah macOS diinginkan. |
| AQ-OPEN-06 | Lisensi & distribusi | Belum ada LICENSE. **Konfirmasi** lisensi (MIT? proprietary?) sebelum publikasi. |

---

## 21. Completeness Check

| Section Rubric | Status |
|---|---|
| Background & Objectives | ✅ COMPLETE |
| Scope (In/Out) | ✅ COMPLETE |
| Stakeholder | ✅ COMPLETE |
| Functional Requirements | ✅ COMPLETE (FR-001..016) |
| Non-Functional Requirements | ✅ COMPLETE (NFR-001..009) |
| Data Architecture | ✅ COMPLETE |
| System Architecture | ✅ COMPLETE |
| UI/UX | ✅ COMPLETE |
| Business Rules | ✅ COMPLETE |
| Security Requirements | ✅ COMPLETE |
| Testing Strategy | ✅ COMPLETE |
| Timeline | ✅ COMPLETE |
| Dependencies & Assumptions | ✅ COMPLETE |
| Risk Register | ✅ COMPLETE |
| Change Management | ✅ COMPLETE |
| Handover & Support | ✅ COMPLETE |
| Sign-off | ⚠️ Nama approver TBD (open question) |
| Improvement Suggestions | ✅ COMPLETE (§10) |

---

## 22. Security & Confidentiality Notes

- Seluruh input diperlakukan **CONFIDENTIAL**. Tidak ada secret/credential ditemukan di
  repository (tidak ada `.env`, API key, atau token).
- Aplikasi dirancang **offline**; satu-satunya akses jaringan adalah `open_url` ke website
  developer (`App.tsx:2382`) yang di-trigger manual user.
- **Action item (tinggi)**: perbaiki enkripsi lemah (SEC-1) & bypass password (SEC-2)
  sebelum rilis berikutnya — lihat §10 & §11.
- Tidak ada instruksi untuk memutar/audit credential karena tidak ada credential di input.

---

*End of FSD — BagiPDF v1.0 (Draft). Output ini adalah input untuk `/analyse-fsd`.*
