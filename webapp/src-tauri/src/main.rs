// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashSet;
use std::fs;
use std::sync::Mutex;
use tauri::{Listener, Manager};

static ALLOWED_PDF_PATHS: Mutex<Option<HashSet<String>>> = Mutex::new(None);

mod ebupot;
mod fingerprint;
mod license;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! BagiPDF v2.3.2 is running on Rust & Tauri engine.", name)
}

#[tauri::command]
async fn save_file_dialog(default_name: String, contents: Vec<u8>) -> Result<Option<String>, String> {
    let mut dialog = rfd::AsyncFileDialog::new().set_file_name(&default_name);

    if default_name.ends_with(".pdf") {
        dialog = dialog.add_filter("PDF Document (*.pdf)", &["pdf"]);
    } else if default_name.ends_with(".zip") {
        dialog = dialog.add_filter("ZIP Archive (*.zip)", &["zip"]);
    } else if default_name.ends_with(".xlsx") {
        dialog = dialog.add_filter("Excel Spreadsheet (*.xlsx)", &["xlsx"]);
    }

    let file_handle = dialog.save_file().await;

    if let Some(file) = file_handle {
        fs::write(file.path(), contents).map_err(|e| format!("Gagal menulis file: {}", e))?;
        Ok(Some(file.path().to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Gagal membuka browser: {}", e))
}

#[derive(serde::Serialize)]
struct PdfFileInfo {
    name: String,
    path: String,
    size: u64,
}

#[tauri::command]
async fn select_folder_dialog() -> Result<Option<Vec<PdfFileInfo>>, String> {
    let folder_handle = rfd::AsyncFileDialog::new().pick_folder().await;

    if let Some(folder) = folder_handle {
        let folder_path = folder.path();
        let mut pdf_files = Vec::new();
        let mut allowed = HashSet::new();

        if let Ok(entries) = fs::read_dir(folder_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                let Some(ext) = path.extension() else { continue };
                if ext.to_string_lossy().to_lowercase() != "pdf" {
                    continue;
                }
                let Ok(meta) = entry.metadata() else { continue };
                let path_str = path.to_string_lossy().to_string();
                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "document.pdf".to_string());
                allowed.insert(path_str.clone());
                pdf_files.push(PdfFileInfo {
                    name,
                    path: path_str,
                    size: meta.len(),
                });
            }
        }

        if let Ok(mut guard) = ALLOWED_PDF_PATHS.lock() {
            *guard = Some(allowed);
        }
        Ok(Some(pdf_files))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn read_pdf_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    {
        let allowed = ALLOWED_PDF_PATHS
            .lock()
            .map_err(|_| "Gagal mengunci daftar file PDF.".to_string())?;
        let Some(set) = allowed.as_ref() else {
            return Err("Belum ada folder PDF yang dipilih.".to_string());
        };
        if !set.contains(&path) {
            return Err("Path PDF tidak diizinkan.".to_string());
        }
    }

    let bytes = fs::read(&path).map_err(|e| format!("Gagal membaca PDF: {}", e))?;
    if bytes.len() > 40 * 1024 * 1024 {
        return Err("File PDF melebihi batas 40MB.".to_string());
    }
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
async fn verify_ip_access() -> Result<bool, String> {
    Ok(true)
}

#[tauri::command]
fn register_admin() -> Result<String, String> {
    Ok("admin_registered_2026".to_string())
}

/// Return machine key (full hex) dan display-friendly version untuk ditampilkan ke user
#[tauri::command]
fn get_machine_key() -> serde_json::Value {
    let raw = fingerprint::collect_machine_key();
    let display = fingerprint::format_display_key(&raw);
    serde_json::json!({
        "raw": raw,
        "display": display
    })
}

/// Verifikasi & Aktivasi Lisensi Ebupot ke Neon DB
#[tauri::command]
async fn activate_ebupot_license(
    app_handle: tauri::AppHandle,
    token: String,
    username: String,
) -> Result<license::LicenseInfo, String> {
    let current_machine_key = fingerprint::collect_machine_key();
    license::verify_online_license(&app_handle, &username, &token, &current_machine_key).await
}

/// Cek status lisensi Ebupot (hybrid: local cache + Neon DB sync)
#[tauri::command]
async fn check_ebupot_license(app_handle: tauri::AppHandle) -> license::LicenseInfo {
    let current_machine_key = fingerprint::collect_machine_key();
    license::check_license_hybrid(&app_handle, &current_machine_key).await
}

fn main() {
    // Fix blank white screen on Linux WebKit2GTK:
    // DMA-Buf renderer causes blank window on many Linux GPU drivers.
    // These env vars disable the problematic compositor path.
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITED_LAYER_REBUILDING", "1");
        // Also set QT fallback renderer to avoid graphical glitches
        std::env::set_var("QT_QPA_PLATFORMTYPE", "software");
    }

    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let window_clone = window.clone();
                window.listen("tauri://loaded", move |_| {
                    let _ = window_clone.set_focus();
                });
            }
            Ok(())
        })
.invoke_handler(tauri::generate_handler![
            greet,
            save_file_dialog,
            open_url,
            select_folder_dialog,
            read_pdf_bytes,
            verify_ip_access,
            get_machine_key,
            activate_ebupot_license,
            check_ebupot_license,
            ebupot::parse_ebupot_pdf_text,
            register_admin
        ])
        .run(tauri::generate_context!())
        .expect("error while running BagiPDF Tauri application");
}
