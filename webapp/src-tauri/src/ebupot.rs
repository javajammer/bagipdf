// Stub/Mock Ekstraksi Ebupot untuk BagiPDF Open-Source Community Edition

#[tauri::command]
pub fn parse_ebupot_pdf_text(_full_text: String, _file_name: String) -> Result<Vec<String>, String> {
    Err("Modul ekstraksi Ebupot Unifikasi 21/26 hanya tersedia di BagiPDF Pro Official Build.".to_string())
}
