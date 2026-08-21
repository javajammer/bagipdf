import React, { useState, useRef } from 'react';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';
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
  Unlock,
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
  Move,
  ShieldCheck,
  Folder,
  FolderOpen,
  Play,
  StopCircle,
  CheckCircle2,
  AlertCircle,
  Search,
  FileText,
  FileUp,
  Loader2,
  Copy
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

interface BatchPdfItem {
  id: string;
  file: File;
  relativePath?: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  pageCount?: number;
  rowCount?: number;
  errorMsg?: string;
  extractedRows?: string[][];
}

type MainToolMode = 'split' | 'merge' | 'lock' | 'watermark' | 'edit' | 'excel';

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

  // --- IP RESTRICTION STATE ---
  const [isIpAuthorized, setIsIpAuthorized] = useState<boolean | null>(true);
  const [currentPublicIp, setCurrentPublicIp] = useState<string>('');

  // --- EBUPOT LICENSE CHECK ---
  React.useEffect(() => {
    const checkLicense = async () => {
      if (!('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) return;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const [licInfo, mkInfo] = await Promise.all([
          invoke<{ valid: boolean; username: string; expires_at: string; days_remaining: number; message: string }>('check_ebupot_license'),
          invoke<{ raw: string; display: string }>('get_machine_key'),
        ]);
        setEbupotMachineKey(mkInfo);
        setEbupotLicenseInfo(licInfo);
        setEbupotLicenseStatus(licInfo.valid ? 'valid' : 'invalid');
      } catch (e) {
        console.warn('License check error:', e);
        setEbupotLicenseStatus('invalid');
      }
    };
    checkLicense();
  }, []);

  const handleEbupotActivation = async () => {
    if (!ebupotActivationToken.trim() || !ebupotActivationUsername.trim()) {
      setEbupotActivationError('Nama pengguna dan token wajib diisi.');
      return;
    }
    setEbupotActivationLoading(true);
    setEbupotActivationError('');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ valid: boolean; username: string; expires_at: string; days_remaining: number; message: string }>(
        'activate_ebupot_license',
        { token: ebupotActivationToken.trim(), username: ebupotActivationUsername.trim() }
      );
      setEbupotLicenseInfo(result);
      setEbupotLicenseStatus('valid');
      setShowEbupotActivationModal(false);
      setEbupotActivationToken('');
      setEbupotActivationUsername('');
    } catch (e: any) {
      setEbupotActivationError(String(e));
    } finally {
      setEbupotActivationLoading(false);
    }
  };

  // --- SPLIT MODE STATE ---
  const [activeSplitTab, setActiveSplitTab] = useState<'custom' | 'fixed' | 'extract' | 'size'>('custom');
  const [customRanges, setCustomRanges] = useState<string>('1-2, 3-4');
  const [mergeCustom, setMergeCustom] = useState<boolean>(false);
  const [fixedStep, setFixedStep] = useState<number>(1);
  const [extractMode, setExtractMode] = useState<'all' | 'select'>('all');
  const [extractPagesStr, setExtractPagesStr] = useState<string>('1, 3');
  const [mergeExtract, setMergeExtract] = useState<boolean>(true);
  const [targetMB, setTargetMB] = useState<number>(2);

  // --- LOCK & UNLOCK MODE STATE ---
  const [lockSubMode, setLockSubMode] = useState<'lock' | 'unlock'>('lock');

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
  const [excelBatchItems, setExcelBatchItems] = useState<BatchPdfItem[]>([]);
  const [excelExtractionType, setExcelExtractionType] = useState<'ebupot' | 'generic'>('ebupot');
  const [excelOutputMode, setExcelOutputMode] = useState<'consolidated' | 'zip'>('consolidated');
  const [sanitizeFormulas, setSanitizeFormulas] = useState<boolean>(true);
  const [isLoadingFolder, setIsLoadingFolder] = useState<boolean>(false);
  const [ebupotLicenseStatus, setEbupotLicenseStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [ebupotLicenseInfo, setEbupotLicenseInfo] = useState<{ valid: boolean; username: string; expires_at: string; days_remaining: number; message: string } | null>(null);
  const [showEbupotActivationModal, setShowEbupotActivationModal] = useState<boolean>(false);
  const [ebupotActivationToken, setEbupotActivationToken] = useState<string>('');
  const [ebupotActivationUsername, setEbupotActivationUsername] = useState<string>('');
  const [ebupotMachineKey, setEbupotMachineKey] = useState<{ raw: string; display: string }>({ raw: '', display: '' });
  const [ebupotActivationLoading, setEbupotActivationLoading] = useState<boolean>(false);
  const [ebupotActivationError, setEbupotActivationError] = useState<string>('');
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentFileName: string; successCount: number; errorCount: number }>({
    current: 0,
    total: 0,
    currentFileName: '',
    successCount: 0,
    errorCount: 0
  });
  const [excelPreviewSearch, setExcelPreviewSearch] = useState<string>('');
  const [excelPreviewPage, setExcelPreviewPage] = useState<number>(1);
  const [activeExcelTab, setActiveExcelTab] = useState<'files' | 'preview'>('files');

  const cancelBatchRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mergeFileInputRef = useRef<HTMLInputElement>(null);
  const watermarkImgInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const batchFilesInputRef = useRef<HTMLInputElement>(null);

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

  // Helper to save PDF bytes with AES-256 password protection via @pdfsmaller/pdf-encrypt-lite
  const saveAndEncryptPdf = async (doc: PDFDocument): Promise<Uint8Array> => {
    const bytes = await doc.save();
    if (pdfPassword && lockOutputWithPassword) {
      try {
        return await encryptPDF(bytes, pdfPassword);
      } catch (e) {
        console.warn('Gagal memproteksi PDF dengan AES-256:', e);
      }
    }
    return bytes;
  };

  // Helper download/save blob function with Native Save File Picker & Toast awareness (Tauri Rust IPC & Web API)
  const downloadBlob = async (bytesOrBlob: Uint8Array | Blob, fileName: string, mimeType = 'application/pdf') => {
    try {
      let uint8Data: Uint8Array;
      let blob: Blob;

      if (bytesOrBlob instanceof Blob) {
        blob = bytesOrBlob;
        const ab = await bytesOrBlob.arrayBuffer();
        uint8Data = new Uint8Array(ab);
      } else {
        uint8Data = bytesOrBlob;
        const cleanArray = new Uint8Array(bytesOrBlob.length);
        cleanArray.set(bytesOrBlob);
        blob = new Blob([cleanArray.buffer], { type: mimeType });
      }

      // 1. Check if running inside Tauri Desktop app & invoke native Rust file dialog
      if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const savedPath = await invoke<string | null>('save_file_dialog', {
            defaultName: fileName,
            contents: Array.from(uint8Data)
          });

          if (savedPath) {
            showToastNotification(
              'File Berhasil Disimpan!',
              `Dokumen telah disimpan di: ${savedPath}`
            );
          }
          return;
        } catch (tauriErr) {
          console.warn('Tauri native save dialog fallback:', tauriErr);
        }
      }

      // 2. Try Web Native Save File Picker (opens browser Save As dialog to choose folder & filename)
      if ('showSaveFilePicker' in window) {
        try {
          const extension = fileName.substring(fileName.lastIndexOf('.'));
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: mimeType === 'application/zip' ? 'ZIP Archive' : (mimeType.includes('spreadsheet') ? 'Excel Spreadsheet' : 'PDF Document'),
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
          if (pickerErr?.name === 'AbortError') {
            return; // User cancelled Save As dialog
          }
          console.warn('showSaveFilePicker error, falling back to download:', pickerErr);
        }
      }

      // 3. Fallback: Standard browser download trigger
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
          const pdfBytes = await saveAndEncryptPdf(newPdf);
          await downloadBlob(pdfBytes, `${baseName}_custom_merged.pdf`);
          setLoading(false);
          return;
        } else {
          for (let idx = 0; idx < ranges.length; idx++) {
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, ranges[idx]);
            copiedPages.forEach(p => newPdf.addPage(p));
            const pdfBytes = await saveAndEncryptPdf(newPdf);
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
          const pdfBytes = await saveAndEncryptPdf(newPdf);
          generatedFiles.push({ name: `${baseName}_part_${part}.pdf`, bytes: pdfBytes });
          part++;
        }
      } else if (activeSplitTab === 'extract') {
        if (extractMode === 'all') {
          for (let i = 0; i < totalPages; i++) {
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, [i]);
            copiedPages.forEach(p => newPdf.addPage(p));
            const pdfBytes = await saveAndEncryptPdf(newPdf);
            generatedFiles.push({ name: `${baseName}_page_${i + 1}.pdf`, bytes: pdfBytes });
          }
        } else {
          const ranges = parseRanges(extractPagesStr, totalPages);
          const flatIndices = ranges.flat();

          if (mergeExtract) {
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, flatIndices);
            copiedPages.forEach(p => newPdf.addPage(p));
            const pdfBytes = await saveAndEncryptPdf(newPdf);
            await downloadBlob(pdfBytes, `${baseName}_extracted.pdf`);
            setLoading(false);
            return;
          } else {
            for (const idx of flatIndices) {
              const newPdf = await PDFDocument.create();
              const copiedPages = await newPdf.copyPages(pdfDoc, [idx]);
              copiedPages.forEach(p => newPdf.addPage(p));
              const pdfBytes = await saveAndEncryptPdf(newPdf);
              generatedFiles.push({ name: `${baseName}_page_${idx + 1}.pdf`, bytes: pdfBytes });
            }
          }
        }
      } else if (activeSplitTab === 'size') {
        // High performance O(N) estimation based on total PDF bytes
        const totalDocBytes = (await pdfDoc.save()).byteLength;
        const avgPageBytes = Math.max(1024, totalDocBytes / totalPages);
        const targetBytes = Math.max(100 * 1024, targetMB * 1024 * 1024);
        const pagesPerChunk = Math.max(1, Math.floor(targetBytes / avgPageBytes));

        let part = 1;
        for (let i = 0; i < totalPages; i += pagesPerChunk) {
          const chunkIndices = Array.from({ length: Math.min(pagesPerChunk, totalPages - i) }, (_, k) => i + k);
          const chunkPdf = await PDFDocument.create();
          const copiedPages = await chunkPdf.copyPages(pdfDoc, chunkIndices);
          copiedPages.forEach(p => chunkPdf.addPage(p));
          
          const chunkBytes = await saveAndEncryptPdf(chunkPdf);
          generatedFiles.push({ name: `${baseName}_size_part_${part}.pdf`, bytes: chunkBytes });
          part++;
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
        const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
        const pageIndices = srcDoc.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(srcDoc, pageIndices);
        copiedPages.forEach(p => mergedPdf.addPage(p));
      }

      const mergedBytes = await saveAndEncryptPdf(mergedPdf);
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

      const wmBytes = await saveAndEncryptPdf(doc);
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

      const editedBytes = await saveAndEncryptPdf(doc);
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      await downloadBlob(editedBytes, `${baseName}_edited.pdf`);
    } catch (err: any) {
      alert('Gagal menyimpan hasil edit PDF: ' + err.message);
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  // --- PDF TO EXCEL LOGIC & BATCH ENGINE ---
  // Neutralize dangerous characters starting Excel cells (=, +, -, @, \t, \r) for OWASP / Whitelist security compliance
  const sanitizeExcelCell = (val: string): string => {
    if (!val) return '';
    const trimmed = val.trim();
    if (/^[\=\+\-\@\t\r]/.test(trimmed)) {
      return "'" + trimmed;
    }
    return trimmed;
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsLoadingFolder(true);
    setTimeout(() => {
      try {
        const allFiles = Array.from(e.target.files || []);
        // Sort files in reverse order (Terakhir ke Terawal)
        const pdfFiles = allFiles
          .filter(f => f.name.toLowerCase().endsWith('.pdf'))
          .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }));

        if (pdfFiles.length === 0) {
          showToastNotification('Tidak Ada File PDF', 'Tidak ditemukan file berformat .pdf di dalam folder tersebut.', 'error');
          setIsLoadingFolder(false);
          return;
        }

        let filesToUse = pdfFiles;
        if (pdfFiles.length > 2000) {
          showToastNotification(
            'Batas Maksimal 2000 File',
            `Terdeteksi ${pdfFiles.length} file PDF. 2000 file pertama dipilih untuk kestabilan & performa aplikasi.`,
            'info'
          );
          filesToUse = pdfFiles.slice(0, 2000);
        } else {
          showToastNotification(
            'Folder Berhasil Dimuat',
            `Ditemukan ${pdfFiles.length} file PDF di dalam folder (diurutkan dari file terakhir ke terawal).`,
            'success'
          );
        }

        const items: BatchPdfItem[] = filesToUse.map(f => ({
          id: Math.random().toString(36).substring(2, 9),
          file: f,
          relativePath: f.webkitRelativePath || f.name,
          status: 'pending'
        }));

        setExcelBatchItems(items);
        setExcelData([]);
        setExcelPreviewPage(1);
        setBatchProgress({ current: 0, total: items.length, currentFileName: '', successCount: 0, errorCount: 0 });
      } catch (err) {
        console.error('Error reading folder:', err);
      } finally {
        setIsLoadingFolder(false);
        e.target.value = '';
      }
    }, 150);
  };

  const handleBatchFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const pdfFiles = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      showToastNotification('Pilih File PDF', 'Harap pilih file berformat .pdf!', 'error');
      return;
    }

    let filesToUse = pdfFiles;
    if (pdfFiles.length > 2000) {
      showToastNotification(
        'Batas Maksimal 2000 File',
        `Terdeteksi ${pdfFiles.length} file PDF. 2000 file pertama dipilih.`,
        'info'
      );
      filesToUse = pdfFiles.slice(0, 2000);
    }

    const items: BatchPdfItem[] = filesToUse.map(f => ({
      id: Math.random().toString(36).substring(2, 9),
      file: f,
      relativePath: f.name,
      status: 'pending'
    }));

    let updatedItems: BatchPdfItem[] = [];
    setExcelBatchItems(prev => {
      const combined = [...prev, ...items];
      if (combined.length > 2000) {
        showToastNotification('Batas Maksimal 2000 File', 'Jumlah file dibatasi 2000 file PDF.', 'info');
        updatedItems = combined.slice(0, 2000);
      } else {
        updatedItems = combined;
      }
      return updatedItems;
    });
    e.target.value = '';
  };

  const parseEbupotPdfDocument = async (pdfJsDoc: any, fileName: string): Promise<string[]> => {
    const page = await pdfJsDoc.getPage(1);
    const textContent = await page.getTextContent();
    
    // Explicitly release page resources to prevent memory leaks on low-RAM machines
    try { page.cleanup(); } catch (e) {}

    const items = textContent.items as any[];
    const fullText = items.map((it: any) => it.str).join(' ');

    const extractMatch = (regex: RegExp, defaultVal: string = ''): string => {
      const match = fullText.match(regex);
      return match ? match[1].trim() : defaultVal;
    };

    const headerMatch = fullText.match(/([A-Z0-9]{8,12})\s+(\d{2}-\d{4})\s+(TIDAK FINAL|FINAL)\s+(NORMAL|PEMBETULAN)/i);
    const nomorDokumen = headerMatch ? headerMatch[1] : extractMatch(/([A-Z0-9]{9})/);
    const masaPajak = headerMatch ? headerMatch[2] : extractMatch(/(\d{2}-\d{4})/);
    const statusBukti = headerMatch ? headerMatch[4] : (fullText.includes('PEMBETULAN') ? 'PEMBETULAN' : 'NORMAL');

    const npwpNik = extractMatch(/A\.1\s+NPWP\s*\/\s*NIK\s*:\s*(\d{15,16})/i);
    const nama = extractMatch(/A\.2\s+NAMA\s*:\s*(.+?)\s+A\.3/i);
    const jenisFasilitas = extractMatch(/B\.1\s+Jenis Fasilitas\s*:\s*(.+?)\s+B\.2/i, 'Tanpa Fasilitas');
    const jenisPPh = extractMatch(/B\.2\s+Jenis PPh\s*:\s*(.+?)\s+KODE/i, 'Pasal 23');

    const tableMatch = fullText.match(/(\d{2}-\d{3}-\d{2})\s+(.+?)\s+([\d\.]+)\s+([\d,]+%?)\s+([\d\.]+)\s+B\.8/i);
    const kodeObjekPajak = tableMatch ? tableMatch[1] : extractMatch(/(\d{2}-\d{3}-\d{2})/);
    const objekPajak = tableMatch ? tableMatch[2] : '';
    const dpp = tableMatch ? tableMatch[3] : '';
    let tarif = tableMatch ? tableMatch[4] : '';
    if (tarif && !tarif.includes('%')) tarif = `${tarif},00%`;
    const pph = tableMatch ? tableMatch[5] : '';

    const docMatch = fullText.match(/Jenis Dokumen\s*:\s*(.+?)\s+Tanggal\s*:\s*(.+?)\s+B\.9/i);
    const jenisDokumenDasar = docMatch ? `${docMatch[1].trim()} , Tanggal : ${docMatch[2].trim()}` : '';

    const noDokumenDasar = extractMatch(/B\.9\s+Nomor Dokumen\s*:\s*(.+?)\s+B\.10/i);
    const npwpPemotong = extractMatch(/C\.1\s+NPWP\s*\/\s*NIK\s*:\s*(\d{15,16})/i);
    const nitkuPemotong = extractMatch(/C\.2\s+NOMOR IDENTITAS TEMPAT KEGIATAN\s+USAHA\s*\(NITKU\)\s*\/\s*SUBUNIT ORGANISASI\s*:\s*(.+?)\s+C\.3/i);
    const namaPemotong = extractMatch(/C\.3\s+NAMA PEMOTONG[^\n:]*:\s*(.+?)\s+C\.4/i);
    const tanggalPemotong = extractMatch(/C\.4\s+TANGGAL\s*:\s*(.+?)\s+C\.5/i);

    const clean = (val: string) => sanitizeFormulas ? sanitizeExcelCell(val) : val.trim();

    return [
      clean(nomorDokumen),
      clean(masaPajak),
      clean(npwpNik),
      clean(nama),
      clean(statusBukti),
      clean(jenisFasilitas),
      clean(jenisPPh),
      clean(kodeObjekPajak),
      clean(objekPajak),
      clean(dpp),
      clean(tarif),
      clean(pph),
      clean(jenisDokumenDasar),
      clean(noDokumenDasar),
      clean(npwpPemotong),
      clean(namaPemotong),
      clean(nitkuPemotong),
      clean(tanggalPemotong),
      clean(fileName)
    ];
  };

  const startBatchPdfToExcelExecution = async (itemsToProcess?: BatchPdfItem[]) => {
    const items = itemsToProcess || excelBatchItems;
    if (items.length === 0) {
      alert('Harap pilih folder atau file PDF terlebih dahulu!');
      return;
    }

    setIsExtractingExcel(true);
    setLoading(true);
    cancelBatchRef.current = false;

    let successCount = 0;
    let errorCount = 0;
    const total = items.length;

    const consolidatedRows: string[][] = [];

    if (excelExtractionType === 'ebupot') {
      consolidatedRows.push([
        'No',
        'Nomor Dokumen',
        'Masa Pajak',
        'NPWP/NIK',
        'Nama',
        'Status Bukti',
        'Jenis Fasilitas',
        'Jenis PPh',
        'Kode Objek Pajak',
        'Objek Pajak',
        'DPP (Rp)',
        'Tarif (%)',
        'Pajak Penghasilan (Rp)',
        'Jenis Dokumen Dasar',
        'Nomor Dokumen Dasar',
        'NPWP/NIK Pemotong',
        'Nama Pemotong',
        'NITKU / Subunit Organisasi Pemotong',
        'Tanggal',
        'File Name'
      ]);
    } else {
      consolidatedRows.push(['Nama File PDF', 'Halaman', 'Kolom 1 / Konten Teks', 'Position Y', 'Position X']);
    }

    const updatedBatchItems = [...items];

    for (let idx = 0; idx < total; idx++) {
      if (cancelBatchRef.current) {
        showToastNotification('Proses Dihentikan', 'Konversi batch PDF ke Excel dihentikan oleh pengguna.', 'info');
        break;
      }

      const item = updatedBatchItems[idx];
      item.status = 'processing';
      
      // Throttle UI Updates to prevent React from freezing on low-end CPUs (e.g. 2 cores, 4GB RAM)
      if (idx % 10 === 0 || idx === total - 1) {
        setExcelBatchItems([...updatedBatchItems]);
        setBatchProgress({
          current: idx + 1,
          total,
          currentFileName: item.file.name,
          successCount,
          errorCount
        });
      }

      try {
        const arrayBuffer = await item.file.arrayBuffer();
        const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer, password: pdfPassword }).promise;
        const pageCount = pdfJsDoc.numPages;

        const fileRows: string[][] = [];

        if (excelExtractionType === 'ebupot') {
          const ebupotRow = await parseEbupotPdfDocument(pdfJsDoc, item.file.name);
          const fullRowWithNo = [String(successCount + 1), ...ebupotRow];
          fileRows.push(fullRowWithNo);
          consolidatedRows.push(fullRowWithNo);
        } else {
          for (let p = 1; p <= pageCount; p++) {
            const page = await pdfJsDoc.getPage(p);
            const textContent = await page.getTextContent();
            
            // Explicitly release memory immediately for large generic PDFs
            try { page.cleanup(); } catch (e) {}

            const items = textContent.items as any[];
            const lineMap: { [y: number]: any[] } = {};

            for (const it of items) {
              if (!it.str || !it.str.trim()) continue;
              const y = Math.round(it.transform[5] / 10) * 10;
              if (!lineMap[y]) lineMap[y] = [];
              lineMap[y].push(it);
            }

            const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);

            for (const y of sortedYs) {
              const rowItems = lineMap[y];
              rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
              const rowValues = rowItems.map(it => {
                const str = it.str.trim();
                return sanitizeFormulas ? sanitizeExcelCell(str) : str;
              });

              const rowData = [item.file.name, `Halaman ${p}`, ...rowValues];
              fileRows.push(rowData);
              consolidatedRows.push(rowData);
            }
          }
        }

        try {
          pdfJsDoc.destroy();
        } catch (e) {}

        item.status = 'success';
        item.pageCount = pageCount;
        
        // Prevent storing massive data in React State if we are in consolidated mode to save RAM
        if (excelOutputMode === 'zip') {
          item.extractedRows = fileRows;
        }
        item.rowCount = fileRows.length;
        successCount++;

      } catch (err: any) {
        console.warn(`Gagal memproses file ${item.file.name}:`, err);
        item.status = 'error';
        item.errorMsg = err?.message || 'Gagal membaca PDF';
        errorCount++;
      }

      // Force Garbage Collection Yield & Event Loop Breathing Room
      if (idx % 25 === 0) {
        // Sleep for 20ms to allow DOM repaints and memory GC on low-end CPUs
        await new Promise(resolve => setTimeout(resolve, 20));
      } else if (idx % 5 === 0 || idx === total - 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    setExcelData(consolidatedRows);
    setIsExtractingExcel(false);
    setLoading(false);

    if (!cancelBatchRef.current) {
      showToastNotification(
        'Konversi Batch Selesai!',
        `Berhasil memproses ${successCount} dari ${total} file PDF ke Excel (${excelExtractionType === 'ebupot' ? 'Format Ebupot Unifikasi 21/26' : 'Format Generik'}).`,
        'success'
      );
    }
  };

  const handleExportBatchExcel = async () => {
    if (excelBatchItems.length === 0) {
      alert('Tidak ada file batch untuk diunduh!');
      return;
    }

    const processedItems = excelBatchItems.filter(i => i.status === 'success');
    if (processedItems.length === 0) {
      alert('Belum ada file PDF yang berhasil dikonversi ke Excel!');
      return;
    }

    setLoading(true);
    setStatusMsg('Menyiapkan file Excel...');

    try {
      if (excelOutputMode === 'consolidated') {
        if (excelData.length <= 1) {
          alert('Belum ada data tabel yang diekstrak!');
          setLoading(false);
          return;
        }

        const ws = XLSX.utils.aoa_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Konsolidasi PDF');
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        
        await downloadBlob(
          new Uint8Array(excelBuffer),
          `BagiPDF_Batch_${processedItems.length}_Files_Konsolidasi.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      } else {
        const zip = new JSZip();

        for (const item of processedItems) {
          if (!item.extractedRows || item.extractedRows.length === 0) continue;
          
          const zipHeader = excelExtractionType === 'ebupot' 
            ? ['No', 'Nomor Dokumen', 'Masa Pajak', 'NPWP/NIK', 'Nama', 'Status Bukti', 'Jenis Fasilitas', 'Jenis PPh', 'Kode Objek Pajak', 'Objek Pajak', 'DPP (Rp)', 'Tarif (%)', 'Pajak Penghasilan (Rp)', 'Jenis Dokumen Dasar', 'Nomor Dokumen Dasar', 'NPWP/NIK Pemotong', 'Nama Pemotong', 'NITKU / Subunit Organisasi Pemotong', 'Tanggal', 'File Name']
            : ['Halaman', 'Kolom 1 / Konten Teks', 'Position Y', 'Position X'];

          const fileData: string[][] = [
            zipHeader,
            ...item.extractedRows
          ];

          const ws = XLSX.utils.aoa_to_sheet(fileData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Tabel PDF');
          const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

          const baseName = item.file.name.replace(/\.[^/.]+$/, '');
          zip.file(`${baseName}_excel.xlsx`, new Uint8Array(excelBuffer));
        }

        const zipBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
        await downloadBlob(
          zipBlob,
          `BagiPDF_Batch_${processedItems.length}_Files_Excel.zip`,
          'application/zip'
        );
      }
    } catch (err: any) {
      alert('Gagal mengekspor file Excel: ' + err.message);
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const handleCancelBatch = () => {
    cancelBatchRef.current = true;
  };

  const handleClearBatch = () => {
    if (isExtractingExcel) return;
    setExcelBatchItems([]);
    setExcelData([]);
    setBatchProgress({ current: 0, total: 0, currentFileName: '', successCount: 0, errorCount: 0 });
  };

  const handleRemoveBatchItem = (id: string) => {
    if (isExtractingExcel) return;
    setExcelBatchItems(prev => {
      const newItems = prev.filter(item => item.id !== id);
      setBatchProgress(p => ({ ...p, total: newItems.length }));
      return newItems;
    });
  };

  // Memoized Preview Filtering & Pagination for light DOM rendering up to 2000 files
  const filteredPreviewRows = React.useMemo(() => {
    if (!excelData || excelData.length === 0) return [];
    const header = excelData[0];
    const dataRows = excelData.slice(1);
    
    if (!excelPreviewSearch.trim()) return excelData;

    const term = excelPreviewSearch.toLowerCase();
    const matched = dataRows.filter(row => 
      row.some(cell => String(cell).toLowerCase().includes(term))
    );
    return [header, ...matched];
  }, [excelData, excelPreviewSearch]);

  const ROWS_PER_PAGE = 50;
  const totalPreviewPages = Math.max(1, Math.ceil((filteredPreviewRows.length > 1 ? filteredPreviewRows.length - 1 : 0) / ROWS_PER_PAGE));

  const paginatedPreviewRows = React.useMemo(() => {
    if (filteredPreviewRows.length <= 1) return filteredPreviewRows;
    const header = filteredPreviewRows[0];
    const dataRows = filteredPreviewRows.slice(1);
    const startIdx = (excelPreviewPage - 1) * ROWS_PER_PAGE;
    const pageData = dataRows.slice(startIdx, startIdx + ROWS_PER_PAGE);
    return [header, ...pageData];
  }, [filteredPreviewRows, excelPreviewPage]);

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

  // --- DEDICATED LOCK & UNLOCK PDF LOGIC ---
  const handleExecuteDedicatedLock = async () => {
    if (!file) {
      alert('Harap pilih file PDF terlebih dahulu!');
      return;
    }
    if (!pdfPassword || !pdfPassword.trim()) {
      alert('Harap masukkan kata sandi PDF!');
      return;
    }

    setLoading(true);
    const baseName = file.name.replace(/\.[^/.]+$/, '');

    if (lockSubMode === 'lock') {
      setStatusMsg('Mengunci & Mengenkripsi Dokumen PDF...');
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfBytes = new Uint8Array(arrayBuffer);
        const lockedBytes = await encryptPDF(pdfBytes, pdfPassword);
        await downloadBlob(lockedBytes, `${baseName}_protected.pdf`);
      } catch (err: any) {
        alert('Gagal mengunci file PDF: ' + err.message);
      } finally {
        setLoading(false);
        setStatusMsg('');
      }
    } else {
      // UNLOCK MODE: Coba decrypt PDF menggunakan pdfjsLib dengan password yang di-input
      setStatusMsg('Memverifikasi Password & Buka Kunci PDF...');
      try {
        const arrayBuffer = await file.arrayBuffer();
        
        // 1. Verifikasi password asli terlebih dahulu dengan pdfjsLib
        const pdfJsBytes = new Uint8Array(arrayBuffer.slice(0));
        const loadingTask = pdfjsLib.getDocument({
          data: pdfJsBytes,
          password: pdfPassword.trim(),
        });

        const verifiedPdf = await loadingTask.promise;
        const totalPagesToUnlock = verifiedPdf.numPages;

        // 2. Render setiap halaman menggunakan PDF.js canvas dan gabungkan ke PDFDocument baru (bebas enkripsi & 100% utuh)
        const unlockedPdfDoc = await PDFDocument.create();

        for (let i = 1; i <= totalPagesToUnlock; i++) {
          setStatusMsg(`Membuka kunci halaman ${i} dari ${totalPagesToUnlock}...`);
          const page = await verifiedPdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); // High resolution 2x
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            const imgDataUrl = canvas.toDataURL('image/png', 1.0);
            const pngImage = await unlockedPdfDoc.embedPng(imgDataUrl);

            // Buat halaman PDF baru dengan ukuran viewport asli
            const newPage = unlockedPdfDoc.addPage([viewport.width / 2.0, viewport.height / 2.0]);
            newPage.drawImage(pngImage, {
              x: 0,
              y: 0,
              width: viewport.width / 2.0,
              height: viewport.height / 2.0,
            });
          }
        }

        const unlockedBytes = await unlockedPdfDoc.save();
        await downloadBlob(unlockedBytes, `${baseName}_unlocked.pdf`);
      } catch (err: any) {
        if (err.name === 'PasswordException' || err.message?.toLowerCase().includes('password')) {
          alert('❌ Kata sandi salah! Penguncian tidak dapat dibuka kecuali kata sandi aslinya cocok.');
        } else {
          alert('❌ Gagal membuka kunci PDF: ' + (err.message || 'Password tidak cocok atau file terkorupsi.'));
        }
      } finally {
        setLoading(false);
        setStatusMsg('');
      }
    }
  };

  // IP Access Control Restriction Block
  if (isIpAuthorized === false) {
    return (
      <div className="min-h-screen bg-[#121216] text-slate-200 flex flex-col items-center justify-center p-6 font-sans select-none antialiased">
        <div className="max-w-md w-full bg-[#1E1E28] border border-red-500/40 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-xl flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Akses Ditolak (Access Denied)</h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Aplikasi ini dikonfigurasi dengan batasan keamanan ketat dan <strong>HANYA dapat diakses</strong> melalui jaringan IP Publik yang diizinkan.
            </p>
          </div>
          <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-left text-xs font-mono space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>IP Diizinkan:</span>
              <span className="text-emerald-400 font-semibold">182.253.235.144</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>IP Publik Anda:</span>
              <span className="text-red-400 font-semibold">{currentPublicIp || 'Tidak Terdeteksi / Offline'}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Silakan hubungkan perangkat Anda ke jaringan IP Publik yang berwenang untuk menggunakan BagiPDF.
          </p>
        </div>
      </div>
    );
  }

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
              onClick={() => setMainTool('lock')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition ${mainTool === 'lock' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock & Unlock</span>
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
              {mainTool !== 'split' && (
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
              )}

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

        {/* --- DEDICATED LOCK & UNLOCK PDF SUITE --- */}
        {mainTool === 'lock' && (
          <div className="flex-1 flex gap-5">
            <aside className="w-[360px] bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-4 shadow-xl backdrop-blur-xl flex-shrink-0 overflow-y-auto">
              <div className="flex items-center gap-2 border-b border-slate-700/50 pb-3">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Lock & Unlock PDF</h3>
                  <p className="text-[11px] text-slate-400">Proteksi Keamanan Dokumen dengan Kata Sandi</p>
                </div>
              </div>

              {/* Mode Toggle Tab: Lock vs Unlock */}
              <div className="flex rounded-lg bg-slate-950/80 p-1 border border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setLockSubMode('lock')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition flex items-center justify-center gap-1.5 ${
                    lockSubMode === 'lock'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Kunci PDF (Lock)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLockSubMode('unlock')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition flex items-center justify-center gap-1.5 ${
                    lockSubMode === 'unlock'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Buka Kunci (Unlock)</span>
                </button>
              </div>

              {/* Upload Input File */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-xl p-4 transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2.5 ${
                  file ? 'border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/15' : 'border-slate-600/60 bg-slate-800/40 hover:bg-slate-800/70 hover:border-slate-500'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow-inner ${
                  file 
                    ? (lockSubMode === 'lock' ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white')
                    : 'bg-slate-700/70 text-slate-300'
                }`}>
                  {lockSubMode === 'lock' ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </div>
                {file ? (
                  <div className="w-full">
                    <p className="font-medium text-xs text-indigo-200 truncate max-w-[260px] mx-auto">{file.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{totalPages} Halaman • {(file.size / (1024*1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-xs text-slate-200">
                      {lockSubMode === 'lock' ? 'Pilih File PDF yang Ingin Dikunci' : 'Pilih File PDF yang Terkunci'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Klik untuk memilih dokumen PDF target</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />

              {/* Password Controls */}
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-3">
                <label className="text-xs font-medium text-slate-300 block">
                  {lockSubMode === 'lock' ? 'Set Kata Sandi Pengunci Dokumen' : 'Masukkan Kata Sandi Asli PDF'}
                </label>
                <div className="relative flex items-center">
                  <input 
                    type={showPdfPassword ? "text" : "password"} 
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    placeholder={lockSubMode === 'lock' ? "Masukkan password pengunci PDF..." : "Masukkan password asli untuk membuka..."}
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-3 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button type="button" onClick={() => setShowPdfPassword(!showPdfPassword)} className="absolute right-2.5 text-slate-400 hover:text-slate-200">
                    {showPdfPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {lockSubMode === 'lock' 
                    ? '🔐 Dokumen akan dienkripsi dengan standar PDF Security. Siapapun yang ingin membuka file PDF harus memasukkan kata sandi ini.'
                    : '🔑 Masukkan kata sandi asli pengunci PDF. Penguncian HANYA dapat dilepas jika kata sandi cocok.'}
                </p>
              </div>

              <button 
                disabled={!file || !pdfPassword.trim() || loading}
                onClick={handleExecuteDedicatedLock}
                className={`w-full mt-auto disabled:opacity-40 text-white font-semibold py-3 rounded-lg shadow-md transition flex items-center justify-center gap-2 text-xs ${
                  lockSubMode === 'lock'
                    ? 'bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
                }`}
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (lockSubMode === 'lock' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />)}
                <span>
                  {lockSubMode === 'lock' ? 'Kunci & Simpan Dokumen PDF' : 'Buka Kunci (Unlock) PDF'}
                </span>
              </button>
            </aside>

            {/* Document Preview Pane */}
            <section className="flex-1 bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-3 shadow-xl backdrop-blur-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Pratinjau Dokumen Target</h3>
                </div>
                <span className="text-xs text-slate-400">{totalPages} Halaman</span>
              </div>

              {thumbnails.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-700/60 rounded-xl bg-slate-900/30 p-8 text-center">
                  <Lock className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-sm font-semibold text-slate-400">Belum ada file PDF yang dipilih</p>
                  <p className="text-xs text-slate-500 mt-1">Pilih file PDF di panel kiri untuk melihat pratinjau sebelum dikunci.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-2">
                  {thumbnails.map((thumb) => (
                    <div key={thumb.pageIndex} className="bg-slate-900 border border-slate-700/60 rounded-lg p-2.5 flex flex-col items-center gap-2 shadow-md hover:border-indigo-500/50 transition">
                      <img src={thumb.dataUrl} alt={`Halaman ${thumb.pageIndex + 1}`} className="w-full h-auto max-h-48 object-contain rounded border border-slate-800" />
                      <span className="text-[11px] font-semibold text-slate-300">Halaman {thumb.pageIndex + 1}</span>
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

        {/* --- 5. PDF TO EXCEL SUITE (UP TO 2000 PDFS / FOLDER SUPPORT) --- */}
        {mainTool === 'excel' && (
          <>
          {/* ── EBUPOT ACTIVATION MODAL ── */}
          {showEbupotActivationModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-[#1E1E28] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-900/60 to-slate-900/60 px-6 py-4 border-b border-slate-700/50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Aktivasi Lisensi Ebupot</h2>
                    <p className="text-[11px] text-slate-400">Fitur ini memerlukan lisensi perangkat resmi</p>
                  </div>
                </div>

                <div className="p-6 flex flex-col gap-4">
                  {/* Machine Key Display */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Machine Key Perangkat Ini
                    </label>
                    <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-700/60 rounded-lg px-3 py-2.5">
                      <code className="text-xs text-emerald-400 font-mono flex-1 tracking-wider">
                        {ebupotMachineKey.display || 'Memuat...'}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(ebupotMachineKey.raw)}
                        className="text-slate-400 hover:text-white transition p-1 rounded hover:bg-slate-700/50 flex-shrink-0"
                        title="Salin Machine Key lengkap"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      📱 Kirim Machine Key di atas ke admin via WhatsApp untuk mendapatkan token aktivasi.
                    </p>
                  </div>

                  {/* Email Input */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Alamat Email Terdaftar
                    </label>
                    <input
                      type="email"
                      value={ebupotActivationUsername}
                      onChange={e => setEbupotActivationUsername(e.target.value)}
                      placeholder="Contoh: santi@gmail.com"
                      className="w-full bg-slate-950/80 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* License Key Input */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      User License Key dari Admin
                    </label>
                    <input
                      type="text"
                      value={ebupotActivationToken}
                      onChange={e => setEbupotActivationToken(e.target.value.toUpperCase())}
                      placeholder="BPDF-XXXX-XXXX-XXXX-XXXX-XXXX"
                      className="w-full bg-slate-950/80 border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 tracking-widest"
                    />
                  </div>

                  {/* Error */}
                  {ebupotActivationError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-[11px] text-red-400">
                      ❌ {ebupotActivationError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setShowEbupotActivationModal(false); setEbupotActivationError(''); }}
                      className="flex-1 py-2 text-xs font-medium text-slate-400 border border-slate-700/60 rounded-lg hover:bg-slate-800/50 transition"
                    >
                      Batalkan
                    </button>
                    <button
                      onClick={handleEbupotActivation}
                      disabled={ebupotActivationLoading}
                      className="flex-1 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      {ebupotActivationLoading ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Memverifikasi...</>
                      ) : (
                        <><Check className="w-3.5 h-3.5" /> Aktifkan Lisensi</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── LICENSE GATE: tampil jika belum berlisensi ── */}
          {ebupotLicenseStatus === 'invalid' && !showEbupotActivationModal && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-sm w-full bg-[#1E1E28] border border-amber-500/30 rounded-2xl p-8 text-center flex flex-col items-center gap-4 shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Lock className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Akses Terbatas</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Fitur <strong className="text-slate-300">PDF to Excel (Ebupot)</strong> memerlukan lisensi perangkat khusus.
                  </p>
                </div>
                {ebupotLicenseInfo && !ebupotLicenseInfo.valid && ebupotLicenseInfo.expires_at && (
                  <div className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[11px] text-amber-400">
                    ⏰ {ebupotLicenseInfo.message}
                  </div>
                )}
                <button
                  onClick={() => setShowEbupotActivationModal(true)}
                  className="w-full py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4" /> Aktifkan Lisensi
                </button>
                <p className="text-[10px] text-slate-500">
                  Hubungi admin untuk mendapatkan token aktivasi.
                </p>
              </div>
            </div>
          )}

          {/* ── MAIN CONTENT: hanya tampil jika berlisensi ── */}
          {(ebupotLicenseStatus === 'valid' || ebupotLicenseStatus === 'checking') && (
          <div className="flex-1 flex gap-5 overflow-hidden">
            {/* Left Sidebar Control Panel */}
            <aside className="w-[360px] bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-4 shadow-xl backdrop-blur-xl flex-shrink-0 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">PDF ke Excel Batch</h3>
                    <p className="text-[11px] text-slate-400">Konversi s/d 2.000 File PDF / Folder</p>
                  </div>
                </div>
                {excelBatchItems.length > 0 && (
                  <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                    {excelBatchItems.length} File
                  </span>
                )}
              </div>

              {/* Selection Options: Read Folder or Select Files */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isExtractingExcel || isLoadingFolder}
                  onClick={async () => {
                    if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) {
                      setIsLoadingFolder(true);
                      try {
                        const { invoke } = await import('@tauri-apps/api/core');
                        const nativeFiles = await invoke<Array<{ name: string; path: string; bytes: number[] }> | null>('select_folder_dialog');
                        
                        if (nativeFiles && nativeFiles.length > 0) {
                          // Sort native files from last to first (Z to A / numeric reverse)
                          const sortedNative = [...nativeFiles].sort((a, b) => 
                            b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' })
                          );

                          const fileObjects = sortedNative.map(nf => {
                            const blob = new Blob([new Uint8Array(nf.bytes)], { type: 'application/pdf' });
                            return new File([blob], nf.name, { type: 'application/pdf' });
                          });

                          let filesToUse = fileObjects;
                          if (fileObjects.length > 2000) {
                            showToastNotification('Batas Maksimal 2000 File', `Terdeteksi ${fileObjects.length} file PDF. 2000 file pertama dipilih.`, 'info');
                            filesToUse = fileObjects.slice(0, 2000);
                          } else {
                            showToastNotification('Folder Berhasil Dimuat', `Ditemukan ${fileObjects.length} file PDF di dalam folder (diurutkan file terakhir ke terawal).`, 'success');
                          }

                          const items: BatchPdfItem[] = filesToUse.map(f => ({
                            id: Math.random().toString(36).substring(2, 9),
                            file: f,
                            relativePath: f.name,
                            status: 'pending'
                          }));

                          setExcelBatchItems(items);
                          setExcelData([]);
                          setExcelPreviewPage(1);
                          setBatchProgress({ current: 0, total: items.length, currentFileName: '', successCount: 0, errorCount: 0 });
                          setIsLoadingFolder(false);
                          return;
                        } else if (nativeFiles && nativeFiles.length === 0) {
                          showToastNotification('Tidak Ada File PDF', 'Tidak ditemukan file berformat .pdf di dalam folder tersebut.', 'error');
                          setIsLoadingFolder(false);
                          return;
                        }
                      } catch (err) {
                        console.warn('Native folder picker fallback:', err);
                      } finally {
                        setIsLoadingFolder(false);
                      }
                    }
                    folderInputRef.current?.click();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 transition group disabled:opacity-50 relative"
                >
                  {isLoadingFolder ? (
                    <>
                      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mb-1" />
                      <span className="text-xs font-semibold text-indigo-300">Memuat Folder...</span>
                      <span className="text-[10px] text-indigo-400">Membaca file PDF...</span>
                    </>
                  ) : (
                    <>
                      <FolderOpen className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition mb-1" />
                      <span className="text-xs font-semibold">📁 Pilih Folder</span>
                      <span className="text-[10px] text-slate-400">Baca seluruh PDF</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isExtractingExcel}
                  onClick={() => batchFilesInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-600 bg-slate-800/40 hover:bg-slate-800/80 text-slate-200 transition group disabled:opacity-50"
                >
                  <FileUp className="w-6 h-6 text-slate-400 group-hover:scale-110 transition mb-1" />
                  <span className="text-xs font-semibold">📄 Pilih File PDF</span>
                  <span className="text-[10px] text-slate-400">Pilih multiple file</span>
                </button>
              </div>

              {/* Execution Action Buttons (Always Visible at Top - No Scroll Needed) */}
              <div className="bg-slate-900/90 border border-indigo-500/40 rounded-xl p-3 shadow-lg space-y-2">
                {isExtractingExcel ? (
                  <button
                    type="button"
                    onClick={handleCancelBatch}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-lg shadow-md transition flex items-center justify-center gap-2 text-xs animate-pulse"
                  >
                    <StopCircle className="w-4 h-4" />
                    <span>Hentikan Proses Batch</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={excelBatchItems.length === 0}
                    onClick={() => startBatchPdfToExcelExecution()}
                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-lg shadow-md transition flex items-center justify-center gap-2 text-xs"
                  >
                    <Play className="w-4 h-4" />
                    <span>Mulai Konversi {excelBatchItems.length > 0 ? `(${excelBatchItems.length} PDF)` : ''}</span>
                  </button>
                )}

                {excelBatchItems.length > 0 && (
                  <button
                    type="button"
                    disabled={isExtractingExcel || excelBatchItems.filter(i => i.status === 'success').length === 0}
                    onClick={handleExportBatchExcel}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-semibold py-2 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Hasil Excel</span>
                  </button>
                )}
              </div>

              {/* Hidden Inputs */}
              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory="true"
                directory="true"
                multiple
                onChange={handleFolderSelect}
                className="hidden"
              />
              <input
                ref={batchFilesInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleBatchFilesSelect}
                className="hidden"
              />

              {/* Output & Security Options */}
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3.5 space-y-3">
                <label className="text-xs font-semibold text-slate-300 block border-b border-slate-800 pb-1.5">
                  Format Output & Keamanan
                </label>

                {/* Extraction Mode Option */}
                <div className="space-y-1.5 pb-2 border-b border-slate-800">
                  <label className="text-[11px] text-slate-400 font-medium block">Tipe Ekstraksi Format:</label>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 bg-indigo-950/40 p-2 rounded-lg border border-indigo-500/30 hover:border-indigo-400 transition">
                      <input
                        type="radio"
                        name="extractionType"
                        checked={excelExtractionType === 'ebupot'}
                        onChange={() => setExcelExtractionType('ebupot')}
                        className="text-indigo-600 focus:ring-0"
                      />
                      <div>
                        <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                          📄 Ebupot Unifikasi 21/26 (DJP)
                        </span>
                        <p className="text-[10px] text-slate-400">Ekstrak 19 kolom terstruktur Bukti Potong DJP (BPPU)</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 bg-slate-950/60 p-2 rounded-lg border border-slate-800 hover:border-indigo-500/40 transition">
                      <input
                        type="radio"
                        name="extractionType"
                        checked={excelExtractionType === 'generic'}
                        onChange={() => setExcelExtractionType('generic')}
                        className="text-indigo-600 focus:ring-0"
                      />
                      <div>
                        <span className="font-medium text-slate-300">Tabel Generik (Semua PDF)</span>
                        <p className="text-[10px] text-slate-400">Ekstrak semua baris & kolom teks berbasis posisi</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Output Mode Option */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-medium block">Mode File Hasil:</label>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 bg-slate-950/60 p-2 rounded-lg border border-slate-800 hover:border-indigo-500/40 transition">
                      <input
                        type="radio"
                        name="excelMode"
                        checked={excelOutputMode === 'consolidated'}
                        onChange={() => setExcelOutputMode('consolidated')}
                        className="text-indigo-600 focus:ring-0"
                      />
                      <div>
                        <span className="font-medium text-indigo-300">1 File Excel Master (.xlsx)</span>
                        <p className="text-[10px] text-slate-400">Semua PDF digabung dalam 1 sheet konsolidasi</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200 bg-slate-950/60 p-2 rounded-lg border border-slate-800 hover:border-indigo-500/40 transition">
                      <input
                        type="radio"
                        name="excelMode"
                        checked={excelOutputMode === 'zip'}
                        onChange={() => setExcelOutputMode('zip')}
                        className="text-indigo-600 focus:ring-0"
                      />
                      <div>
                        <span className="font-medium text-indigo-300">Arsip ZIP Excel (.zip)</span>
                        <p className="text-[10px] text-slate-400">Tiap PDF dibuatkan file .xlsx terpisah dalam ZIP</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Security Whitelist Protection */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sanitizeFormulas}
                      onChange={(e) => setSanitizeFormulas(e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 bg-slate-950 mt-0.5"
                    />
                    <div>
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Proteksi Formula Injection (Safe Guard)
                      </span>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        Menetralkan karakter =, +, -, @ untuk keamanan whitelist & mencegah eksekusi makro otomatis di Excel.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Password Input for Protected PDFs */}
              <div className="bg-slate-900/40 border border-slate-700/40 rounded-xl p-3 flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" /> Kata Sandi PDF (Opsional)
                </label>
                <input
                  type="password"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  placeholder="Jika file PDF terenkripsi..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500"
                />
              </div>
            </aside>

            {/* Right Pane: Realtime Batch Status & Data Preview */}
            <section className="flex-1 bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-5 flex flex-col gap-4 overflow-hidden shadow-xl backdrop-blur-xl">
              {/* Top Bar with Tabs and Realtime Progress */}
              <div className="flex items-center justify-between border-b border-slate-700/50 pb-3 flex-shrink-0">
                <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-lg border border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => setActiveExcelTab('files')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                      activeExcelTab === 'files' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Daftar File Batch ({excelBatchItems.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveExcelTab('preview')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                      activeExcelTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>Pratinjau Grid Excel ({excelData.length > 0 ? excelData.length - 1 : 0} Baris)</span>
                  </button>
                  {excelBatchItems.length > 0 && !isExtractingExcel && (
                    <button
                      type="button"
                      onClick={handleClearBatch}
                      className="px-2 py-1 text-xs font-semibold rounded-md text-red-400 hover:text-white hover:bg-red-500 transition flex items-center gap-1.5 ml-1 border border-red-500/30"
                      title="Hapus Seluruh Data Batch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Bersihkan</span>
                    </button>
                  )}
                </div>

                {/* Processing Status Banner */}
                {batchProgress.total > 0 && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-300">
                      <strong>{batchProgress.current}</strong> / {batchProgress.total} File
                    </span>
                    <span className="text-emerald-400 font-medium">
                      ✓ {batchProgress.successCount} Sukses
                    </span>
                    {batchProgress.errorCount > 0 && (
                      <span className="text-red-400 font-medium">
                        ✗ {batchProgress.errorCount} Gagal
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Folder Loading Spinner Overlay Banner */}
              {isLoadingFolder && (
                <div className="bg-indigo-950/80 border border-indigo-500/50 rounded-xl p-4 flex items-center justify-center gap-3 shadow-lg flex-shrink-0 animate-pulse">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  <div>
                    <p className="text-xs font-bold text-indigo-200">Membaca & Menyiapkan File PDF dari Folder...</p>
                    <p className="text-[10px] text-indigo-400">Menyusun file dari urutan terakhir ke terawal...</p>
                  </div>
                </div>
              )}

              {/* Realtime Progress Bar */}
              {isExtractingExcel && (
                <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-3 flex flex-col gap-2 flex-shrink-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-indigo-300 font-medium truncate max-w-[400px]">
                      ⏳ Memproses: {batchProgress.currentFileName}
                    </span>
                    <span className="font-bold text-indigo-400">
                      {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 transition-all duration-200"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Tab 1: Batch Files List */}
              {activeExcelTab === 'files' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {excelBatchItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-700/60 rounded-xl bg-slate-900/20 p-8">
                      <FolderOpen className="w-14 h-14 text-slate-600 mb-3" />
                      <h4 className="text-sm font-semibold text-slate-300">Belum Ada Folder Atau File PDF Diberikan</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
                        Klik tombol <strong>"📁 Pilih Folder"</strong> untuk membaca seluruh file PDF di dalam folder, atau pilih beberapa file PDF sekaligus hingga 2.000 file.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {excelBatchItems.map((item, idx) => (
                        <div
                          key={item.id}
                          className="bg-slate-900/70 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-slate-600 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center justify-center flex-shrink-0 border border-slate-700">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-200 truncate">{item.file.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {item.relativePath !== item.file.name ? item.relativePath : `${(item.file.size / (1024 * 1024)).toFixed(2)} MB`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            {item.status === 'pending' && (
                              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                Menunggu
                              </span>
                            )}
                            {item.status === 'processing' && (
                              <span className="text-[10px] text-indigo-300 bg-indigo-500/20 border border-indigo-500/40 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Memproses...
                              </span>
                            )}
                            {item.status === 'success' && (
                              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                {item.pageCount} Hal • {item.rowCount} Baris
                              </span>
                            )}
                            {item.status === 'error' && (
                              <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded flex items-center gap-1" title={item.errorMsg}>
                                <AlertCircle className="w-3 h-3 text-red-400" /> Gagal
                              </span>
                            )}
                            {!isExtractingExcel && (
                              <button
                                type="button"
                                onClick={() => handleRemoveBatchItem(item.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/20 transition border border-transparent hover:border-red-500/30 ml-1"
                                title="Hapus File Ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Excel Grid Data Preview */}
              {activeExcelTab === 'preview' && (
                <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                  {/* Search and Pagination Control Bar */}
                  <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50 flex-shrink-0 text-xs">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-400" />
                      <input
                        type="text"
                        value={excelPreviewSearch}
                        onChange={(e) => {
                          setExcelPreviewSearch(e.target.value);
                          setExcelPreviewPage(1);
                        }}
                        placeholder="Cari teks/data di grid..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-slate-300">
                      <button
                        type="button"
                        disabled={excelPreviewPage <= 1}
                        onClick={() => setExcelPreviewPage(prev => Math.max(1, prev - 1))}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded border border-slate-700"
                      >
                        Prev
                      </button>
                      <span>
                        Halaman <strong>{excelPreviewPage}</strong> / {totalPreviewPages}
                      </span>
                      <button
                        type="button"
                        disabled={excelPreviewPage >= totalPreviewPages}
                        onClick={() => setExcelPreviewPage(prev => Math.min(totalPreviewPages, prev + 1))}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded border border-slate-700"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  {/* Grid Table Display */}
                  {paginatedPreviewRows.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                      <FileSpreadsheet className="w-12 h-12 text-slate-600 mb-2" />
                      <p className="text-xs font-medium text-slate-300">Belum Ada Data Diekstrak</p>
                      <p className="text-[11px] text-slate-500 mt-1">Jalankan proses konversi untuk melihat data grid.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-auto border border-slate-700/60 rounded-xl bg-slate-950">
                      <table className="w-full text-left text-xs text-slate-300 border-collapse">
                        <tbody>
                          {paginatedPreviewRows.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className={
                                rIdx === 0
                                  ? 'bg-slate-900 font-semibold text-indigo-300 border-b border-slate-800 sticky top-0 z-10'
                                  : 'border-b border-slate-900/80 hover:bg-slate-900/50'
                              }
                            >
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-2 border-r border-slate-900 min-w-[120px] max-w-[300px] truncate">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
          )} {/* end ebupotLicenseStatus valid/checking */}
          </> /* end mainTool excel fragment */
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
              <p className="text-xs text-slate-400 mt-1">Versi 2.4.2 • Rust & Tauri Engine</p>
            </div>
            <div className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-300 space-y-2.5 text-left">
              <div className="flex items-center gap-2.5"><User className="w-4 h-4 text-indigo-400" /><span>Pengembang: <strong>Muhammmad Fahrizal Rahman</strong></span></div>
              <div className="flex items-center gap-2.5"><Globe className="w-4 h-4 text-indigo-400" /><span>Website: <button type="button" onClick={async () => { try { const { invoke } = await import('@tauri-apps/api/core'); await invoke('open_url', { url: 'https://www.frm.web.id' }); } catch { window.open('https://www.frm.web.id', '_blank'); } }} className="text-indigo-400 hover:underline font-medium focus:outline-none">https://www.frm.web.id</button></span></div>
            </div>
            <p className="text-[11px] text-slate-400">Aplikasi pengelolaan PDF lengkap (Split, Merge, Watermark, Edit, PDF to Excel) mandiri & offline.</p>
            <button onClick={() => setShowAbout(false)} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-2 rounded-lg text-xs">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
