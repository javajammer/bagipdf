// Prevents additional console window on Windows in release, DO NOT REMOVE!!\n#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;

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
    bytes: Vec<u8>,
}

#[tauri::command]
async fn select_folder_dialog() -> Result<Option<Vec<PdfFileInfo>>, String> {
    let folder_handle = rfd::AsyncFileDialog::new().pick_folder().await;
    
    if let Some(folder) = folder_handle {
        let folder_path = folder.path();
        let mut pdf_files = Vec::new();

        if let Ok(entries) = fs::read_dir(folder_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        if ext.to_string_lossy().to_lowercase() == "pdf" {
                            if let Ok(bytes) = fs::read(&path) {
                                let name = path.file_name()
                                    .map(|n| n.to_string_lossy().to_string())
                                    .unwrap_or_else(|| "document.pdf".to_string());
                                
                                pdf_files.push(PdfFileInfo {
                                    name,
                                    path: path.to_string_lossy().to_string(),
                                    bytes,
                                });
                            }
                        }
                    }
                }
            }
        }
        Ok(Some(pdf_files))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn verify_ip_access() -> Result<bool, String> {
    Ok(true)
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
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            save_file_dialog,
            open_url,
            select_folder_dialog,
            verify_ip_access,
            get_machine_key,
            activate_ebupot_license,
            check_ebupot_license,
            ebupot::parse_ebupot_pdf_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running BagiPDF Tauri application");
}
