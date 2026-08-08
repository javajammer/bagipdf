import React, { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
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
  Split
} from 'lucide-react';

import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

// Configure pdfjs worker locally (100% offline & air-gapped compliant)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PageThumb {
  pageIndex: number;
  dataUrl: string;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [thumbnails, setThumbnails] = useState<PageThumb[]>([]);
  const [activeTab, setActiveTab] = useState<'custom' | 'fixed' | 'extract' | 'size'>('custom');
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [showAbout, setShowAbout] = useState<boolean>(false);

  // Custom Range State
  const [customRanges, setCustomRanges] = useState<string>('1-2, 3-4');
  const [mergeCustom, setMergeCustom] = useState<boolean>(false);

  // Fixed Range State
  const [fixedStep, setFixedStep] = useState<number>(1);

  // Extract Pages State
  const [extractMode, setExtractMode] = useState<'all' | 'select'>('all');
  const [extractPagesStr, setExtractPagesStr] = useState<string>('1, 3');
  const [mergeExtract, setMergeExtract] = useState<boolean>(true);

  // Size Split State
  const [targetMB, setTargetMB] = useState<number>(2);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const loadPdf = async (pdfFile: File) => {
    setLoading(true);
    setStatusMsg('Membaca PDF & Rendering Pratinjau...');
    try {
      setFile(pdfFile);
      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadedPdf = await PDFDocument.load(arrayBuffer);
      setPdfDoc(loadedPdf);
      const count = loadedPdf.getPageCount();
      setTotalPages(count);

      // Render thumbnails using PDF.js
      const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
            dataUrl: canvas.toDataURL('image/jpeg', 0.85)
          });
        }
      }
      setThumbnails(thumbs);
      setStatusMsg('');
    } catch (err: any) {
      alert('Gagal membaca file PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const parseRanges = (str: string, total: number): number[][] => {
    const result: number[][] = [];
    const parts = str.split(',');
    for (let part of parts) {
      part = part.trim();
      if (!part) continue;
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr.trim(), 10);
        const end = parseInt(endStr.trim(), 10);
        if (isNaN(start) || isNaN(end) || start < 1 || end > total || start > end) {
          throw new Error(`Rentang halaman tidak valid: "${part}"`);
        }
        const rangeList: number[] = [];
        for (let i = start - 1; i < end; i++) rangeList.push(i);
        result.push(rangeList);
      } else {
        const p = parseInt(part, 10);
        if (isNaN(p) || p < 1 || p > total) {
          throw new Error(`Halaman di luar jangkauan: "${part}"`);
        }
        result.push([p - 1]);
      }
    }
    return result;
  };

  const downloadBlob = (bytesOrBlob: Uint8Array | Blob, fileName: string, mimeType = 'application/pdf') => {
    let blob: Blob;
    if (bytesOrBlob instanceof Blob) {
      blob = bytesOrBlob;
    } else {
      // Copy to clean standalone ArrayBuffer for strict PDF reader & Edge compatibility
      const cleanArray = new Uint8Array(bytesOrBlob.length);
      cleanArray.set(bytesOrBlob);
      blob = new Blob([cleanArray.buffer], { type: mimeType });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    
    // Explicit MouseEvent dispatch for Microsoft Edge / Chromium compatibility
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    a.dispatchEvent(clickEvent);

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  };

  const handleExecuteSplit = async () => {
    if (!file || !pdfDoc) return;
    setLoading(true);
    setStatusMsg('Memproses Split PDF...');

    try {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const zip = new JSZip();
      let generatedFiles: { name: string; bytes: Uint8Array }[] = [];

      if (activeTab === 'custom') {
        const ranges = parseRanges(customRanges, totalPages);
        if (mergeCustom) {
          const newPdf = await PDFDocument.create();
          for (const range of ranges) {
            const copiedPages = await newPdf.copyPages(pdfDoc, range);
            copiedPages.forEach(p => newPdf.addPage(p));
          }
          const pdfBytes = await newPdf.save();
          downloadBlob(pdfBytes, `${baseName}_custom_merged.pdf`);
          setLoading(false);
          return;
        } else {
          for (let idx = 0; idx < ranges.length; idx++) {
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, ranges[idx]);
            copiedPages.forEach(p => newPdf.addPage(p));
            const pdfBytes = await newPdf.save();
            generatedFiles.push({ name: `${baseName}_range_${idx + 1}.pdf`, bytes: pdfBytes });
          }
        }
      } else if (activeTab === 'fixed') {
        const step = Math.max(1, fixedStep);
        let part = 1;
        for (let i = 0; i < totalPages; i += step) {
          const range = Array.from({ length: Math.min(step, totalPages - i) }, (_, k) => i + k);
          const newPdf = await PDFDocument.create();
          const copiedPages = await newPdf.copyPages(pdfDoc, range);
          copiedPages.forEach(p => newPdf.addPage(p));
          const pdfBytes = await newPdf.save();
          generatedFiles.push({ name: `${baseName}_part_${part}.pdf`, bytes: pdfBytes });
          part++;
        }
      } else if (activeTab === 'extract') {
        if (extractMode === 'all') {
          for (let i = 0; i < totalPages; i++) {
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, [i]);
            copiedPages.forEach(p => newPdf.addPage(p));
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
            const pdfBytes = await newPdf.save();
            downloadBlob(pdfBytes, `${baseName}_extracted.pdf`);
            setLoading(false);
            return;
          } else {
            for (const idx of flatIndices) {
              const newPdf = await PDFDocument.create();
              const copiedPages = await newPdf.copyPages(pdfDoc, [idx]);
              copiedPages.forEach(p => newPdf.addPage(p));
              const pdfBytes = await newPdf.save();
              generatedFiles.push({ name: `${baseName}_page_${idx + 1}.pdf`, bytes: pdfBytes });
            }
          }
        }
      } else if (activeTab === 'size') {
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
            const currentBytes = await currentPdf.save();
            generatedFiles.push({ name: `${baseName}_size_part_${part}.pdf`, bytes: currentBytes });
            part++;
            currentPdf = await PDFDocument.create();
          }

          const copied = await currentPdf.copyPages(pdfDoc, [i]);
          currentPdf.addPage(copied[0]);
        }

        if (currentPdf.getPageCount() > 0) {
          const finalBytes = await currentPdf.save();
          generatedFiles.push({ name: `${baseName}_size_part_${part}.pdf`, bytes: finalBytes });
        }
      }

      if (generatedFiles.length === 1) {
        downloadBlob(generatedFiles[0].bytes, generatedFiles[0].name, 'application/pdf');
      } else if (generatedFiles.length > 1) {
        generatedFiles.forEach(f => zip.file(f.name, f.bytes, { binary: true }));
        const zipBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
        downloadBlob(zipBlob, `${baseName}_split_files.zip`, 'application/zip');
      }

    } catch (err: any) {
      alert('Error saat memproses PDF: ' + err.message);
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  return (
    <div className="min-h-screen bg-[#1E1E24] text-slate-200 flex flex-col font-sans select-none antialiased">
      {/* macOS Style Header Bar */}
      <header className="h-12 bg-[#2B2B36]/80 backdrop-blur-md border-b border-slate-700/50 px-4 flex items-center justify-between shadow-sm drag flex-shrink-0">
        {/* Left: Window Control Dots */}
        <div className="flex items-center space-x-2 w-24">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] hover:opacity-80 transition cursor-pointer"></div>
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] hover:opacity-80 transition cursor-pointer"></div>
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29] hover:opacity-80 transition cursor-pointer"></div>
        </div>

        {/* Title */}
        <div className="flex items-center gap-2">
          <Split className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-300 tracking-wide">BagiPDF</span>
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

      {/* Main Container */}
      <main className="flex-1 flex p-5 gap-5 overflow-hidden">
        {/* macOS Left Sidebar Panel */}
        <aside className="w-[340px] bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-4 shadow-xl backdrop-blur-xl flex-shrink-0">
          
          {/* File Upload Box */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-xl p-4 transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2.5 ${
              file 
                ? 'border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/15' 
                : 'border-slate-600/60 bg-slate-800/40 hover:bg-slate-800/70 hover:border-slate-500'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow-inner ${
              file ? 'bg-indigo-500 text-white' : 'bg-slate-700/70 text-slate-300'
            }`}>
              <UploadCloud className="w-5 h-5" />
            </div>

            {file ? (
              <div className="w-full">
                <p className="font-medium text-xs text-indigo-200 truncate max-w-[260px] mx-auto">{file.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{totalPages} Halaman • {(file.size / (1024*1024)).toFixed(2)} MB</p>
                <span className="inline-block mt-2 text-[10px] bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">Klik untuk mengganti PDF</span>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-xs text-slate-200">Pilih File PDF</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Klik untuk memilih dokumen PDF</p>
              </div>
            )}
          </div>

          <input 
            ref={fileInputRef} 
            type="file" 
            accept="application/pdf" 
            onChange={handleFileChange} 
            className="hidden" 
          />

          {/* Mode Selector Tabs */}
          <div className="flex flex-col flex-1 gap-3.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mode Pemotongan</label>

            <div className="grid grid-cols-2 gap-1.5 bg-slate-900/60 p-1 rounded-lg border border-slate-700/50">
              <button 
                onClick={() => setActiveTab('custom')}
                className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition ${activeTab === 'custom' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Custom Range
              </button>
              <button 
                onClick={() => setActiveTab('fixed')}
                className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition ${activeTab === 'fixed' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Fixed Range
              </button>
              <button 
                onClick={() => setActiveTab('extract')}
                className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition ${activeTab === 'extract' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Extract Pages
              </button>
              <button 
                onClick={() => setActiveTab('size')}
                className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition ${activeTab === 'size' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Split by Size
              </button>
            </div>

            {/* Tab Configurations */}
            <div className="bg-slate-900/40 border border-slate-700/40 rounded-xl p-3.5 flex-1 flex flex-col justify-between">
              {activeTab === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Rentang Halaman Custom</label>
                    <p className="text-[11px] text-slate-400 mb-2">Gunakan koma & strip (misal: <code className="text-indigo-300">1-3, 5, 8-10</code>)</p>
                    <input 
                      type="text" 
                      value={customRanges} 
                      onChange={(e) => setCustomRanges(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input 
                      type="checkbox" 
                      checked={mergeCustom} 
                      onChange={(e) => setMergeCustom(e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                    />
                    <span className="text-xs text-slate-300">Gabungkan hasil rentang ke 1 file</span>
                  </label>
                </div>
              )}

              {activeTab === 'fixed' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Split Setiap N Halaman</label>
                    <p className="text-[11px] text-slate-400 mb-2">Memotong PDF secara periodik tiap interval halaman</p>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-slate-400">Setiap</span>
                      <input 
                        type="number" 
                        min="1"
                        value={fixedStep} 
                        onChange={(e) => setFixedStep(parseInt(e.target.value) || 1)}
                        className="w-20 bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 text-center"
                      />
                      <span className="text-xs text-slate-400">halaman</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'extract' && (
                <div className="space-y-3">
                  <label className="text-xs font-medium text-slate-300 block">Opsi Ekstraksi Halaman</label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="extMode" 
                        checked={extractMode === 'all'} 
                        onChange={() => setExtractMode('all')}
                        className="text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                      />
                      <span className="text-xs text-slate-300">Ekstrak SEMUA halaman terpisah</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="extMode" 
                        checked={extractMode === 'select'} 
                        onChange={() => setExtractMode('select')}
                        className="text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                      />
                      <span className="text-xs text-slate-300">Ekstrak Halaman Tertentu</span>
                    </label>
                  </div>

                  {extractMode === 'select' && (
                    <div className="pt-1.5 space-y-2.5">
                      <input 
                        type="text" 
                        value={extractPagesStr} 
                        onChange={(e) => setExtractPagesStr(e.target.value)}
                        placeholder="Contoh: 1, 3, 5-7"
                        className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={mergeExtract} 
                          onChange={(e) => setMergeExtract(e.target.checked)}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                        />
                        <span className="text-xs text-slate-300">Gabungkan halaman terpilih</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'size' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Batas Maksimal Ukuran File (MB)</label>
                    <p className="text-[11px] text-slate-400 mb-2">Membagi PDF agar tiap bagian tak melebihi target</p>
                    <div className="flex items-center gap-2.5">
                      <input 
                        type="number" 
                        step="0.5"
                        min="0.5"
                        value={targetMB} 
                        onChange={(e) => setTargetMB(parseFloat(e.target.value) || 1)}
                        className="w-24 bg-slate-950/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 text-center"
                      />
                      <span className="text-xs text-slate-400">MB per file</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Action Button */}
              <button 
                disabled={!file || loading}
                onClick={handleExecuteSplit}
                className="w-full mt-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg shadow-md transition flex items-center justify-center gap-2 text-xs"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{statusMsg || 'Memproses...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Proses & Simpan Split PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* macOS Main Visual Preview Window */}
        <section className="flex-1 bg-[#2B2B36]/90 border border-slate-700/40 rounded-xl flex flex-col overflow-hidden shadow-xl backdrop-blur-xl">
          <div className="bg-slate-900/60 px-5 py-2.5 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Grid className="w-3.5 h-3.5 text-indigo-400" /> Pratinjau Visual Halaman
            </h2>
            {totalPages > 0 && (
              <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700/60">
                {totalPages} Halaman
              </span>
            )}
          </div>

          <div className="flex-1 p-5 overflow-y-auto bg-[#181820]">
            {!file ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                <Sparkles className="w-10 h-10 text-slate-600 mb-2.5" />
                <p className="font-medium text-xs text-slate-300">Belum Ada Dokumen Terpilih</p>
                <p className="text-[11px] text-slate-500 max-w-xs mt-1">Silakan upload dokumen PDF untuk melihat tampilan halaman visual di sini.</p>
              </div>
            ) : thumbnails.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                <RefreshCw className="w-7 h-7 animate-spin text-indigo-400 mb-2.5" />
                <p className="text-xs">{statusMsg || 'Memuat pratinjau...'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                {thumbnails.map((thumb) => (
                  <div 
                    key={thumb.pageIndex}
                    className="bg-[#23232D] border border-slate-700/50 rounded-lg p-2.5 flex flex-col items-center gap-2 hover:border-indigo-500/60 transition group shadow-sm"
                  >
                    <div className="w-full aspect-[3/4] bg-slate-950 rounded border border-slate-800 overflow-hidden flex items-center justify-center group-hover:shadow-md transition">
                      <img 
                        src={thumb.dataUrl} 
                        alt={`Halaman ${thumb.pageIndex + 1}`} 
                        className="object-contain w-full h-full"
                      />
                    </div>
                    <span className="text-[10px] font-medium text-slate-300 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700/50">
                      Halaman {thumb.pageIndex + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* About Modal Dialog (macOS Style) */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#2B2B36] border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-center flex flex-col items-center gap-4">
            <button 
              onClick={() => setShowAbout(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700/50 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg border border-indigo-400/30">
              <Split className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">BagiPDF</h3>
              <p className="text-xs text-slate-400 mt-1">Versi 1.2.0 • Native Desktop Application</p>
            </div>

            <div className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-300 space-y-2.5 text-left">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span>Pengembang: <strong>Franky Setiawan</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span>Website: <a href="https://www.frm.web.id" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline font-medium">https://www.frm.web.id</a></span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Aplikasi pemotong file PDF mandiri dengan visual preview modern untuk Windows 11 & Windows 10 x86_64.
            </p>

            <button 
              onClick={() => setShowAbout(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium py-2 rounded-lg text-xs transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
