# Rencana Pengembangan: Fitur Rotasi PDF, JPG to PDF & Dropdown Konversi

## 1. Ringkasan & Tujuan (Overview & Goals)
Mengembangkan fitur-fitur pendukung PDF non-ebupot:
1. **Rotasi PDF (Rotate PDF)**: Kemampuan memutar orientasi halaman PDF (portrait, landscape, 90°, 180°, 270°) pada mode Rotate, Split PDF, dan Merge PDF.
2. **Konversi JPG to PDF**: Kemampuan mengubah satu atau beberapa file gambar (JPG/PNG) menjadi dokumen PDF utuh.
3. **Menu Navigasi Dropdown Konversi**: Mengelompokkan fitur konversi ke dalam satu menu Dropdown interaktif di navbar aplikasi agar UI tetap rapi, mencakup:
   - **PDF to Excel**
   - **JPG to Excel (Engine Tesseract OCR untuk Ekstraksi Tabel Gambar)**
   - **JPG to PDF**

---

## 2. Cakupan Fitur (Scope & Key Capabilities)

### A. Fitur Rotasi PDF (Rotate PDF)
- **Mode Khusus `'rotate'`**: Tab baru untuk pratinjau dan pemutaran halaman PDF.
- **Bulk Rotasi**: Putar Semua +90° (Clockwise), -90° (Counter-Clockwise), 180° (Flip), dan Reset.
- **Rotasi Per Halaman**: Kontrol tombol cepat pada thumbnail halaman (↺ Kiri, ↻ Kanan, 🔄 Flip).
- **Integrasi Split & Merge**: Rotasi halaman tetap diterapkan dan dipertahankan saat melakukan operasi Split PDF maupun Merge PDF.

### B. Fitur JPG to PDF (Konversi Gambar ke PDF)
- **Unggah Multi Gambar**: Mendukung format JPG, JPEG, PNG, WEBP.
- **Pengaturan Dokumen**:
  - Ukuran Halaman: Auto (Sesuai Gambar), A4, Letter.
  - Orientasi: Auto / Portrait / Landscape.
  - Margin Halaman: Tanpa Margin, Small, Normal.
- **Reorder, Rotation & Deletion**: Pengguna dapat mengubah urutan gambar, memutar gambar, serta menghapus gambar yang tidak diinginkan sebelum digabungkan menjadi PDF.
- **Ekspor Engine**: Menggunakan `pdf-lib` (`embedJpg` / `embedPng`) untuk menghasilkan dokumen PDF berkualitas tinggi secara offline.

### C. Fitur JPG to Excel (Ekstraksi Tabel & Teks dari Gambar via OCR)
- **Manajemen Berkas Gambar**: Kontrol lengkap kartu gambar terpilih mencakup Hapus Per Gambar, Hapus Semua, Putar Kiri/Kanan, dan Geser Urutan Gambar.
- **Engine OCR (Tesseract.js)**: Melakukan pengenalan karakter otomatis (Optical Character Recognition) pada gambar JPG/PNG (termasuk tangkapan layar WhatsApp dan dokumen).
- **Analisis Layout Tabel**: Mengelompokkan kata berdasarkan koordinat Y (baris) dan X (kolom) untuk menyusun kembali tabel yang ada pada gambar secara presisi.
- **Ekspor Excel**: Menghasilkan spreadsheet `.xlsx` berisi lembar kerja konsolidasi seluruh gambar dan lembar kerja individual per file gambar.

### D. Menu Navigasi Dropdown Konversi (Converter Dropdown Menu)
- Mengubah tombol tunggal "PDF to Excel" di header menjadi **Dropdown Menu Interaktif** (Converter Suite):
  1. 📄 **PDF to Excel**: Ekstraksi e-Bupot & Tabel Generic PDF ke Excel.
  2. 🖼️ **JPG to Excel**: Ekstraksi data/tabel dari file gambar JPG/PNG ke Excel menggunakan Tesseract OCR.
  3. 🖼️ ➔ 📄 **JPG to PDF**: Konversi gambar JPG/PNG menjadi file dokumen PDF.

---

## 3. Detail Teknis & Arsitektur (Technical Details)

### A. State Management (`App.tsx`)
- `mainTool`: `'split' | 'merge' | 'rotate' | 'lock' | 'watermark' | 'edit' | 'excel' | 'jpg2pdf' | 'jpg2excel'`
- `convertDropdownOpen`: boolean (state toggle menu dropdown konversi di header)
- `pageRotations`: `Record<number, number>` (mapping indeks halaman ke sudut rotasi)
- `jpgFiles`: Array berkas gambar beserta metadata orientasi, rotasi, dan pratinjau.

### B. Engine Pemrosesan (`pdf-lib`)
- **Rotasi PDF**: `page.setRotation(degrees((currentAngle + addedAngle) % 360))`
- **JPG to PDF**:
  ```typescript
  const pdfDoc = await PDFDocument.create();
  for (const imgFile of jpgFiles) {
    const imgBytes = await imgFile.arrayBuffer();
    const image = imgFile.type.includes('png') 
      ? await pdfDoc.embedPng(imgBytes) 
      : await pdfDoc.embedJpg(imgBytes);
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  ```

---

## 4. Rencana Langkah Eksekusi (Implementation Steps)

1. **Pembaruan Navigasi Header & Dropdown Converter**:
   - Ganti tombol tunggal konversi menjadi UI Dropdown Menu dengan pilihan: *PDF to Excel*, *JPG to Excel*, dan *JPG to PDF*.
2. **Implementasi Fitur Rotasi PDF (`App.tsx`)**:
   - Tambahkan state `pageRotations` & UI kontrol rotasi massal / per-halaman.
   - Perbarui handler `handleExecuteSplit`, `handleExecuteMerge`, dan buat `handleExecuteRotate`.
3. **Implementasi Fitur JPG to PDF (`App.tsx`)**:
   - Tambahkan form upload gambar & thumbnail reorder list.
   - Tambahkan handler `handleExecuteJpgToPdf()` untuk konversi & download PDF.
4. **Pengujian & Verifikasi**:
   - Jalankan `npm run build` di folder `webapp`.
   - Verifikasi fungsionalitas rotasi PDF, JPG to PDF, dan menu dropdown konversi.

---

## 5. File yang Dimodifikasi (Target Files)
- `plan.md`
- `webapp/src/App.tsx`
