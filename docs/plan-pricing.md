# Rekomendasi Harga BagiPDF PRO (tanpa DRM‑berat)

## 1. Posisi Pasar
- **Kompetitor**: Rp 149.000 (one‑time) untuk semua fitur PRO.
- **Keunggulan BagiPDF**: 100 % offline, UI modern, keamanan AES‑256, dan ekosistem Tauri‑Rust yang ringan.
- **Target**: Menawarkan nilai yang setara atau lebih tinggi **dengan struktur biaya yang lebih mudah dipahami** dan **tanpa beban server berkelanjutan**.

## 2. Model Harga yang Direkomendasikan
| Paket | Harga (IDR) | Keterangan | Keuntungan Operasional |
|-------|------------|------------|------------------------|
| **Free (Core)** | **Gratis** | Semua tool dasar (split, merge, watermark, edit, proteksi) **tanpa batas**. Batch Ebupot **terbatas 10 file** per operasi. | Menarik pengguna baru, mengurangi support‑ticket “fitur dasar”. |
| **PRO – One‑Time** | **Rp 149.000** | Aktivasi **batch Ebupot tak terbatas** (hingga 2 000 file) + **fitur premium** (virtualisasi thumbnail, export ZIP). Lisensi **tidak kadaluarsa** (atau 5 tahun). | Model yang sama dengan kompetitor → rasa “fair”. Tidak ada langganan, jadi tidak ada beban server untuk renewal. |
| **PRO – Add‑On (Optional)** | **Rp 29.000** | Tambahan **batch Ebupot Unlimited** untuk pengguna Free yang hanya butuh satu kali upgrade. | Memungkinkan upsell tanpa harus upgrade ke paket full‑PRO. |
| **Enterprise / Volume** | **Rp 349.000** (maks 5 lisensi) | Lisensi **multi‑device** (hingga 5 PC) + dukungan prioritas (email / Discord). | Menarik kantor/kantor kecil, meningkatkan ARPU tanpa menambah infrastruktur. |

**Total harga untuk user individu**: **Rp 149.000** – sebanding dengan kompetitor, tetapi Anda tetap memberi **versi free** yang sangat berguna.

## 3. Mekanisme Lisensi Tanpa Server Berkelanjutan
| Langkah | Penjelasan | Alat / Layanan |
|--------|------------|----------------|
| **a. Pembayaran via platform yang menyediakan *License Generation*** | Gunakan **Paddle**, **Gumroad**, atau **Stripe Checkout + Stripe Billing** yang dapat mengirim **kode lisensi** otomatis ke email pembeli. Platform‑ini menangani pembayaran, pajak, dan pengiriman kode, sehingga **tidak perlu server Anda**. | *Paddle* (fitur “License Keys” built‑in) → langsung kirim JWT‑signed. <br>*Gumroad* → webhook → script satu‑kali (run locally) untuk men‑sign key dan meng‑email kembali. |
| **b. License Key = JWT Signed dengan Public Key di Aplikasi** | - **Private key** disimpan di dashboard Paddle (atau di file lokal yang hanya Anda akses). <br>- **Public key** di‑embed di `main.rs` (seperti yang sudah direncanakan). <br>- JWT berisi: `{ "plan":"PRO", "exp": <timestamp >, "device_fp": null }`. <br>- Karena tidak ada verifikasi server, `exp` dapat di‑set jauh ke depan (mis. 10 tahun) atau `null` (tidak kadaluarsa). | `jsonwebtoken` crate di Rust; `jwt.io` untuk debugging. |
| **c. Verifikasi di Rust (offline‑only)** | Pada startup atau sebelum batch, panggil command `check_license()`: <br>1. Baca file `license.dat` (JWT yang sudah dienkripsi). <br>2. Decrypt (AES‑256‑GCM, key = HKDF‑SHA256(fingerprint) – opsional, atau langsung decode jika Anda tidak ingin enkripsi). <br>3. Verifikasi signature dengan public key. <br>4. **Jika `plan == "PRO"` → aktifkan batch**; kalau tidak → blokir. | Semua berada di binary, tidak ada request jaringan. |
| **d. Device‑Binding (opsional, ringan)** | Jika Anda ingin membatasi penyebaran, tambahkan **fingerprint** ke JWT pada saat pembuatan (mis. hash hardware ID). Pada `check_license()` bandingkan dengan fingerprint lokal. <br>Jika tidak ingin server, Anda dapat **mengumpulkan fingerprint** melalui sebuah CLI kecil yang user jalankan sebelum checkout (mis. `bagipdf‑fp`) dan mengirimkan hasilnya bersama pembayaran (via email atau form). | `rust‑uuid`, `sysinfo` crate untuk fingerprint. |
| **e. Revocation (jarang diperlukan)** | Simpan **daftar revocation** dalam file statis yang di‑host di CDN (mis. GitHub Pages). Aplikasi dapat **download** file ini sekali‑sebulan (atau saat start) untuk menolak kunci yang diblokir. Karena revocation jarang, beban jaringan minimal. | `reqwest` di Rust; file “revoked.txt”. |

> **Catatan:** Jika Anda **tidak meng‑binding ke device** dan **tidak meng‑revocation**, maka lisensi bersifat “perpetual”. Ini mengurangi semua kompleksitas server, hanya butuh **public key** di binary.

