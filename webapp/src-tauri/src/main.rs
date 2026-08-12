// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! BagiPDF v2.1.0 is running on Rust & Tauri engine.", name)
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
        Ok(None) // User cancelled save dialog
    }
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Gagal membuka browser: {}", e))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, save_file_dialog, open_url])
        .run(tauri::generate_context!())
        .expect("error while running BagiPDF Tauri application");
}
