import os
import sys
import pymupdf as fitz
from pypdf import PdfReader, PdfWriter
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import customtkinter as ctk
from PIL import Image, ImageTk

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class ILovePDFSplitterApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("PDF Splitter Pro - Ultimate PDF Tools (iLovePDF Compatible)")
        self.geometry("1100" + "x" + "750")
        self.minsize(950, 650)

        # App state
        self.pdf_path = None
        self.doc = None
        self.total_pages = 0
        self.page_previews = {}  # page_num (0-indexed) -> CTkImage

        self._build_ui()

    def _build_ui(self):
        # Header / Navigation Banner
        self.header_frame = ctk.CTkFrame(self, height=60, corner_radius=0, fg_color="#1E1E2E")
        self.header_frame.pack(side="top", fill="x")

        self.logo_label = ctk.CTkLabel(
            self.header_frame, 
            text="📄 PDF Splitter Pro", 
            font=ctk.CTkFont(size=22, weight="bold"),
            text_color="#FF4B4B"
        )
        self.logo_label.pack(side="left", padx=20, pady=10)

        self.subtitle_label = ctk.CTkLabel(
            self.header_frame,
            text="Fitur Lengkap iLovePDF • Standalone Windows Executable",
            font=ctk.CTkFont(size=13),
            text_color="#A0A0B0"
        )
        self.subtitle_label.pack(side="left", padx=10, pady=10)

        # Main Layout: Sidebar (Tools & Options) + Preview Workspace
        self.main_container = ctk.CTkFrame(self, fg_color="transparent")
        self.main_container.pack(fill="both", expand=True, padx=15, pady=15)

        # Left Sidebar (Controls)
        self.sidebar = ctk.CTkFrame(self.main_container, width=380, corner_radius=12)
        self.sidebar.pack(side="left", fill="y", padx=(0, 10), pady=0)
        self.sidebar.pack_propagate(False)

        # Right Panel (File drop zone & Page Previews)
        self.preview_panel = ctk.CTkFrame(self.main_container, corner_radius=12)
        self.preview_panel.pack(side="right", fill="both", expand=True)

        self._build_sidebar_controls()
        self._build_preview_area()

    def _build_sidebar_controls(self):
        # File selector section
        file_box = ctk.CTkFrame(self.sidebar, fg_color="#2B2D42", corner_radius=10)
        file_box.pack(fill="x", padx=15, pady=15)

        self.select_btn = ctk.CTkButton(
            file_box, 
            text="📁 Pilih File PDF", 
            command=self.open_pdf_dialog,
            font=ctk.CTkFont(size=14, weight="bold"),
            fg_color="#E63946",
            hover_color="#D62828",
            height=40
        )
        self.select_btn.pack(fill="x", padx=15, pady=12)

        self.file_info_lbl = ctk.CTkLabel(
            file_box, 
            text="Belum ada file PDF terpilih", 
            wraplength=320, 
            font=ctk.CTkFont(size=12),
            text_color="#8D99AE"
        )
        self.file_info_lbl.pack(padx=15, pady=(0, 12))

        # Mode Tabs (iLovePDF Modes)
        self.tabview = ctk.CTkTabview(self.sidebar, corner_radius=10)
        self.tabview.pack(fill="both", expand=True, padx=15, pady=(0, 15))

        self.tab_range = self.tabview.add("Custom Range")
        self.tab_fixed = self.tabview.add("Fixed Range")
        self.tab_extract = self.tabview.add("Extract Pages")
        self.tab_size = self.tabview.add("Split by Size")

        # 1. Custom Range UI
        ctk.CTkLabel(self.tab_range, text="Split berdasarkan Rentang Halaman Custom:", font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", pady=5)
        ctk.CTkLabel(self.tab_range, text="Contoh: 1-3, 5, 8-12", text_color="#A0A0B0", font=ctk.CTkFont(size=11)).pack(anchor="w", pady=(0, 5))
        
        self.range_entry = ctk.CTkEntry(self.tab_range, placeholder_text="e.g. 1-3, 5, 7-10")
        self.range_entry.pack(fill="x", pady=5)

        self.merge_ranges_var = ctk.BooleanVar(value=False)
        self.merge_checkbox = ctk.CTkCheckBox(self.tab_range, text="Gabungkan semua rentang ke 1 PDF", variable=self.merge_ranges_var)
        self.merge_checkbox.pack(anchor="w", pady=10)

        # 2. Fixed Range UI
        ctk.CTkLabel(self.tab_fixed, text="Split setiap N halaman secara konstan:", font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", pady=5)
        ctk.CTkLabel(self.tab_fixed, text="Misal: Setiap 2 halaman menjadi 1 file PDF terpisah", text_color="#A0A0B0", font=ctk.CTkFont(size=11)).pack(anchor="w", pady=(0, 5))
        
        fixed_frame = ctk.CTkFrame(self.tab_fixed, fg_color="transparent")
        fixed_frame.pack(fill="x", pady=5)
        ctk.CTkLabel(fixed_frame, text="Split tiap:").pack(side="left", padx=5)
        self.fixed_entry = ctk.CTkEntry(fixed_frame, width=60)
        self.fixed_entry.insert(0, "1")
        self.fixed_entry.pack(side="left", padx=5)
        ctk.CTkLabel(fixed_frame, text="halaman").pack(side="left")

        # 3. Extract Pages UI
        ctk.CTkLabel(self.tab_extract, text="Ekstrak Halaman:", font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", pady=5)
        self.extract_mode_var = ctk.StringVar(value="all")
        
        rb1 = ctk.CTkRadioButton(self.tab_extract, text="Ekstrak SEMUA halaman menjadi PDF terpisah", variable=self.extract_mode_var, value="all")
        rb1.pack(anchor="w", pady=5)
        
        rb2 = ctk.CTkRadioButton(self.tab_extract, text="Pilih Halaman Tertentu yang Ingin Diekstrak:", variable=self.extract_mode_var, value="select")
        rb2.pack(anchor="w", pady=5)

        self.extract_pages_entry = ctk.CTkEntry(self.tab_extract, placeholder_text="e.g. 1, 3, 5-7")
        self.extract_pages_entry.pack(fill="x", pady=5)

        self.extract_merge_var = ctk.BooleanVar(value=True)
        self.extract_merge_cb = ctk.CTkCheckBox(self.tab_extract, text="Gabungkan halaman terpilih ke 1 PDF", variable=self.extract_merge_var)
        self.extract_merge_cb.pack(anchor="w", pady=5)

        # 4. Split by Size UI
        ctk.CTkLabel(self.tab_size, text="Split berdasarkan Target Ukuran File (MB):", font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", pady=5)
        ctk.CTkLabel(self.tab_size, text="Tiap bagian PDF tidak akan melebihi ukuran target.", text_color="#A0A0B0", font=ctk.CTkFont(size=11)).pack(anchor="w", pady=(0, 5))
        
        size_frame = ctk.CTkFrame(self.tab_size, fg_color="transparent")
        size_frame.pack(fill="x", pady=5)
        ctk.CTkLabel(size_frame, text="Maks Ukuran File:").pack(side="left", padx=5)
        self.size_entry = ctk.CTkEntry(size_frame, width=80)
        self.size_entry.insert(0, "5")
        self.size_entry.pack(side="left", padx=5)
        ctk.CTkLabel(size_frame, text="MB").pack(side="left")

        # Action Execute Button
        self.split_btn = ctk.CTkButton(
            self.sidebar, 
            text="✂️ PROSES SPLIT PDF", 
            command=self.execute_split,
            font=ctk.CTkFont(size=15, weight="bold"),
            fg_color="#2A9D8F",
            hover_color="#264653",
            height=45
        )
        self.split_btn.pack(fill="x", padx=15, pady=(0, 15))

    def _build_preview_area(self):
        # Header title for preview area
        self.preview_header = ctk.CTkFrame(self.preview_panel, height=45, fg_color="#2B2D42", corner_radius=0)
        self.preview_header.pack(fill="x")

        self.preview_title = ctk.CTkLabel(
            self.preview_header, 
            text="👁 Visual Page Preview (iLovePDF Style Viewer)", 
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#FFFFFF"
        )
        self.preview_title.pack(side="left", padx=15, pady=8)

        # Scrollable container for thumbnails
        self.preview_scroll = ctk.CTkScrollableFrame(self.preview_panel, fg_color="#1E1E2E")
        self.preview_scroll.pack(fill="both", expand=True, padx=10, pady=10)

        # Placeholder message inside preview space
        self.empty_label = ctk.CTkLabel(
            self.preview_scroll,
            text="Silakan pilih file PDF di panel sebelah kiri untuk menampilkan preview halaman.",
            font=ctk.CTkFont(size=14),
            text_color="#6C757D"
        )
        self.empty_label.pack(expand=True, pady=100)

    def open_pdf_dialog(self):
        file_path = filedialog.askopenfilename(
            title="Pilih File PDF",
            filetypes=[("PDF Files", "*.pdf")]
        )
        if not file_path:
            return

        try:
            self.pdf_path = file_path
            self.doc = fitz.open(self.pdf_path)
            self.total_pages = len(self.doc)

            file_size_mb = os.path.getsize(self.pdf_path) / (1024 * 1024)
            filename = os.path.basename(self.pdf_path)
            
            self.file_info_lbl.configure(
                text=f"📌 {filename}\n📄 {self.total_pages} Halaman | 💾 {file_size_mb:.2f} MB",
                text_color="#E0E0E0"
            )

            self.render_previews()

        except Exception as e:
            messagebox.showerror("Error", f"Gagal membuka file PDF: {str(e)}")

    def render_previews(self):
        # Clear existing preview items
        for widget in self.preview_scroll.winfo_children():
            widget.destroy()

        # Grid system for thumbnails (4 columns)
        cols = 4
        for i in range(self.total_pages):
            page = self.doc.load_page(i)
            # Render page to low-res pixmap for preview
            pix = page.get_pixmap(dpi=72)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Maintain aspect ratio thumbnail size max (140, 180)
            img.thumbnail((140, 180))
            ctk_img = ctk.CTkImage(light_image=img, dark_image=img, size=(img.width, img.height))

            # Thumbnail Card
            card = ctk.CTkFrame(self.preview_scroll, fg_color="#2B2D42", corner_radius=8)
            row = i // cols
            col = i % cols
            card.grid(row=row, column=col, padx=10, pady=10, sticky="nsew")

            img_lbl = ctk.CTkLabel(card, image=ctk_img, text="")
            img_lbl.pack(padx=8, pady=(8, 4))

            page_lbl = ctk.CTkLabel(card, text=f"Halaman {i + 1}", font=ctk.CTkFont(size=11, weight="bold"))
            page_lbl.pack(pady=(0, 6))

    def parse_page_ranges(self, range_str, total_pages):
        """Parse string like '1-3, 5, 8-10' into list of 0-based page index lists [[0,1,2], [4], [7,8,9]]"""
        ranges = []
        parts = range_str.split(',')
        for part in parts:
            part = part.strip()
            if not part:
                continue
            if '-' in part:
                subparts = part.split('-')
                if len(subparts) == 2:
                    start = int(subparts[0].strip())
                    end = int(subparts[1].strip())
                    if start < 1 or end > total_pages or start > end:
                        raise ValueError(f"Rentang halaman tidak valid: {part}")
                    ranges.append(list(range(start - 1, end)))
            else:
                p = int(part)
                if p < 1 or p > total_pages:
                    raise ValueError(f"Halaman diluar jangkauan: {part}")
                ranges.append([p - 1])
        return ranges

    def execute_split(self):
        if not self.pdf_path or not self.doc:
            messagebox.showwarning("Peringatan", "Harap pilih file PDF terlebih dahulu!")
            return

        out_dir = filedialog.askdirectory(title="Pilih Folder Penyimpanan Hasil Split PDF")
        if not out_dir:
            return

        active_tab = self.tabview.get()
        base_name = os.path.splitext(os.path.basename(self.pdf_path))[0]

        try:
            reader = PdfReader(self.pdf_path)

            if active_tab == "Custom Range":
                range_str = self.range_entry.get().strip()
                if not range_str:
                    messagebox.showwarning("Peringatan", "Masukkan rentang halaman custom! (Contoh: 1-3, 5, 7-10)")
                    return
                
                parsed_ranges = self.parse_page_ranges(range_str, self.total_pages)
                
                if self.merge_ranges_var.get():
                    # Merge all specified ranges into 1 single output file
                    writer = PdfWriter()
                    for prange in parsed_ranges:
                        for idx in prange:
                            writer.add_page(reader.pages[idx])
                    out_path = os.path.join(out_dir, f"{base_name}_custom_merged.pdf")
                    with open(out_path, "wb") as f:
                        writer.write(f)
                else:
                    # Save each range as a separate file
                    for idx_range, prange in enumerate(parsed_ranges, 1):
                        writer = PdfWriter()
                        for idx in prange:
                            writer.add_page(reader.pages[idx])
                        out_path = os.path.join(out_dir, f"{base_name}_range_{idx_range}.pdf")
                        with open(out_path, "wb") as f:
                            writer.write(f)

            elif active_tab == "Fixed Range":
                try:
                    step = int(self.fixed_entry.get().strip())
                    if step <= 0:
                        raise ValueError()
                except ValueError:
                    messagebox.showerror("Error", "Jumlah halaman fixed range harus berupa angka positif!")
                    return

                count = 1
                for i in range(0, self.total_pages, step):
                    writer = PdfWriter()
                    for idx in range(i, min(i + step, self.total_pages)):
                        writer.add_page(reader.pages[idx])
                    out_path = os.path.join(out_dir, f"{base_name}_part_{count}.pdf")
                    with open(out_path, "wb") as f:
                        writer.write(f)
                    count += 1

            elif active_tab == "Extract Pages":
                mode = self.extract_mode_var.get()
                if mode == "all":
                    # Extract every single page to standalone PDFs
                    for i in range(self.total_pages):
                        writer = PdfWriter()
                        writer.add_page(reader.pages[i])
                        out_path = os.path.join(out_dir, f"{base_name}_page_{i+1}.pdf")
                        with open(out_path, "wb") as f:
                            writer.write(f)
                else:
                    pages_str = self.extract_pages_entry.get().strip()
                    if not pages_str:
                        messagebox.showwarning("Peringatan", "Masukkan nomor halaman yang ingin diekstrak!")
                        return
                    parsed_ranges = self.parse_page_ranges(pages_str, self.total_pages)
                    flat_indices = [idx for prange in parsed_ranges for idx in prange]

                    if self.extract_merge_cb.get():
                        writer = PdfWriter()
                        for idx in flat_indices:
                            writer.add_page(reader.pages[idx])
                        out_path = os.path.join(out_dir, f"{base_name}_extracted.pdf")
                        with open(out_path, "wb") as f:
                            writer.write(f)
                    else:
                        for idx in flat_indices:
                            writer = PdfWriter()
                            writer.add_page(reader.pages[idx])
                            out_path = os.path.join(out_dir, f"{base_name}_page_{idx+1}.pdf")
                            with open(out_path, "wb") as f:
                                writer.write(f)

            elif active_tab == "Split by Size":
                try:
                    target_mb = float(self.size_entry.get().strip())
                    if target_mb <= 0:
                        raise ValueError()
                except ValueError:
                    messagebox.showerror("Error", "Ukuran target MB harus angka positif!")
                    return
                
                target_bytes = target_mb * 1024 * 1024
                part_idx = 1
                curr_writer = PdfWriter()
                
                for i in range(self.total_pages):
                    # Test size with this new page added
                    temp_writer = PdfWriter()
                    for p in curr_writer.pages:
                        temp_writer.add_page(p)
                    temp_writer.add_page(reader.pages[i])

                    # Check temporary size
                    temp_path = os.path.join(out_dir, "_temp_check.pdf")
                    with open(temp_path, "wb") as tf:
                        temp_writer.write(tf)
                    
                    file_sz = os.path.getsize(temp_path)
                    if os.path.exists(temp_path):
                        os.remove(temp_path)

                    if file_sz > target_bytes and len(curr_writer.pages) > 0:
                        # Write current chunk
                        out_path = os.path.join(out_dir, f"{base_name}_size_part_{part_idx}.pdf")
                        with open(out_path, "wb") as f:
                            curr_writer.write(f)
                        part_idx += 1
                        curr_writer = PdfWriter()

                    curr_writer.add_page(reader.pages[i])

                if len(curr_writer.pages) > 0:
                    out_path = os.path.join(out_dir, f"{base_name}_size_part_{part_idx}.pdf")
                    with open(out_path, "wb") as f:
                        curr_writer.write(f)

            messagebox.showinfo("Sukses", f"Split PDF Berhasil!\nHasil disimpan ke:\n{out_dir}")

        except Exception as e:
            messagebox.showerror("Error", f"Terjadi kesalahan saat memproses PDF:\n{str(e)}")

if __name__ == "__main__":
    app = ILovePDFSplitterApp()
    app.mainloop()