## 4. Mengapa Model Ini Lebih Murah & Tidak Membutuhkan Server
| Biaya | Penjelasan |
|------|------------|
| **Infrastruktur server** | Tidak ada endpoint `/activate` atau `/deactivate`. Semua verifikasi dilakukan **lokal**. |
| **Pemeliharaan database** | Tidak ada tabel `activations`. Tidak ada migrasi, backup, atau scaling. |
| **Ops keamanan** | Hanya **verifikasi JWT offline** (sudah direncanakan) + **pencocokan device fingerprint**. Karena harga rendah, tidak ada tekanan untuk menambah lapisan DRM yang kompleks (yang biasanya meningkatkan biaya pengembangan & support). |
| **Biaya layanan pembayaran** | Platform seperti Paddle atau Gumroad mengambil **≈ 5 %** + transaksi fee; tidak ada biaya bulanan. |

## 5. Contoh Alur Pengguna (Tanpa Server)
1. **Pengguna meng‑unduh BagiPDF (free)** – semua fitur core tersedia.
2. Di UI “Upgrade ke PRO” → tombol **“Beli Sekarang – Rp 149.000”** membuka **Paddle Checkout** (embed di halaman web atau pop‑up dalam aplikasi via `open_url`).
3. Setelah pembayaran selesai, **Paddle mengirim email** berisi **kode lisensi** (contoh: `BPDF-7F3A-9C2E-4D1B-8E5F`).
4. Pengguna membuka **modal aktivasi** di aplikasi, menempelkan kode, dan menekan **“Aktivasi”**.
5. Aplikasi **menyimpan kode** di `AppData` (`license.dat`). Pada setiap start, `check_license()` memverifikasi signature → meng‑unlock batch.
6. (Opsional) Jika Anda men‑bind ke device, pengguna menjalankan `bagipdf‑fp` sebelum checkout; hasil fingerprint dikirim bersama pembayaran, sehingga kode lisensi berisi `device_fp`. Aplikasi memeriksa kecocokan di setiap run.

## 6. Penyesuaian Produk untuk Menjaga Kompetitivitas
| Fitur | Nilai Tambah vs Kompetitor |
|------|----------------------------|
| **Batch Ebupot Unlimited** | Sama‑nya, tapi Anda menambahkan **virtualisasi thumbnail** (lebih ringan pada PC lama). |
| **UI Sticky Action Bar** | Mempercepat workflow, tidak ada scroll‑required. |
| **Offline‑first** | Kompetitor biasanya memerlukan instalasi atau aktivasi online; Anda tetap **offline** setelah satu kali aktivasi. |
| **Free Core** | Pengguna dapat mencoba semua tool kecuali batch – meningkatkan adopsi dan word‑of‑mouth. |
| **Add‑On “Batch Unlimited”** | Membuka pintu upsell bagi pengguna yang hanya butuh sesekali batch tanpa membeli seluruh PRO. |
| **Support via GitHub Issues / Discord** | Tidak perlu tim support full‑time, cukup komunitas terbuka. |

## 7. Ringkasan Tindakan Selanjutnya
| Langkah | Tindakan |
|--------|----------|
| **1️⃣ Tentukan harga** | Set harga PRO **Rp 149.000** (one‑time) dan add‑on **Rp 29.000**. |
| **2️⃣ Pilih platform pembayaran** | Daftar ke **Paddle** (fitur License Keys) atau **Gumroad** + script signing. |
| **3️⃣ Buat generator JWT** | Skrip (Node/TS atau Rust) yang men‑sign JWT dengan private key; simpan public key di `main.rs`. |
| **4️⃣ Implementasi `check_license()`** | Tambahkan verifikasi signature, optional dekripsi, dan cek `plan == "PRO"`; panggil di startup & sebelum batch. |
| **5️⃣ UI Upgrade** | Tambahkan tombol “Beli PRO” yang membuka checkout; modal aktivasi untuk memasukkan kode. |
| **6️⃣ Dokumentasi** | Update `README.md` & `docs/plan.md` dengan alur pembelian & aktivasi. |
| **7️⃣ Testing** | Unit‑test untuk valid/invalid JWT, serta skenario “license missing”, “tampered file”, dan (jika device‑bound) “fingerprint mismatch”. |
| **8️⃣ Rilis** | Bump versi ke `v2.4.0`, buat build release via GitHub Actions, dan publikasikan di situs. |

### Kesimpulan
- **Harga Rp 149.000 satu‑kali** menempatkan BagiPDF tepat di level kompetitor, tetapi **menawarkan versi free** yang sangat berguna sehingga pengguna dapat mencoba sebelum membeli.
- **Lisensi berbasis JWT yang diverifikasi secara offline** menghilangkan kebutuhan server, database, dan pemeliharaan rutin.
- **Opsional device‑binding** dapat ditambahkan bila diperlukan, namun tidak wajib untuk menjaga biaya tetap rendah.
- Dengan alur **pembayaran terintegrasi (Paddle/Gumroad)**, Anda mengalihkan seluruh proses pembayaran & distribusi kode lisensi ke layanan pihak ketiga, sehingga **tidak ada beban infrastruktur**.

Implementasi ini memberi **model bisnis yang sederhana, biaya operasional minimal, dan tetap kompetitif** – memungkinkan Anda fokus pada pengembangan fitur utama BagiPDF.
