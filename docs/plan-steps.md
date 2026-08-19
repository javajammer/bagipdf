# Plan Steps — Implementasi Monetisasi Fitur Ebupot (BagiPDF PRO)

**Dokumen:** Roadmap implementasi monetisasi fitur Ebupot (Batch PDF → Excel) menggunakan Midtrans.
**Berdasarkan:** `docs/prd.md` §13, `docs/fsd.md` §7.1, `docs/plan.md`, dan review source code (`App.tsx`, `main.rs`, `tauri.conf.json`, `Cargo.toml`).
**Tanggal:** 14 Agustus 2026
**Status:** Draft — siap untuk eksekusi

---

## Konteks Penting dari Kode Saat Ini

| Fakta | Implikasi |
|---|---|
| App 100% offline, CSP `connect-src 'self'` (`tauri.conf.json:25`) | **Frontend React TIDAK boleh** call API langsung — harus lewat command Rust, atau CSP harus dilonggarkan (kurang aman) |
| Backend Rust saat ini hanya punya 3 command: `greet`, `save_file_dialog`, `open_url` (`main.rs:40`) | Perlu tambah command license: activate / check / get_status |
| Gate point batch ada di `handleExecuteBatchPdfToExcel` (`App.tsx:1033`) & picker `handleFolderSelect` (`App.tsx:889`) / `handleBatchFilesSelect` (`App.tsx:930`) | Ini tempat pasang pengecekan lisensi |
| Limit 2000 file di-hardcode 3 tempat (`App.tsx:959`, dll) | Jadikan konstanta + tambah limit free-tier (1 file) |
| Belum ada Web Portal / backend sama sekali | **Ini yang paling besar** — harus dibangun dari nol |
| FSD §7.1 sudah menspesifikasi: RSA-signed JWT, public key ditanam di Rust, private key di server | Ikuti arsitektur ini (anti-bypass DevTools) |

---
## Threat Model & Anti-Gandakan (Hardening Mandatory)

**Tujuan:** Memastikan lisensi PRO tidak dapat disalin, dipalsukan, atau dipakai di perangkat lain tanpa otorisasi.

### Vektor Serangan Utama
1. **Salin file `license.dat` ke PC lain** – paling umum.
2. **Spoof device fingerprint** – mengubah ID perangkat agar cocok dengan lisensi.
3. **Patch binary** – menghapus atau mem‑bypass pengecekan lisensi.
4. **Manipulasi jam sistem** – mengembalikan waktu sebelum `exp`.
5. **Edit/replace JWT** – mengubah payload (dicegah oleh tanda tangan RS256).
6. **Replay aktivasi** – menggunakan kembali JWT yang sudah didapat.
7. **Webhook Midtrans tanpa verifikasi** – aktivasi palsu.

### Hardening WAJIB
- **Device fingerprint multi‑sumber** (≥4 ID hardware) → SHA‑256 + salt aplikasi; toleransi satu sumber berubah.
- **`check_license()` wajib membandingkan `claims.device_fp` dengan fingerprint lokal.**
- **Enkripsi `license.dat`** dengan AES‑256‑GCM, kunci = HKDF‑SHA256(fingerprint, info="bagipdf‑license").
- **Anti‑clock‑rollback** – simpan `last_seen` timestamp, tolak jika `now < last_seen - toleransi`.
- **Multiple check‑points** – startup, sebelum batch, tiap N file dalam loop, sebelum export.
- **Server‑side device management** – endpoint deactivation, halaman “Kelola Perangkat”, limit aktivasi N device.
- **Nonce aktivasi single‑use** + rate‑limit pada `/v1/licenses/activate`.
- **Key rotation** (`kid` di header JWT) + idempotent Midtrans webhook.

---
## Phase 0 — Persiapan & Desain (1–2 hari)

1. **Tentukan pricing & tier** — mis. PRO Bulanan Rp 49.000 / Tahunan Rp 399.000 / Lifetime Rp 999.000. Catat di PRD §13.
2. **Generate RSA keypair** (RS256 untuk JWT):
   - Private key → simpan HANYA di server Web Portal (env var / secret manager).
   - Public key → akan di-embed di binary Rust (`main.rs`) sebagai `const`.
