use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::Engine;
use chrono::Utc;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

type HmacSha256 = Hmac<Sha256>;

// APP_SECRET bytes — XOR obfuscated (same as CLI tool)
const SECRET_XOR: &[u8] = &[
    0x0b, 0x23, 0x08, 0x3b, 0x14, 0x0e, 0x0f, 0x7c,
    0x2b, 0x57, 0x5e, 0x7e, 0x10, 0x1f, 0x62, 0x05,
    0x52, 0x64, 0x1e, 0x13, 0x26, 0x0d, 0x5e, 0x7b,
    0x03, 0x1c, 0x53, 0x10, 0x2b, 0x03, 0x5e, 0x17,
];
const SECRET_KEY: &[u8] = &[
    0x49, 0x41, 0x6d, 0x58, 0x70, 0x6c, 0x61, 0x19,
    0x4c, 0x36, 0x38, 0x17, 0x65, 0x74, 0x57, 0x72,
    0x28, 0x14, 0x7d, 0x7e, 0x47, 0x79, 0x35, 0x1b,
    0x72, 0x6f, 0x28, 0x7a, 0x4a, 0x67, 0x30, 0x67,
];

fn get_app_secret() -> Vec<u8> {
    SECRET_XOR.iter().zip(SECRET_KEY.iter()).map(|(a, b)| a ^ b).collect()
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct LicenseInfo {
    pub valid: bool,
    pub username: String,
    pub expires_at: String,   // "2027-08-21"
    pub days_remaining: i64,
    pub message: String,
}

/// Path file lisensi di app data dir
fn license_path(app_handle: &tauri::AppHandle) -> PathBuf {
    app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("license.lic")
}

/// AES-256-GCM key dari machine_key (deterministik)
fn derive_enc_key(machine_key: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(b"BagiPDF-LIC-ENC-V1:");
    hasher.update(machine_key.as_bytes());
    hasher.finalize().into()
}

/// Verifikasi token tanpa menyimpan — return (valid, expiry_epoch, username)
fn verify_token_internal(token: &str, machine_key: &str, username: &str) -> Result<i64, String> {
    let stripped = token.trim().replace("BPDF-", "").replace("-", "");
    if stripped.len() < 28 {
        return Err("Format token tidak valid".to_string());
    }

    let epoch_hex = &stripped[0..8];
    let epoch_u32 = u32::from_str_radix(epoch_hex, 16)
        .map_err(|_| "Token corrupt (epoch)".to_string())?;

    let now_epoch = Utc::now().timestamp();
    let base = (now_epoch & (0xFFFF_FFFF_0000_0000_u64 as i64)) | (epoch_u32 as i64);
    let expiry_epoch = if base < now_epoch - 2 * 365 * 86400 {
        base + 0x1_0000_0000_i64
    } else {
        base
    };

    // Verify HMAC
    let message = format!("{}||{}||{}", machine_key, username, expiry_epoch);
    let secret = get_app_secret();
    let mut mac = <HmacSha256 as Mac>::new_from_slice(&secret).expect("HMAC init failed");
    Mac::update(&mut mac, message.as_bytes());
    let expected = mac.finalize().into_bytes();
    let expected_b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(expected);
    let expected_payload: String = expected_b64.chars().take(20).collect();
    let expected_combined = format!("{}{}", epoch_hex, expected_payload);

    if stripped != expected_combined {
        return Err("Token tidak valid untuk perangkat ini. Pastikan Machine Key sesuai.".to_string());
    }

    if now_epoch > expiry_epoch {
        return Err(format!(
            "Token sudah kadaluarsa. Hubungi admin untuk token baru."
        ));
    }

    Ok(expiry_epoch)
}

/// Aktivasi lisensi — verifikasi token dan simpan ke disk (encrypted)
pub fn activate_license(
    app_handle: &tauri::AppHandle,
    token: &str,
    username: &str,
    machine_key: &str,
) -> Result<LicenseInfo, String> {
    // 1. Verifikasi token
    let expiry_epoch = verify_token_internal(token, machine_key, username)?;
    let expires_at = chrono::DateTime::<Utc>::from_timestamp(expiry_epoch, 0)
        .ok_or("Timestamp tidak valid")?;

    // 2. Payload yang akan disimpan
    let payload = format!(
        "{}||{}||{}||{}",
        username, machine_key, expiry_epoch, token
    );

    // 3. Encrypt dengan AES-256-GCM
    let enc_key_bytes = derive_enc_key(machine_key);
    let enc_key = Key::<Aes256Gcm>::from_slice(&enc_key_bytes);
    let cipher = Aes256Gcm::new(enc_key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, payload.as_bytes())
        .map_err(|e| format!("Enkripsi gagal: {}", e))?;

    // 4. Simpan: nonce (12 bytes) + ciphertext sebagai base64
    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    let encoded = base64::engine::general_purpose::STANDARD.encode(&combined);

    let lic_path = license_path(app_handle);
    if let Some(parent) = lic_path.parent() {
        fs::create_dir_all(parent).ok();
    }
    fs::write(&lic_path, &encoded).map_err(|e| format!("Gagal menyimpan lisensi: {}", e))?;

    let now = Utc::now();
    let days_remaining = (expires_at - now).num_days();

    Ok(LicenseInfo {
        valid: true,
        username: username.to_string(),
        expires_at: expires_at.format("%Y-%m-%d").to_string(),
        days_remaining,
        message: format!("Lisensi aktif. Berlaku hingga {}", expires_at.format("%d %B %Y")),
    })
}

/// Cek lisensi yang tersimpan — return status validity
pub fn check_license(app_handle: &tauri::AppHandle, machine_key: &str) -> LicenseInfo {
    let not_valid = |msg: &str| LicenseInfo {
        valid: false,
        username: String::new(),
        expires_at: String::new(),
        days_remaining: 0,
        message: msg.to_string(),
    };

    let lic_path = license_path(app_handle);
    let encoded = match fs::read_to_string(&lic_path) {
        Ok(s) => s,
        Err(_) => return not_valid("Lisensi belum diaktifkan."),
    };

    // Decrypt
    let combined = match base64::engine::general_purpose::STANDARD.decode(encoded.trim()) {
        Ok(v) => v,
        Err(_) => return not_valid("File lisensi corrupt."),
    };

    if combined.len() < 12 {
        return not_valid("File lisensi terlalu pendek.");
    }

    let nonce = Nonce::from_slice(&combined[..12]);
    let ciphertext = &combined[12..];

    let enc_key_bytes = derive_enc_key(machine_key);
    let enc_key = Key::<Aes256Gcm>::from_slice(&enc_key_bytes);
    let cipher = Aes256Gcm::new(enc_key);

    let plaintext = match cipher.decrypt(nonce, ciphertext) {
        Ok(p) => p,
        Err(_) => return not_valid("Lisensi tidak valid untuk perangkat ini."),
    };

    let payload = match String::from_utf8(plaintext) {
        Ok(s) => s,
        Err(_) => return not_valid("Lisensi corrupt."),
    };

    // Parse payload: username||machine_key||expiry_epoch||token
    let parts: Vec<&str> = payload.splitn(4, "||").collect();
    if parts.len() < 3 {
        return not_valid("Format lisensi tidak valid.");
    }

    let username = parts[0];
    let stored_machine_key = parts[1];
    let expiry_epoch: i64 = match parts[2].parse() {
        Ok(e) => e,
        Err(_) => return not_valid("Lisensi corrupt (expiry)."),
    };

    // Pastikan machine_key cocok
    if stored_machine_key != machine_key {
        return not_valid("Lisensi bukan untuk perangkat ini.");
    }

    let now = Utc::now();
    let now_epoch = now.timestamp();

    if now_epoch > expiry_epoch {
        return LicenseInfo {
            valid: false,
            username: username.to_string(),
            expires_at: chrono::DateTime::<Utc>::from_timestamp(expiry_epoch, 0)
                .map(|d| d.format("%Y-%m-%d").to_string())
                .unwrap_or_default(),
            days_remaining: 0,
            message: "Lisensi sudah kadaluarsa. Hubungi admin untuk pembaruan.".to_string(),
        };
    }

    let expires_at = chrono::DateTime::<Utc>::from_timestamp(expiry_epoch, 0).unwrap();
    let days_remaining = (expires_at - now).num_days();

    LicenseInfo {
        valid: true,
        username: username.to_string(),
        expires_at: expires_at.format("%Y-%m-%d").to_string(),
        days_remaining,
        message: format!("Lisensi aktif untuk {}. Berlaku {} hari lagi.", username, days_remaining),
    }
}
