use std::path::PathBuf;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct LicenseInfo {
    pub valid: bool,
    pub username: String,
    pub expires_at: String,
    pub days_remaining: i64,
    pub message: String,
}

/// Stub/Mock Verifikasi Lisensi untuk BagiPDF Open-Source Edition
pub async fn verify_online_license(
    _app_handle: &tauri::AppHandle,
    _email: &str,
    _license_key: &str,
    _current_machine_key: &str,
) -> Result<LicenseInfo, String> {
    Err("Fitur Ebupot PDF to Excel membutuhkan lisensi BagiPDF Pro Official Build.".to_string())
}

/// Stub/Mock Cek Lisensi untuk BagiPDF Open-Source Edition
pub async fn check_license_hybrid(_app_handle: &tauri::AppHandle, _machine_key: &str) -> LicenseInfo {
    LicenseInfo {
        valid: false,
        username: String::new(),
        expires_at: String::new(),
        days_remaining: 0,
        message: "Versi Open-Source Community. Upgrade ke BagiPDF Pro untuk membuka fitur Ebupot.".to_string(),
    }
}