3. **Setup Midtrans**:
   - Dari dashboard Midtrans, ambil **Server Key** & **Client Key** (Snap).
   - Daftarkan URL Webhook `Payment Notification` → `https://portal.frm.web.id/api/midtrans/webhook`.
   - Pilih mode: **Snap.js** (popup di Web Portal) — paling cepat untuk checkout.
4. **Pilih stack Web Portal** — sesuai PRD §13: Node.js (Express/Fastify) atau PHP. Rekomendasi: **Node.js + PostgreSQL** (selaras dengan ekosistem JS & mudah deploy).
5. **Skema License Key**: format `BPDF-XXXX-XXXX-XXXX-XXXX` (24 char alphanumeric), satu key = satu langganan, batasi aktivasi ke N device (mis. 3) untuk anti-share.

---

## Phase 1 — Bangun Web Portal Backend (baru, 4–6 hari)

Repo saat ini tidak punya backend. Buat project baru (mis. `portal/` di luar `webapp/`, atau repo terpisah).

1. **Scaffold** — Node.js + Express/Fastify + PostgreSQL + Prisma/Knex.
2. **Skema DB minimal**:
   ```sql
   licenses(id, license_key UNIQUE, plan, status, expires_at, created_at)
   activations(id, license_id, device_fingerprint, activated_at)
   payments(id, order_id, license_id, amount, midtrans_transaction_id, status, created_at)
   ```
3. **Endpoint checkout** — `POST /api/checkout` → buat order + panggil Midtrans Snap API (`/v1/transactions`) → return `snap_token` untuk di-render Snap.js di halaman web.
4. **Webhook Midtrans** — `POST /api/midtrans/webhook`:
   - Verifikasi signature HTTP(SHA512) pakai Server Key.
   - Saat `transaction_status: settlement` → generate `license_key`, simpan ke DB, kirim email ke buyer.
5. **Email service** — pakai Resend / SMTP (Mailtrap dev) — kirim license key + link instruksi aktivasi.
6. **Endpoint aktivasi** — `POST /v1/licenses/activate`:
   - Body: `{ license_key, device_fingerprint, nonce }`.
   - Validasi: key exists, status active, belum expired, aktivasi < N device, **nonce belum dipakai**.
   - Return **JWT (RS256 signed)** berisi: `{ license_id, plan, exp, device_fingerprint }`.
7. **Endpoint deactivation & device management** — `POST /v1/licenses/deactivate` (body: `{ license_key, device_fingerprint }`) untuk menghapus aktivasi pada device tertentu; UI portal menampilkan daftar aktivasi dan tombol “Revoke”.
8. **Nonce generation** — server mengeluarkan satu‑time `nonce` pada checkout; disimpan di DB, ditandai terpakai saat `/activate` dipanggil.
9. **Key rotation support** — JWT header menyertakan `kid`; server menyimpan beberapa public key; Rust binary dapat memuat beberapa `PUB_KEY_x` dan memilih yang cocok.
10. **Landing page** — pricing, tombol "Beli PRO" → Snap.js popup → email.
11. **Deploy** — ke Vercel/Railway/Fly.io + managed Postgres (Neon/Supabase). Domain: `portal.frm.web.id`.

---

## Phase 2 — Rust License Layer (desktop, 2–3 hari)

Modifikasi `webapp/src-tauri/`:

1. **Tambah dependencies** di `Cargo.toml`:
   ```toml
   reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
   jsonwebtoken = "9"
   rsa = "0.9"
   sha2 = "0.10"
   base64 = "0.22"
   dirs = "5"          # path app data
   chrono = { version = "0.4", features = ["serde"] }
   hkdf = "0.12"
   ```
2. **Embed public key** di `main.rs` sebagai `const PUB_KEY: &str = "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----";`.
3. **Device fingerprint** – fungsi `compute_device_fingerprint()` yang menggabungkan minimal 4 sumber hardware:
   - Windows: `MachineGuid` (registry), SMBIOS UUID (`wmic csproduct get UUID`), primary MAC address, disk serial.
   - Linux: `/etc/machine-id`, DMI product_uuid (`/sys/class/dmi/id/product_uuid`), primary MAC, disk serial.
   - Semua di‑hash dengan SHA‑256 + salt aplikasi `"bagipdf-fp-salt"` → hex string.
