import React, { useState, useRef } from 'react';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { 
  UploadCloud, 
  Grid, 
  Download, 
  RefreshCw,
  Sparkles,
  Info,
  Globe,
  User,
  X,
  Split,
  Lock,
  Eye,
  EyeOff,
  Key,
  Layers,
  Stamp,
  Edit3,
  FileSpreadsheet,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Type,
  Image as ImageIcon,
  Check,
  Move
} from 'lucide-react';

import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

// Configure pdfjs worker locally (100% offline & air-gapped compliant)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PageThumb {
  pageIndex: number;
  dataUrl: string;
  width: number;
  height: number;
}

interface MergeFileItem {
  id: string;
  file: File;
  totalPages: number;
  sizeMB: string;
}

interface PDFAnnotation {
  id: string;
  pageIndex: number;
  text: string;
  xPercent: number;
  yPercent: number;
  fontSize: number;
  color: string;
}

type MainToolMode = 'split' | 'merge' | 'watermark' | 'edit' | 'excel';

export default function App() {
  // Navigation Tool Suite Mode
  const [mainTool, setMainTool] = useState<MainToolMode>('split');

  // Common File State
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [thumbnails, setThumbnails] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [showAbout, setShowAbout] = useState<boolean>(false);

  // Toast Notification State
  const [toast, setToast] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Password State for Input PDF
  const [pdfPassword, setPdfPassword] = useState<string>('');
  const [showPdfPassword, setShowPdfPassword] = useState<boolean>(false);
  const [isEncrypted, setIsEncrypted] = useState<boolean>(false);
  const [lockOutputWithPassword, setLockOutputWithPassword] = useState<boolean>(true);

  // Password Prompt Modal State
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [modalPasswordInput, setModalPasswordInput] = useState<string>('');
  const [modalError, setModalError] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // --- SPLIT MODE STATE ---
  const [activeSplitTab, setActiveSplitTab] = useState<'custom' | 'fixed' | 'extract' | 'size'>('custom');
  const [customRanges, setCustomRanges] = useState<string>('1-2, 3-4');
  const [mergeCustom, setMergeCustom] = useState<boolean>(false);
  const [fixedStep, setFixedStep] = useState<number>(1);
  const [extractMode, setExtractMode] = useState<'all' | 'select'>('all');
  const [extractPagesStr, setExtractPagesStr] = useState<string>('1, 3');
  const [mergeExtract, setMergeExtract] = useState<boolean>(true);
  const [targetMB, setTargetMB] = useState<number>(2);

  // --- MERGE MODE STATE ---
  const [mergeFiles, setMergeFiles] = useState<MergeFileItem[]>([]);

  // --- WATERMARK MODE STATE ---
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  const [watermarkText, setWatermarkText] = useState<string>('CONFIDENTIAL');
  const [watermarkFontSize, setWatermarkFontSize] = useState<number>(48);
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.3);
  const [watermarkRotation, setWatermarkRotation] = useState<number>(45);
  const [watermarkColor, setWatermarkColor] = useState<string>('#EF4444');
  const [watermarkPosition, setWatermarkPosition] = useState<'center' | 'top' | 'bottom' | 'diagonal'>('center');
  const [watermarkImageFile, setWatermarkImageFile] = useState<File | null>(null);
  const [watermarkImagePreview, setWatermarkImagePreview] = useState<string | null>(null);

  // --- EDIT PDF STATE ---
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [annotationInput, setAnnotationInput] = useState<string>('Catatan PDF');
  const [annotationFontSize, setAnnotationFontSize] = useState<number>(18);
  const [annotationColor, setAnnotationColor] = useState<string>('#2563EB');

  // --- PDF TO EXCEL STATE ---
  const [excelData, setExcelData] = useState<string[][]>([]);
  const [isExtractingExcel, setIsExtractingExcel] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mergeFileInputRef = useRef<HTMLInputElement>(null);
  const watermarkImgInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        alert('Harap pilih file berformat PDF!');
        return;
      }
      await loadPdf(selectedFile);
    }
  };

  const loadPdf = async (pdfFile: File, overridePwd?: string) => {
    setLoading(true);
    setStatusMsg('Membaca PDF & Rendering Pratinjau...');
    setModalError('');
    const pwdToUse = overridePwd !== undefined ? overridePwd : pdfPassword;

    try {
      setFile(pdfFile);
      const arrayBuffer = await pdfFile.arrayBuffer();

      let loadedPdf: PDFDocument;
      try {
        loadedPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      } catch (pdfLibErr: any) {
        throw pdfLibErr;
      }

      setPdfDoc(loadedPdf);
      const count = loadedPdf.getPageCount();
      setTotalPages(count);

      // Render thumbnails using PDF.js
      let pdfJsDoc;
      try {
        pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer, password: pwdToUse }).promise;
      } catch (pdfJsErr: any) {
        if (
          pdfJsErr?.name === 'PasswordException' || 
          pdfJsErr?.code === 1 || 
          pdfJsErr?.code === 2 ||
          (pdfJsErr?.message || '').toLowerCase().includes('password')
        ) {
          setIsEncrypted(true);
          setPendingFile(pdfFile);
          setShowPasswordModal(true);
          if (overridePwd !== undefined && overridePwd !== '') {
            setModalError('Kata sandi salah. Silakan coba lagi.');
          }
          setLoading(false);
          return;
        }
        throw pdfJsErr;
      }

      const thumbs: PageThumb[] = [];

      for (let i = 1; i <= count; i++) {
        const page = await pdfJsDoc.getPage(i);
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          await page.render({ canvasContext: context, viewport }).promise;
          thumbs.push({
            pageIndex: i - 1,
            dataUrl: canvas.toDataURL('image/jpeg', 0.85),
            width: viewport.width,
            height: viewport.height
          });
        }
      }

      setThumbnails(thumbs);
      setIsEncrypted(!!pwdToUse);
      setShowPasswordModal(false);
      setModalPasswordInput('');
      setModalError('');
      if (overridePwd !== undefined) {
        setPdfPassword(overridePwd);
      }
      setStatusMsg('');
    } catch (err: any) {
      alert('Gagal membaca file PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleModalPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFile) return;
    await loadPdf(pendingFile, modalPasswordInput);
  };

  // WinAnsi character sanitizer for pdf-lib standard fonts
  const sanitizeWinAnsi = (str: string) => {
    if (!str) return '';
    return str
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/—/g, '-')
      .replace(/[^\x00-\x7F]/g, '');
  };

  const showToastNotification = (title: string, message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ show: true, title, message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 6000);
  };

  // Standard MD5 byte digest for PDF encryption dictionary
  const md5Bytes = (data: Uint8Array): Uint8Array => {
    const safeAdd = (x: number, y: number) => {
      const lsw = (x & 0xffff) + (y & 0xffff);
      const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
      return (msw << 16) | (lsw & 0xffff);
    };
    const bitRotateLeft = (num: number, cnt: number) => (num << cnt) | (num >>> (32 - cnt));
    const md5cmn = (q: number, a: number, b: number, x: number, s: number, t: number) => safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
    const md5ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => md5cmn((b & c) | (~b & d), a, b, x, s, t);
    const md5gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => md5cmn((b & d) | (c & ~d), a, b, x, s, t);
    const md5hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => md5cmn(b ^ c ^ d, a, b, x, s, t);
    const md5ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => md5cmn(c ^ (b | ~d), a, b, x, s, t);

    const n = data.length;
    const blocks: number[] = [];
    for (let i = 0; i < n; i++) blocks[i >> 2] |= data[i] << ((i % 4) * 8);
    blocks[n >> 2] |= 0x80 << ((n % 4) * 8);
    blocks[(((n + 8) >> 6) << 4) + 14] = n * 8;

    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;

    for (let i = 0; i < blocks.length; i += 16) {
      const olda = a, oldb = b, oldc = c, oldd = d;
      a = md5ff(a, b, c, d, blocks[i + 0] || 0, 7, -680876936);
      d = md5ff(d, a, b, c, blocks[i + 1] || 0, 12, -389564586);
      c = md5ff(c, d, a, b, blocks[i + 2] || 0, 17, 606105819);
      b = md5ff(b, c, d, a, blocks[i + 3] || 0, 22, -1044525330);
      a = md5ff(a, b, c, d, blocks[i + 4] || 0, 7, -176418897);
      d = md5ff(d, a, b, c, blocks[i + 5] || 0, 12, 1200080426);
      c = md5ff(c, d, a, b, blocks[i + 6] || 0, 17, -1473231341);
      b = md5ff(b, c, d, a, blocks[i + 7] || 0, 22, -45705983);
      a = md5ff(a, b, c, d, blocks[i + 8] || 0, 7, 1770035416);
      d = md5ff(d, a, b, c, blocks[i + 9] || 0, 12, -1958414417);
      c = md5ff(c, d, a, b, blocks[i + 10] || 0, 17, -42063);
      b = md5ff(b, c, d, a, blocks[i + 11] || 0, 22, -1990404162);
      a = md5ff(a, b, c, d, blocks[i + 12] || 0, 7, 1804603682);
      d = md5ff(d, a, b, c, blocks[i + 13] || 0, 12, -40341101);
      c = md5ff(c, d, a, b, blocks[i + 14] || 0, 17, -1502002290);
      b = md5ff(b, c, d, a, blocks[i + 15] || 0, 22, 1236535329);

      a = md5gg(a, b, c, d, blocks[i + 1] || 0, 5, -165796510);
      d = md5gg(d, a, b, c, blocks[i + 6] || 0, 9, -1069501632);
      c = md5gg(c, d, a, b, blocks[i + 11] || 0, 14, 643717713);
      b = md5gg(b, c, d, a, blocks[i + 0] || 0, 20, -373897302);
      a = md5gg(a, b, c, d, blocks[i + 5] || 0, 5, -701558691);
      d = md5gg(d, a, b, c, blocks[i + 10] || 0, 9, 38016083);
      c = md5gg(c, d, a, b, blocks[i + 15] || 0, 14, -660478335);
      b = md5gg(b, c, d, a, blocks[i + 4] || 0, 20, -405537848);
      a = md5gg(a, b, c, d, blocks[i + 9] || 0, 5, 568446438);
      d = md5gg(d, a, b, c, blocks[i + 14] || 0, 9, -1019803690);
      c = md5gg(c, d, a, b, blocks[i + 3] || 0, 14, -187363961);
      b = md5gg(b, c, d, a, blocks[i + 8] || 0, 20, 1163531501);
      a = md5gg(a, b, c, d, blocks[i + 13] || 0, 5, -1444681467);
      d = md5gg(d, a, b, c, blocks[i + 2] || 0, 9, -51403784);
      c = md5gg(c, d, a, b, blocks[i + 7] || 0, 14, 1735328473);
      b = md5gg(b, c, d, a, blocks[i + 12] || 0, 20, -1926607734);

      a = md5hh(a, b, c, d, blocks[i + 5] || 0, 4, -378558);
      d = md5hh(d, a, b, c, blocks[i + 8] || 0, 11, -2022574463);
      c = md5hh(c, d, a, b, blocks[i + 11] || 0, 16, 1839030562);
      b = md5hh(b, c, d, a, blocks[i + 14] || 0, 23, -35309556);
      a = md5hh(a, b, c, d, blocks[i + 1] || 0, 4, -1530992060);
      d = md5hh(d, a, b, c, blocks[i + 4] || 0, 11, 1272893353);
      c = md5hh(c, d, a, b, blocks[i + 7] || 0, 16, -1554976390);
      b = md5hh(b, c, d, a, blocks[i + 10] || 0, 23, -1094730640);
      a = md5hh(a, b, c, d, blocks[i + 13] || 0, 4, 681279174);
      d = md5hh(d, a, b, c, blocks[i + 0] || 0, 11, -358537222);
      c = md5hh(c, d, a, b, blocks[i + 3] || 0, 16, -722521979);
      b = md5hh(b, c, d, a, blocks[i + 6] || 0, 23, 76029189);
      a = md5hh(a, b, c, d, blocks[i + 9] || 0, 4, -640364409);
      d = md5hh(d, a, b, c, blocks[i + 12] || 0, 11, -421815835);
      c = md5hh(c, d, a, b, blocks[i + 15] || 0, 16, 530742520);
      b = md5hh(b, c, d, a, blocks[i + 2] || 0, 23, -995338651);

      a = md5ii(a, b, c, d, blocks[i + 0] || 0, 6, -198630844);
      d = md5ii(d, a, b, c, blocks[i + 7] || 0, 10, 1126891415);
      c = md5ii(c, d, a, b, blocks[i + 12] || 0, 15, -1416354905);
      b = md5ii(b, c, d, a, blocks[i + 5] || 0, 21, -57434055);
      a = md5ii(a, b, c, d, blocks[i + 14] || 0, 6, 1700485571);
      d = md5ii(d, a, b, c, blocks[i + 1] || 0, 10, -1894980156);
      c = md5ii(c, d, a, b, blocks[i + 4] || 0, 15, -1051523);
      b = md5ii(b, c, d, a, blocks[i + 11] || 0, 21, -2054922799);
      a = md5ii(a, b, c, d, blocks[i + 2] || 0, 6, 1873313359);
      d = md5ii(d, a, b, c, blocks[i + 9] || 0, 10, -30611744);
      c = md5ii(c, d, a, b, blocks[i + 16] || 0, 15, -1560198380);
      b = md5ii(b, c, d, a, blocks[i + 7] || 0, 21, 1309151649);

      a = safeAdd(a, olda); b = safeAdd(b, oldb); c = safeAdd(c, oldc); d = safeAdd(d, oldd);
    }

    const out = new Uint8Array(16);
    const words = [a, b, c, d];
    for (let i = 0; i < 16; i++) out[i] = (words[i >> 2] >> ((i % 4) * 8)) & 0xff;
    return out;
  };

  // Attach password protection dictionary to PDFDocument
  const applyPasswordToDoc = (doc: PDFDocument) => {
    if (!pdfPassword || !lockOutputWithPassword) return;
    try {
      const padding = new Uint8Array([
        0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
        0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x48, 0x53, 0x66, 0x74
      ]);
      const pwdBytes = new TextEncoder().encode(pdfPassword);
      const passBuf = new Uint8Array(32);
      passBuf.set(pwdBytes.subarray(0, 32));
      if (pwdBytes.length < 32) {
        passBuf.set(padding.subarray(0, 32 - pwdBytes.length), pwdBytes.length);
      }
      const uHash = md5Bytes(passBuf);
      const oHash = md5Bytes(passBuf);

      const context = doc.context;
      const encryptDict = context.obj({
        Filter: 'Standard',
        V: 1,
        R: 2,
        O: oHash,
        U: uHash,
        P: -44,
      });

      const encryptRef = context.register(encryptDict);
      doc.catalog.set(doc.context.obj('Encrypt') as any, encryptRef);
    } catch (e) {
      console.warn('Gagal memasang kata sandi pada PDF:', e);
    }
  };

  // Helper download/save blob function with Native Save File Picker & Toast awareness
  const downloadBlob = async (bytesOrBlob: Uint8Array | Blob, fileName: string, mimeType = 'application/pdf') => {
    try {
      let blob: Blob;
      if (bytesOrBlob instanceof Blob) {
        blob = bytesOrBlob;
      } else {
        const cleanArray = new Uint8Array(bytesOrBlob.length);
        cleanArray.set(bytesOrBlob);
        blob = new Blob([cleanArray.buffer], { type: mimeType });
      }

      // Try Native Save File Picker first (opens Save As dialog to let user choose folder & filename)
      if ('showSaveFilePicker' in window) {
        try {
          const extension = fileName.substring(fileName.lastIndexOf('.'));
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: mimeType === 'application/zip' ? 'ZIP Archive' : 'PDF Document',
                accept: { [mimeType]: [extension] }
              }
            ]
          });

          const writableStream = await fileHandle.createWritable();
          await writableStream.write(blob);
          await writableStream.close();

          showToastNotification(
            'File Berhasil Disimpan!',
            `Dokumen "${fileName}" telah berhasil disimpan di lokasi pilihan Anda.`
          );
          return;
        } catch (pickerErr: any) {
          // If user cancels the Save As dialog, cancel gracefully without error
          if (pickerErr?.name === 'AbortError') {
            return;
          }
          console.warn('showSaveFilePicker error, falling back to standard download:', pickerErr);
        }
      }

      // Fallback: Standard browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      showToastNotification(
        'File Berhasil Diunduh!',
        `Dokumen "${fileName}" telah berhasil diproses & disimpan.`
      );

      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      }, 2000);
    } catch (err: any) {
      alert('Gagal menyimpan file: ' + err.message);
    }
  };

  const hexToRgb = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    const bigint = parseInt(cleanHex, 16);
    const r = ((bigint >> 16) & 255) / 255;
    const g = ((bigint >> 8) & 255) / 255;
    const b = (bigint & 255) / 255;
    return rgb(r, g, b);
  };

  // Parse page range inputs like "1-3, 5, 8-10" safely
  const parseRanges = (str: string, total: number): number[][] => {
    const result: number[][] = [];
    const parts = str.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) {
      throw new Error('Masukkan rentang halaman terlebih dahulu (contoh: 1-3, 5).');
    }
    for (const part of parts) {
      if (part.includes('-')) {
        const rangeParts = part.split('-').map(s => s.trim());
        if (rangeParts.length !== 2) {
          throw new Error(`Format rentang halaman tidak valid: "${part}"`);
        }
        const start = parseInt(rangeParts[0], 10);
        const end = parseInt(rangeParts[1], 10);
        if (isNaN(start) || isNaN(end) || start < 1 || end > total || start > end) {
          throw new Error(`Rentang halaman tidak valid (1-${total}): "${part}"`);
        }
        const rangeList: number[] = [];
        for (let i = start - 1; i < end; i++) rangeList.push(i);
        result.push(rangeList);
      } else {
        const p = parseInt(part, 10);
        if (isNaN(p) || p < 1 || p > total) {
          throw new Error(`Halaman di luar jangkauan (1-${total}): "${part}"`);
        }
        result.push([p - 1]);
      }
    }
    return result;
  };

  const handleExecuteSplit = async () => {
    if (!file || !pdfDoc) return;
    setLoading(true);
    setStatusMsg('Memproses Split PDF...');

    try {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const zip = new JSZip();
      let generatedFiles: { name: string; bytes: Uint8Array }[] = [];

      if (activeSplitTab === 'custom') {
        const ranges = parseRanges(customRanges, totalPages);
        if (mergeCustom) {
          const newPdf = await PDFDocument.create();
          for (const range of ranges) {
            const copiedPages = await newPdf.copyPages(pdfDoc, range);
            copiedPages.forEach(p => newPdf.addPage(p));
          }
          applyPasswordToDoc(newPdf);
          const pdfBytes = await newPdf.save();
          await downloadBlob(pdfBytes, `${baseName}_custom_merged.pdf`);
          setLoading(false);
          return;
        } else {
          for (let idx = 0; idx < ranges.length; idx++) {
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, ranges[idx]);
            copiedPages.forEach(p => newPdf.addPage(p));
            applyPasswordToDoc(newPdf);
            const pdfBytes = await newPdf.save();
            generatedFiles.push({ name: `${baseName}_range_${idx + 1}.pdf`, bytes: pdfBytes });
          }
        }
      } else if (activeSplitTab === 'fixed') {
        const step = Math.max(1, fixedStep);
        let part = 1;
        for (let i = 0; i < totalPages; i += step) {
          const range = Array.from({ length: Math.min(step, totalPages - i) }, (_, k) => i + k);
          const newPdf = await PDFDocument.create();
          const copiedPages = await newPdf.copyPages(pdfDoc, range);
          copiedPages.forEach(p => newPdf.addPage(p));
          applyPasswordToDoc(newPdf);
          const pdfBytes = await newPdf.save();
          generatedFiles.push({ name: `${baseName}_part_${part}.pdf`, bytes: pdfBytes });
          part++;
        }
      } else if (activeSplitTab === 'extract') {
        if (extractMode === 'all') {
          for (let i = 0; i < totalPages; i++) {
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, [i]);
            copiedPages.forEach(p => newPdf.addPage(p));
            applyPasswordToDoc(newPdf);
            const pdfBytes = await newPdf.save();
            generatedFiles.push({ name: `${baseName}_page_${i + 1}.pdf`, bytes: pdfBytes });
          }
        } else {
          const ranges = parseRanges(extractPagesStr, totalPages);
          const flatIndices = ranges.flat();

          if (mergeExtract) {
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, flatIndices);
            copiedPages.forEach(p => newPdf.addPage(p));
            applyPasswordToDoc(newPdf);
            const pdfBytes = await newPdf.save();
            await downloadBlob(pdfBytes, `${baseName}_extracted.pdf`);
            setLoading(false);
            return;
          } else {
            for (const idx of flatIndices) {
              const newPdf = await PDFDocument.create();
              const copiedPages = await newPdf.copyPages(pdfDoc, [idx]);
              copiedPages.forEach(p => newPdf.addPage(p));
              applyPasswordToDoc(newPdf);
              const pdfBytes = await newPdf.save();
              generatedFiles.push({ name: `${baseName}_page_${idx + 1}.pdf`, bytes: pdfBytes });
            }
          }
        }
      } else if (activeSplitTab === 'size') {
        const targetBytes = targetMB * 1024 * 1024;
        let part = 1;
        let currentPdf = await PDFDocument.create();

        for (let i = 0; i < totalPages; i++) {
          const tempPdf = await PDFDocument.create();
          const existingPages = await tempPdf.copyPages(currentPdf, currentPdf.getPageIndices());
          existingPages.forEach(p => tempPdf.addPage(p));
          
          const newPage = await tempPdf.copyPages(pdfDoc, [i]);
          tempPdf.addPage(newPage[0]);
          
          const tempBytes = await tempPdf.save();

          if (tempBytes.byteLength > targetBytes && currentPdf.getPageCount() > 0) {
            applyPasswordToDoc(currentPdf);
            const currentBytes = await currentPdf.save();
            generatedFiles.push({ name: `${baseName}_size_part_${part}.pdf`, bytes: currentBytes });
            part++;
            currentPdf = await PDFDocument.create();
          }

          const copied = await currentPdf.copyPages(pdfDoc, [i]);
          currentPdf.addPage(copied[0]);
        }

        if (currentPdf.getPageCount() > 0) {
          applyPasswordToDoc(currentPdf);
          const finalBytes = await currentPdf.save();
          generatedFiles.push({ name: `${baseName}_size_part_${part}.pdf`, bytes: finalBytes });
        }
      }

      if (generatedFiles.length === 1) {
        await downloadBlob(generatedFiles[0].bytes, generatedFiles[0].name, 'application/pdf');
      } else if (generatedFiles.length > 1) {
        generatedFiles.forEach(f => zip.file(f.name, f.bytes, { binary: true }));
        const zipBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
        await downloadBlob(zipBlob, `${baseName}_split_files.zip`, 'application/zip');
      }

    } catch (err: any) {
      alert('Error saat memproses PDF: ' + err.message);
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  // --- MERGE PDF LOGIC ---
  const handleMergeFilesAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    if (selectedFiles.length === 0) return;

    setLoading(true);
    setStatusMsg('Membaca file PDF...');

    const newItems: MergeFileItem[] = [];
    for (const f of selectedFiles) {
      try {
        const ab = await f.arrayBuffer();
        const doc = await PDFDocument.load(ab, { ignoreEncryption: true });
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          totalPages: doc.getPageCount(),
          sizeMB: (f.size / (1024 * 1024)).toFixed(2)
        });
      } catch (err) {
        console.warn('Gagal membaca PDF:', f.name, err);
      }
    }

    setMergeFiles(prev => [...prev, ...newItems]);
    setLoading(false);
    setStatusMsg('');
  };

  const moveMergeFile = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mergeFiles.length) return;
    const updated = [...mergeFiles];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setMergeFiles(updated);
  };

  const removeMergeFile = (index: number) => {
    setMergeFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleExecuteMerge = async () => {
    if (mergeFiles.length < 2) {
      alert('Harap pilih minimal 2 file PDF untuk digabungkan!');
      return;
    }

    setLoading(true);
    setStatusMsg('Menggabungkan seluruh file PDF...');

    try {
      const mergedPdf = await PDFDocument.create();
      for (const item of mergeFiles) {
        const arrayBuffer = await item.file.arrayBuffer();
        const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const pageIndices = srcDoc.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(srcDoc, pageIndices);
        copiedPages.forEach(p => mergedPdf.addPage(p));
      }

      applyPasswordToDoc(mergedPdf);
      const mergedBytes = await mergedPdf.save();
      await downloadBlob(mergedBytes, 'BagiPDF_Merged_Document.pdf');
    } catch (err: any) {
      alert('Gagal menggabungkan PDF: ' + err.message);
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  // --- WATERMARK PDF LOGIC ---
  const handleWatermarkImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const imgFile = e.target.files[0];
      setWatermarkImageFile(imgFile);
      const reader = new FileReader();
      reader.onload = (event) => setWatermarkImagePreview(event.target?.result as string);
      reader.readAsDataURL(imgFile);
    }
  };

  const handleExecuteWatermark = async () => {
    if (!file) {
      alert('Harap pilih file PDF terlebih dahulu!');
      return;
    }

    setLoading(true);
    setStatusMsg('Menerapkan Watermark pada PDF...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pages = doc.getPages();

      let embeddedImage: any = null;
      if (watermarkType === 'image' && watermarkImageFile) {
        const imgBuffer = await watermarkImageFile.arrayBuffer();
        if (watermarkImageFile.type.includes('png')) {
          embeddedImage = await doc.embedPng(imgBuffer);
        } else {
          embeddedImage = await doc.embedJpg(imgBuffer);
        }
      }

      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const watermarkColorRgb = hexToRgb(watermarkColor);

      for (const page of pages) {
        const { width, height } = page.getSize();

        if (watermarkType === 'text') {
          const cleanText = sanitizeWinAnsi(watermarkText) || 'WATERMARK';
          const textWidth = font.widthOfTextAtSize(cleanText, watermarkFontSize);
          const textHeight = font.heightAtSize(watermarkFontSize);

          let x = (width - textWidth) / 2;
          let y = (height - textHeight) / 2;

          if (watermarkPosition === 'top') {
            y = height - textHeight - 50;
          } else if (watermarkPosition === 'bottom') {
            y = 50;
          }

          page.drawText(cleanText, {
            x,
            y,
            size: watermarkFontSize,
            font,
            color: watermarkColorRgb,
            opacity: watermarkOpacity,
            rotate: degrees(watermarkRotation)
          });
        } else if (watermarkType === 'image' && embeddedImage) {
          const imgWidth = 200;
          const imgScale = embeddedImage.height / embeddedImage.width;
          const imgHeight = imgWidth * imgScale;

          const x = (width - imgWidth) / 2;
          const y = (height - imgHeight) / 2;

          page.drawImage(embeddedImage, {
            x,
            y,
            width: imgWidth,
            height: imgHeight,
            opacity: watermarkOpacity,
            rotate: degrees(watermarkRotation)
          });
        }
      }

      applyPasswordToDoc(doc);
      const wmBytes = await doc.save();
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      await downloadBlob(wmBytes, `${baseName}_watermarked.pdf`);
    } catch (err: any) {
      alert('Gagal menerapkan Watermark: ' + err.message);
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  // --- EDIT PDF LOGIC ---
  const handleAddAnnotation = () => {
    if (!annotationInput.trim()) return;
    const newAnn: PDFAnnotation = {
      id: Math.random().toString(36).substring(2, 9),
      pageIndex: selectedPageIndex,
      text: annotationInput.trim(),
      xPercent: 50,
      yPercent: 50,
      fontSize: annotationFontSize,
      color: annotationColor
    };
    setAnnotations(prev => [...prev, newAnn]);
  };

  const handleRemoveAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  const handleExecuteEditPdf = async () => {
    if (!file) {
      alert('Harap pilih file PDF terlebih dahulu!');
      return;
    }
    if (annotations.length === 0) {
      alert('Belum ada teks/catatan yang ditambahkan ke PDF!');
      return;
    }

    setLoading(true);
    setStatusMsg('Menyimpan perubahan catatan pada PDF...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.HelveticaBold);

      for (const ann of annotations) {
        if (ann.pageIndex >= doc.getPageCount()) continue;
        const page = doc.getPage(ann.pageIndex);
        const { width, height } = page.getSize();

        const x = (ann.xPercent / 100) * width;
        const y = ((100 - ann.yPercent) / 100) * height;
        const colorRgb = hexToRgb(ann.color);

        const cleanText = sanitizeWinAnsi(ann.text);
        if (!cleanText) continue;

        page.drawText(cleanText, {
          x,
          y,
          size: ann.fontSize,
          font,
          color: colorRgb
        });
      }

      applyPasswordToDoc(doc);
      const editedBytes = await doc.save();
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      await downloadBlob(editedBytes, `${baseName}_edited.pdf`);
    } catch (err: any) {
      alert('Gagal menyimpan hasil edit PDF: ' + err.message);
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  // --- PDF TO EXCEL LOGIC ---
  const handleExtractPdfToExcel = async () => {
    if (!file) {
      alert('Harap pilih file PDF terlebih dahulu!');
      return;
    }

    setIsExtractingExcel(true);
    setLoading(true);
    setStatusMsg('Mengekstrak data teks & tabel dari PDF...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer, password: pdfPassword }).promise;
      const count = pdfJsDoc.numPages;

      const extractedRows: string[][] = [];
      extractedRows.push(['Halaman', 'Kolom 1 / Konten Teks', 'Position Y', 'Position X']);

      for (let i = 1; i <= count; i++) {
        const page = await pdfJsDoc.getPage(i);
        const textContent = await page.getTextContent();
        
        // Group items by vertical position Y
        const items = textContent.items as any[];
        const lineMap: { [y: number]: any[] } = {};

        for (const item of items) {
          if (!item.str || !item.str.trim()) continue;
          const y = Math.round(item.transform[5] / 10) * 10; // 10px row tolerance grouping
          if (!lineMap[y]) lineMap[y] = [];
          lineMap[y].push(item);
        }

        // Sort rows top-to-bottom (highest Y to lowest Y)
        const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);

        for (const y of sortedYs) {
          const rowItems = lineMap[y];
          // Sort items left-to-right (lowest X to highest X)
          rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
          
          const rowValues = rowItems.map(it => it.str.trim());
          extractedRows.push([`Halaman ${i}`, ...rowValues]);
        }
      }

      setExcelData(extractedRows);
      setStatusMsg('');
    } catch (err: any) {
      alert('Gagal mengekstrak PDF ke Excel: ' + err.message);
    } finally {
      setIsExtractingExcel(false);
      setLoading(false);
    }
  };

  const handleExportExcelFile = async () => {
    if (excelData.length === 0) {
      alert('Belum ada data tabel yang diekstrak!');
      return;
    }
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BagiPDF Export');
    const baseName = file ? file.name.replace(/\.[^/.]+$/, '') : 'PDF_Data';
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await downloadBlob(
      new Uint8Array(excelBuffer),
      `${baseName}_exported.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  };

  return (
    <div className="min-h-screen bg-[#1E1E24] text-slate-200 flex flex-col font-sans select-none antialiased relative">
      {/* Toast Notification Banner */}
      {toast && toast.show && (
        <div className="fixed top-14 right-5 z-50 max-w-sm bg-slate-900/95 border border-emerald-500/50 text-white p-4 rounded-xl shadow-2xl backdrop-blur-md flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg flex-shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <div className="flex-1 pr-1">
            <h4 className="text-xs font-semibold text-emerald-400">{toast.title}</h4>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{toast.message}</p>
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* macOS Style Header Bar */}
      <header className="h-12 bg-[#2B2B36]/80 backdrop-blur-md border-b border-slate-700/50 px-4 flex items-center justify-between shadow-sm drag flex-shrink-0">
        {/* Left: Window Control Dots */}
        <div className="flex items-center space-x-2 w-24">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] hover:opacity-80 transition cursor-pointer"></div>
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] hover:opacity-80 transition cursor-pointer"></div>
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29] hover:opacity-80 transition cursor-pointer"></div>
        </div>

        {/* Title & Main Suite Selector */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Split className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-300 tracking-wide">BagiPDF</span>
          </div>

          {/* Navigation Bar (iLovePDF Style Tools) */}
          <nav className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-700/60">
            <button 
              onClick={() => setMainTool('split')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${mainTool === 'split' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>Split PDF</span>
            </button>
            <button 
              onClick={() => setMainTool('merge')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${mainTool === 'merge' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Merge PDF</span>
            </button>
            <button 
              onClick={() => setMainTool('watermark')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${mainTool === 'watermark' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Stamp className="w-3.5 h-3.5" />
              <span>Watermark</span>
            </button>
            <button 
              onClick={() => setMainTool('edit')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${mainTool === 'edit' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit PDF</span>
            </button>
            <button 
              onClick={() => setMainTool('excel')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${mainTool === 'excel' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>PDF to Excel</span>
            </button>
          </nav>
        </div>

        {/* Right Menu: About Button */}
        <div className="flex items-center justify-end w-24">
          <button 
            onClick={() => setShowAbout(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 px-2.5 py-1 rounded-md transition shadow-xs"
          >
            <Info className="w-3.5 h-3.5" />
            <span>About</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="flex-1 flex p-5 gap-5 overflow-hidden">

        {/* --- 1. SPLIT PDF SUITE --- */}
        {mainTool === 'split' && (
          <>
            <aside className="w-[340px] bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-4 shadow-xl backdrop-blur-xl flex-shrink-0 overflow-y-auto">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-xl p-4 transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2.5 ${
                  file ? 'border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/15' : 'border-slate-600/60 bg-slate-800/40 hover:bg-slate-800/70 hover:border-slate-500'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow-inner ${file ? 'bg-indigo-500 text-white' : 'bg-slate-700/70 text-slate-300'}`}>
                  <UploadCloud className="w-5 h-5" />
                </div>
                {file ? (
                  <div className="w-full">
                    <p className="font-medium text-xs text-indigo-200 truncate max-w-[260px] mx-auto">{file.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{totalPages} Halaman • {(file.size / (1024*1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-xs text-slate-200">Pilih File PDF</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Klik untuk memilih dokumen PDF</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />

              {/* Password Box */}
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-indigo-400" /> Kata Sandi & Lock PDF</span>
                </div>
                <div className="relative flex items-center">
                  <input 
                    type={showPdfPassword ? "text" : "password"} 
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    placeholder="Masukkan password PDF..."
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button type="button" onClick={() => setShowPdfPassword(!showPdfPassword)} className="absolute right-2 text-slate-400 hover:text-slate-200">
                    {showPdfPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {pdfPassword.trim().length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-slate-800">
                    <input 
                      type="checkbox" 
                      checked={lockOutputWithPassword} 
                      onChange={(e) => setLockOutputWithPassword(e.target.checked)} 
                      className="rounded border-slate-700 text-indigo-600 bg-slate-900" 
                    />
                    <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                      🔒 Kunci File Output dengan Password Ini
                    </span>
                  </label>
                )}
              </div>

              {/* Mode Tabs */}
              <div className="flex flex-col flex-1 gap-3.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mode Pemotongan</label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-900/60 p-1 rounded-lg border border-slate-700/50">
                  <button onClick={() => setActiveSplitTab('custom')} className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition ${activeSplitTab === 'custom' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Custom Range</button>
                  <button onClick={() => setActiveSplitTab('fixed')} className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition ${activeSplitTab === 'fixed' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Fixed Range</button>
                  <button onClick={() => setActiveSplitTab('extract')} className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition ${activeSplitTab === 'extract' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Extract Pages</button>
                  <button onClick={() => setActiveSplitTab('size')} className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition ${activeSplitTab === 'size' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Split by Size</button>
                </div>

                <div className="bg-slate-900/40 border border-slate-700/40 rounded-xl p-3.5 flex-1 flex flex-col justify-between">
                  {activeSplitTab === 'custom' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">Rentang Halaman Custom</label>
                        <input type="text" value={customRanges} onChange={(e) => setCustomRanges(e.target.value)} className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white" />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input type="checkbox" checked={mergeCustom} onChange={(e) => setMergeCustom(e.target.checked)} className="rounded border-slate-700 text-indigo-600 bg-slate-900" />
                        <span className="text-xs text-slate-300">Gabungkan hasil rentang ke 1 file</span>
                      </label>
                    </div>
                  )}

                  {activeSplitTab === 'fixed' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-1">Split Setiap N Halaman</label>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs text-slate-400">Setiap</span>
                          <input type="number" min="1" value={fixedStep} onChange={(e) => setFixedStep(parseInt(e.target.value) || 1)} className="w-20 bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white text-center" />
                          <span className="text-xs text-slate-400">halaman</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSplitTab === 'extract' && (
                    <div className="space-y-3">
                      <label className="text-xs font-medium text-slate-300 block">Opsi Ekstraksi</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="extMode" checked={extractMode === 'all'} onChange={() => setExtractMode('all')} /><span className="text-xs text-slate-300">Ekstrak SEMUA halaman</span></label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="extMode" checked={extractMode === 'select'} onChange={() => setExtractMode('select')} /><span className="text-xs text-slate-300">Ekstrak Halaman Tertentu</span></label>
                      {extractMode === 'select' && (
                        <input type="text" value={extractPagesStr} onChange={(e) => setExtractPagesStr(e.target.value)} placeholder="Contoh: 1, 3, 5-7" className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white" />
                      )}
                    </div>
                  )}

                  {activeSplitTab === 'size' && (
                    <div className="space-y-3">
                      <label className="text-xs font-medium text-slate-300 block mb-1">Batas Maksimal Ukuran (MB)</label>
                      <input type="number" step="0.5" min="0.5" value={targetMB} onChange={(e) => setTargetMB(parseFloat(e.target.value) || 1)} className="w-24 bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white text-center" />
                    </div>
                  )}

                  <button 
                    disabled={!file || loading}
                    onClick={handleExecuteSplit}
                    className="w-full mt-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg shadow-md transition flex items-center justify-center gap-2 text-xs"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span>Proses & Simpan Split PDF</span>
                  </button>
                </div>
              </div>
            </aside>

            {/* Visual Preview */}
            <section className="flex-1 bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl flex flex-col overflow-hidden shadow-xl backdrop-blur-xl">
              <div className="bg-slate-900/60 px-5 py-2.5 border-b border-slate-700/50 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-300 flex items-center gap-2"><Grid className="w-3.5 h-3.5 text-indigo-400" /> Pratinjau Visual Halaman</h2>
                {totalPages > 0 && <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700/60">{totalPages} Halaman</span>}
              </div>
              <div className="flex-1 p-5 overflow-y-auto bg-[#181820]">
                {thumbnails.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                    {thumbnails.map(thumb => (
                      <div key={thumb.pageIndex} className="bg-[#23232D] border border-slate-700/50 rounded-lg p-2.5 flex flex-col items-center gap-2">
                        <img src={thumb.dataUrl} alt={`Halaman ${thumb.pageIndex + 1}`} className="object-contain w-full h-full rounded border border-slate-800" />
                        <span className="text-[10px] text-slate-300">Halaman {thumb.pageIndex + 1}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* --- 2. MERGE PDF SUITE --- */}
        {mainTool === 'merge' && (
          <div className="flex-1 flex gap-5">
            <aside className="w-[360px] bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-4 shadow-xl backdrop-blur-xl flex-shrink-0">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" /> Penggabungan Multiple PDF
              </h3>

              <div 
                onClick={() => mergeFileInputRef.current?.click()}
                className="border border-dashed border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl p-5 cursor-pointer text-center flex flex-col items-center justify-center gap-2 transition"
              >
                <Plus className="w-6 h-6 text-indigo-400" />
                <p className="text-xs font-semibold text-indigo-200">Tambah File PDF</p>
                <p className="text-[11px] text-slate-400">Pilih 2 atau lebih file PDF untuk digabungkan</p>
              </div>
              <input ref={mergeFileInputRef} type="file" accept="application/pdf" multiple onChange={handleMergeFilesAdd} className="hidden" />

              <div className="flex-1 flex flex-col justify-between">
                <p className="text-[11px] text-slate-400">Urutan penggabungan file akan disesuaikan dari atas ke bawah pada daftar sebelah kanan.</p>
                <button 
                  disabled={mergeFiles.length < 2 || loading}
                  onClick={handleExecuteMerge}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg shadow-md transition flex items-center justify-center gap-2 text-xs mt-4"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                  <span>Gabungkan ({mergeFiles.length}) File PDF</span>
                </button>
              </div>
            </aside>

            {/* List of Files to Merge */}
            <section className="flex-1 bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-5 flex flex-col gap-3 overflow-hidden shadow-xl backdrop-blur-xl">
              <h4 className="text-xs font-semibold text-slate-300">Daftar File PDF yang Akan Digabungkan:</h4>
              {mergeFiles.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <Layers className="w-12 h-12 text-slate-600 mb-2" />
                  <p className="text-xs font-medium text-slate-300">Belum Ada File Ditambahkan</p>
                  <p className="text-[11px] text-slate-500 mt-1">Klik tombol "+ Tambah File PDF" di sebelah kiri.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {mergeFiles.map((item, idx) => (
                    <div key={item.id} className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs hover:border-indigo-500/50 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">{item.file.name}</p>
                          <p className="text-[11px] text-slate-400">{item.totalPages} Halaman • {item.sizeMB} MB</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button disabled={idx === 0} onClick={() => moveMergeFile(idx, 'up')} className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button disabled={idx === mergeFiles.length - 1} onClick={() => moveMergeFile(idx, 'down')} className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeMergeFile(idx)} className="p-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* --- 3. WATERMARK PDF SUITE --- */}
        {mainTool === 'watermark' && (
          <div className="flex-1 flex gap-5">
            <aside className="w-[360px] bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-4 shadow-xl backdrop-blur-xl flex-shrink-0 overflow-y-auto">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Stamp className="w-4 h-4 text-indigo-400" /> Pengaturan Watermark
              </h3>

              {/* Upload Input File */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-slate-600 rounded-xl p-3 text-center cursor-pointer bg-slate-800/40 hover:bg-slate-800/70"
              >
                <p className="text-xs text-indigo-300 font-medium truncate">{file ? file.name : 'Pilih File PDF Target'}</p>
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />

              {/* Watermark Type */}
              <div className="flex gap-2 bg-slate-900/60 p-1 rounded-lg border border-slate-700/50">
                <button onClick={() => setWatermarkType('text')} className={`flex-1 py-1 text-xs font-medium rounded-md ${watermarkType === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                  Teks Watermark
                </button>
                <button onClick={() => setWatermarkType('image')} className={`flex-1 py-1 text-xs font-medium rounded-md ${watermarkType === 'image' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                  Gambar Watermark
                </button>
              </div>

              {watermarkType === 'text' ? (
                <div className="space-y-3 bg-slate-900/40 p-3 rounded-xl border border-slate-700/40 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Teks Watermark</label>
                    <input type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Ukuran Font</label>
                      <input type="number" min="10" max="150" value={watermarkFontSize} onChange={(e) => setWatermarkFontSize(parseInt(e.target.value) || 24)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-center" />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Warna Teks</label>
                      <input type="color" value={watermarkColor} onChange={(e) => setWatermarkColor(e.target.value)} className="w-full h-7 bg-slate-950 border border-slate-700 rounded-lg cursor-pointer" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Sudut Rotasi ({watermarkRotation}°)</label>
                    <input type="range" min="-90" max="90" value={watermarkRotation} onChange={(e) => setWatermarkRotation(parseInt(e.target.value))} className="w-full accent-indigo-500" />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Transparansi / Opacity ({Math.round(watermarkOpacity * 100)}%)</label>
                    <input type="range" min="0.1" max="1" step="0.05" value={watermarkOpacity} onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-slate-900/40 p-3 rounded-xl border border-slate-700/40 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Pilih Gambar Logo/Cap</label>
                    <button onClick={() => watermarkImgInputRef.current?.click()} className="w-full bg-slate-800 border border-slate-700 hover:bg-slate-700 text-indigo-300 py-1.5 rounded-lg">
                      Upload Logo (.png, .jpg)
                    </button>
                    <input ref={watermarkImgInputRef} type="file" accept="image/*" onChange={handleWatermarkImageChange} className="hidden" />
                  </div>
                  {watermarkImagePreview && (
                    <div className="w-full h-24 bg-slate-950 rounded-lg p-2 border border-slate-800 flex items-center justify-center">
                      <img src={watermarkImagePreview} alt="Preview Logo" className="max-h-full object-contain" />
                    </div>
                  )}
                </div>
              )}

              <button 
                disabled={!file || loading}
                onClick={handleExecuteWatermark}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg shadow-md transition flex items-center justify-center gap-2 text-xs"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Stamp className="w-4 h-4" />}
                <span>Terapkan & Simpan Watermark</span>
              </button>
            </aside>

            {/* Visual Canvas Preview */}
            <section className="flex-1 bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-5 flex flex-col items-center justify-center shadow-xl backdrop-blur-xl relative overflow-hidden">
              <h4 className="absolute top-4 left-5 text-xs font-semibold text-slate-300">Visual Pratinjau Watermark:</h4>
              {thumbnails.length > 0 ? (
                <div className="relative border border-slate-700 rounded-lg overflow-hidden max-w-sm shadow-2xl bg-white">
                  <img src={thumbnails[0].dataUrl} alt="Visual Page" className="w-full object-contain" />
                  {/* Overlay Simulated Watermark */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {watermarkType === 'text' ? (
                      <span 
                        style={{
                          fontSize: `${watermarkFontSize * 0.4}px`,
                          color: watermarkColor,
                          opacity: watermarkOpacity,
                          transform: `rotate(${watermarkRotation}deg)`,
                          fontWeight: 'bold',
                        }}
                      >
                        {watermarkText}
                      </span>
                    ) : watermarkImagePreview ? (
                      <img 
                        src={watermarkImagePreview} 
                        alt="Watermark Overlay" 
                        style={{
                          width: '120px',
                          opacity: watermarkOpacity,
                          transform: `rotate(${watermarkRotation}deg)`
                        }} 
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500">
                  <Stamp className="w-10 h-10 mb-2 mx-auto" />
                  <p className="text-xs text-slate-400">Pilih dokumen PDF untuk melihat simulasi watermark.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {/* --- 4. EDIT PDF SUITE --- */}
        {mainTool === 'edit' && (
          <div className="flex-1 flex gap-5">
            <aside className="w-[360px] bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-4 shadow-xl backdrop-blur-xl flex-shrink-0 overflow-y-auto">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" /> Tambah Catatan / Teks ke PDF
              </h3>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-slate-600 rounded-xl p-3 text-center cursor-pointer bg-slate-800/40 hover:bg-slate-800/70"
              >
                <p className="text-xs text-indigo-300 font-medium truncate">{file ? file.name : 'Pilih File PDF Target'}</p>
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />

              {/* Annotation Input Options */}
              <div className="space-y-3 bg-slate-900/40 p-3 rounded-xl border border-slate-700/40 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Target Halaman</label>
                  <select 
                    value={selectedPageIndex} 
                    onChange={(e) => setSelectedPageIndex(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                  >
                    {Array.from({ length: totalPages }, (_, i) => (
                      <option key={i} value={i}>Halaman {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Isi Teks / Catatan</label>
                  <input type="text" value={annotationInput} onChange={(e) => setAnnotationInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Ukuran Font</label>
                    <input type="number" min="10" max="72" value={annotationFontSize} onChange={(e) => setAnnotationFontSize(parseInt(e.target.value) || 16)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-center" />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Warna</label>
                    <input type="color" value={annotationColor} onChange={(e) => setAnnotationColor(e.target.value)} className="w-full h-7 bg-slate-950 border border-slate-700 rounded-lg cursor-pointer" />
                  </div>
                </div>

                <button 
                  onClick={handleAddAnnotation}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-1.5 rounded-lg flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambahkan Teks ke Halaman</span>
                </button>
              </div>

              {/* List of Annotations */}
              <div className="flex-1 bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 flex flex-col gap-2 overflow-y-auto">
                <span className="text-[11px] font-semibold text-slate-400">Daftar Catatan ({annotations.length})</span>
                {annotations.map(ann => (
                  <div key={ann.id} className="bg-slate-950 p-2 rounded border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-slate-200 truncate max-w-[200px]" style={{ color: ann.color }}>{ann.text}</p>
                      <p className="text-[10px] text-slate-500">Hal {ann.pageIndex + 1} • {ann.fontSize}px</p>
                    </div>
                    <button onClick={() => handleRemoveAnnotation(ann.id)} className="text-red-400 hover:text-red-300 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button 
                disabled={!file || annotations.length === 0 || loading}
                onClick={handleExecuteEditPdf}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg shadow-md transition flex items-center justify-center gap-2 text-xs"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Simpan File Hasil Edit</span>
              </button>
            </aside>

            {/* Editor Canvas Area */}
            <section className="flex-1 bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-5 flex flex-col items-center justify-center shadow-xl backdrop-blur-xl relative overflow-hidden">
              <h4 className="absolute top-4 left-5 text-xs font-semibold text-slate-300">Kanvas Edit Teks Halaman {selectedPageIndex + 1}:</h4>
              {thumbnails.length > selectedPageIndex ? (
                <div className="relative border border-slate-700 rounded-lg overflow-hidden max-w-sm shadow-2xl bg-white">
                  <img src={thumbnails[selectedPageIndex].dataUrl} alt="Visual Edit" className="w-full object-contain" />
                  {annotations.filter(a => a.pageIndex === selectedPageIndex).map(ann => (
                    <div 
                      key={ann.id}
                      style={{
                        position: 'absolute',
                        left: `${ann.xPercent}%`,
                        top: `${ann.yPercent}%`,
                        color: ann.color,
                        fontSize: `${ann.fontSize * 0.5}px`,
                        fontWeight: 'bold',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(0,0,0,0.4)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      {ann.text}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-500">
                  <Edit3 className="w-10 h-10 mb-2 mx-auto" />
                  <p className="text-xs text-slate-400">Pilih dokumen PDF untuk menambahkan teks/catatan.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {/* --- 5. PDF TO EXCEL SUITE --- */}
        {mainTool === 'excel' && (
          <div className="flex-1 flex gap-5">
            <aside className="w-[340px] bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-4 shadow-xl backdrop-blur-xl flex-shrink-0">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-400" /> PDF ke Spreadsheet Excel
              </h3>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-slate-600 rounded-xl p-4 text-center cursor-pointer bg-slate-800/40 hover:bg-slate-800/70"
              >
                <p className="text-xs text-indigo-300 font-medium truncate">{file ? file.name : 'Pilih File PDF Berisi Tabel'}</p>
                <p className="text-[11px] text-slate-400 mt-1">Ekstrak struktur tabel ke file Excel (.xlsx)</p>
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />

              <button 
                disabled={!file || loading}
                onClick={handleExtractPdfToExcel}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg shadow-md transition flex items-center justify-center gap-2 text-xs"
              >
                {isExtractingExcel ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Ekstrak Data Tabel ke Grid</span>
              </button>

              {excelData.length > 0 && (
                <button 
                  onClick={handleExportExcelFile}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg shadow-md transition flex items-center justify-center gap-2 text-xs mt-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh File Excel (.xlsx)</span>
                </button>
              )}
            </aside>

            {/* Table Preview Grid */}
            <section className="flex-1 bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-5 flex flex-col gap-3 overflow-hidden shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300">Hasil Ekstraksi Grid Excel ({excelData.length} Baris):</h4>
                {excelData.length > 0 && (
                  <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30 font-medium">
                    Siap Diunduh (.xlsx)
                  </span>
                )}
              </div>

              {excelData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <FileSpreadsheet className="w-12 h-12 text-slate-600 mb-2" />
                  <p className="text-xs font-medium text-slate-300">Belum Ada Data Diekstrak</p>
                  <p className="text-[11px] text-slate-500 mt-1">Pilih PDF lalu klik "Ekstrak Data Tabel ke Grid".</p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto border border-slate-700/60 rounded-xl bg-slate-950">
                  <table className="w-full text-left text-xs text-slate-300 border-collapse">
                    <tbody>
                      {excelData.map((row, rIdx) => (
                        <tr key={rIdx} className={rIdx === 0 ? "bg-slate-900 font-semibold text-indigo-300 border-b border-slate-800" : "border-b border-slate-900 hover:bg-slate-900/50"}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-2 border-r border-slate-900 min-w-[120px] truncate">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Password Prompt Modal Dialog */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleModalPasswordSubmit} className="bg-[#2B2B36] border border-slate-700/80 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/30">
              <Key className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">PDF Dilindungi Kata Sandi</h3>
              <p className="text-xs text-slate-400 mt-1">Dokumen memerlukan kata sandi untuk dibuka.</p>
            </div>
            {modalError && <div className="w-full text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">{modalError}</div>}
            <div className="w-full space-y-1 text-left">
              <label className="text-[11px] text-slate-300 font-medium">Kata Sandi PDF</label>
              <input type="password" value={modalPasswordInput} onChange={(e) => setModalPasswordInput(e.target.value)} placeholder="Masukkan kata sandi..." autoFocus className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
            </div>
            <div className="flex gap-2.5 w-full mt-1">
              <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-lg text-xs">Batal</button>
              <button type="submit" className="flex-1 bg-indigo-600 text-white font-semibold py-2 rounded-lg text-xs">Buka PDF</button>
            </div>
          </form>
        </div>
      )}

      {/* About Modal Dialog */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#2B2B36] border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-center flex flex-col items-center gap-4">
            <button onClick={() => setShowAbout(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700/50">
              <X className="w-4 h-4" />
            </button>
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Split className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">BagiPDF Suite</h3>
              <p className="text-xs text-slate-400 mt-1">Versi 2.1.0 • Rust & Tauri Engine</p>
            </div>
            <div className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-300 space-y-2.5 text-left">
              <div className="flex items-center gap-2.5"><User className="w-4 h-4 text-indigo-400" /><span>Pengembang: <strong>Franky Setiawan</strong></span></div>
              <div className="flex items-center gap-2.5"><Globe className="w-4 h-4 text-indigo-400" /><span>Website: <a href="https://www.frm.web.id" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline font-medium">https://www.frm.web.id</a></span></div>
            </div>
            <p className="text-[11px] text-slate-400">Aplikasi pengelolaan PDF lengkap (Split, Merge, Watermark, Edit, PDF to Excel) mandiri & offline.</p>
            <button onClick={() => setShowAbout(false)} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-2 rounded-lg text-xs">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