4. **License file format** – `license.dat` berisi JWT yang **dienkripsi** AES‑256‑GCM:
   - Key = HKDF‑SHA256(device_fp, info="bagipdf‑license-key").
   - IV random 12‑byte, tag 16‑byte, semua disimpan bersama ciphertext (base64).
5. **Tambah command baru** (daftar di `invoke_handler` `main.rs:40`):
   - `activate_license(license_key: String, device_fp: String) -> Result<LicenseInfo, String>`:
     * POST ke `/v1/licenses/activate` (HTTPS).
     * Terima JWT, verifikasi signature dengan `PUB_KEY`.
     * Verifikasi `claims.device_fp == device_fp`.
     * Enkripsi JWT → simpan ke `license.dat`.
     * Simpan `last_seen = now` di `license.state`.
   - `check_license() -> Result<LicenseInfo, String>`:
     * Baca `license.dat`, dekripsi dengan key derived dari **fingerprint lokal**.
     * Verifikasi JWT signature, `exp`, dan **bandingkan `claims.device_fp` dengan fingerprint lokal**.
     * Baca `last_seen`; jika `now < last_seen - 60s` → error “clock rollback”.
     * Update `last_seen = now`.
     * Return `{ active: true, plan: claims.plan, expires_at: claims.exp }`.
   - `clear_license()` — hapus `license.dat` & `license.state`.
6. **CSP** – **PERTAHANKAN** `connect-src 'self'`; semua jaringan lewat Rust.
7. **Multiple check‑points** – `check_license()` dipanggil di:
   - Startup aplikasi.
   - Sebelum `handleExecuteBatchPdfToExcel`.
   - Setiap 50 file dalam loop batch.
   - Sebelum `handleExportBatchExcel`.

---

## Phase 3 — React UI License (desktop, 2–3 hari)

Modifikasi `webapp/src/App.tsx`:

1. **State baru** (dekat state Excel, `App.tsx:147`):
   ```ts
   const [licenseInfo, setLicenseInfo] = useState<{active:boolean; plan:string; expiresAt:string} | null>(null);
   const [showActivationModal, setShowActivationModal] = useState(false);
   const [licenseKeyInput, setLicenseKeyInput] = useState('');
   const [activating, setActivating] = useState(false);
   ```
2. **Cek lisensi saat startup** — `useEffect` panggil `invoke('check_license')` → set `licenseInfo`. Jangan block UI, jalankan async.
3. **Modal Aktivasi** (mirip modal About `App.tsx:2367`):
   - Input license key, tombol "Aktivasi", status (loading/sukses/gagal), tampilkan expiry.
   - Tombol "Beli Lisensi" → `invoke('open_url', { url: 'https://portal.frm.web.id' })`.
4. **Badge PRO** di header — jika `licenseInfo.active` tampilkan "PRO" badge + expiry; jika tidak tampilkan tombol "Upgrade ke PRO".
5. **Gate di fitur Ebupot** — ini inti monetisasi:
   - **Free**: konversi 1 file PDF ebupot gratis (sesuai PRD §13).
   - **Batch (folder / multi-file)**: butuh PRO.
   - Modifikasi `handleFolderSelect` (`App.tsx:889`): jika `!licenseInfo?.active` → batasi hanya 1 file pertama + toast "Batch butuh PRO".
   - Modifikasi `handleBatchFilesSelect` (`App.tsx:930`): jika `!licenseInfo?.active` dan file > 1 → block + tampilkan modal upgrade.
   - Modifikasi `handleExecuteBatchPdfToExcel` (`App.tsx:1033`): guard awal — `if (excelBatchItems.length > 1 && !isPro) { showUpgradeModal(); return; }`.
6. **Pisahkan konstanta** — `MAX_BATCH_FREE = 1`, `MAX_BATCH_PRO = 2000` (ganti magic number di `App.tsx:959` dll).
7. **Update About modal** (`App.tsx:2499`) — tampilkan status lisensi.

---

## Phase 4 — Gating Spesifik Ebupot (1 hari)

Karena ebupot adalah fitur premium yang sudah jalan, pastikan UX freemium-nya jelas:

1. **Single file ebupot** tetap gratis — user pilih 1 PDF via `fileInputRef`, proses normal.
2. **Folder/multi-file ebupot** → gate. Saat user klik "Mulai Konversi" dengan > 1 item dan belum PRO:
   - Toast: "Konversi batch adalah fitur PRO. Upgrade untuk memproses hingga 2.000 file."
   - Buka modal upgrade dengan CTA ke Web Portal.
3. **Setelah aktivasi PRO**, re-render UI (state `licenseInfo` ter-update) → tombol batch langsung aktif tanpa restart app.

---

## Phase 5 — Security & Testing (2 hari)

1. **Anti‑bypass**: pastikan `check_license()` di Rust yang jadi source of truth. Frontend hanya menerima hasil boolean dari Rust — tidak ada JWT/string yang bisa di‑tamper via DevTools.
2. **Offline test**: aktivasi online sekali → putuskan koneksi → batch harus tetap jalan selama `exp` belum lewat.
3. **Expired test**: set `exp` ke masa lalu → `check_license()` return inactive → batch di‑block.
4. **Anti‑share test**: aktivasi key di device ke‑4 → server reject (limit 3 device).
5. **Device‑fingerprint mismatch test**: salin `license.dat` ke mesin lain dengan fingerprint berbeda → `check_license()` error “device mismatch”.
6. **Anti‑clock‑rollback test**: set sistem ke waktu sebelum `last_seen` → `check_license()` error “clock rollback detected”.
7. **Encryption test**: ubah satu byte ciphertext di `license.dat` → dekripsi gagal → `check_license()` error “invalid token”.
8. **Tamper test**: edit JWT payload sebelum enkripsi → signature invalid → `check_license()` error.
9. **Unit test Rust**: `cargo test` untuk semua skenario (valid, expired, device‑mismatch, clock‑rollback, decryption failure).

---

## Phase 6 — Deploy, Build & Docs (1 hari)

1. Deploy Web Portal ke production, set Midtrans ke **Production mode**.
2. Update `docs/prd.md` PQ-03 → "Midtrans (Snap)" (resolve open question).
3. Update `docs/fsd.md` §7.1 dengan endpoint aktual & flow Midtrans.
4. Update `docs/plan.md` tambah section "Monetisasi Ebupot (PRO License)" dengan checklist.
5. Bump version (`package.json`, `Cargo.toml`, `tauri.conf.json`) → `v2.4.0`.
6. Build & rilis via GitHub Actions (`build-windows.yml`).

---

## Ringkasan Urutan Eksekusi (Prioritas)

| # | Langkah | Estimasi | Dependency |
|---|---|---|---|
| 1 | Generate RSA keypair + setup Midtrans Snap | 0.5 hari | Akun Midtrans ✅ |
| 2 | Bangun Web Portal (checkout + webhook + email + activate) | 4–6 hari | #1 |
| 3 | Rust license layer (activate/check/clear + JWT verify) | 2–3 hari | #2 (perlu endpoint) |
| 4 | React UI (modal + badge + gate ebupot) | 2–3 hari | #3 |
| 5 | Security & testing | 2 hari | #4 |
| 6 | Deploy + docs + release | 1 hari | #5 |

**Total estimasi: ~12–16 hari kerja** (single maintainer).

---

## Catatan Risiko

- **CSP** — jika nekat longgarkan `connect-src` untuk call API dari React, bypass DevTools trivial. **Wajib** lewat Rust.
- **Midtrans webhook** harus pakai signature verification (SHA512 `order_id + status_code + gross_amount + server_key`) — jangan trust body mentah.
- **License key di email** = risiko phishing/forward. Pertimbangkan activation link ber-token sekali pakai sebagai alternatif.
- **Single maintainer** → mulai dari MVP: 1 tier (lifetime) dulu, tambah subscription bulanan setelah validasi pasar.

---

*End of plan-steps.md — BagiPRO Monetization Implementation Roadmap.*
