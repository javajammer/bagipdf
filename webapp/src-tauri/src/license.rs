use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::Engine;
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tokio_postgres::Client;

type HmacSha256 = Hmac<Sha256>;

const NEON_DB_URL: &str = "postgresql://neondb_owner:npg_fUByRKpo6sF1@ep-morning-frog-azz98qvs-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

// APP_SECRET bytes — XOR obfuscated
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

fn license_path(app_handle: &tauri::AppHandle) -> PathBuf {
    app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("license.lic")
}

fn derive_enc_key(machine_key: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(b"BagiPDF-LIC-ENC-V1:");
    hasher.update(machine_key.as_bytes());
    hasher.finalize().into()
}

async fn get_db_client() -> Result<Client, String> {
    let builder = TlsConnector::builder();
    let connector = builder.build().map_err(|e| format!("TLS init error: {}", e))?;
    let tls = MakeTlsConnector::new(connector);

    let (client, connection) = tokio_postgres::connect(NEON_DB_URL, tls)
        .await
        .map_err(|e| format!("Gagal terhubung ke Neon Database: {}", e))?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("DB connection error: {}", e);
        }
    });

    Ok(client)
}

/// Verifikasi Lisensi langsung ke Neon PostgreSQL DB
pub async fn verify_online_license(
    app_handle: &tauri::AppHandle,
    email: &str,
    license_key: &str,
    current_machine_key: &str,
) -> Result<LicenseInfo, String> {
    let email_clean = email.trim().to_lowercase();
    let key_clean = license_key.trim().to_uppercase();

    // 1. Query Neon DB (case-insensitive for email and license_key)
    let client = get_db_client().await?;
    let rows = client.query(
        "SELECT email, machine_key, license_key, is_active, expires_at 
         FROM licenses WHERE LOWER(email) = $1 AND UPPER(license_key) = $2 LIMIT 1",
        &[&email_clean, &key_clean],
    ).await.map_err(|e| format!("Gagal query ke Neon DB: {}", e))?;

    if rows.is_empty() {
        return Err("License-key atau Email tidak ditemukan / tidak valid. Silakan beli lisensi baru.".to_string());
    }

    let row = &rows[0];
    let db_machine_key: String = row.get(1);
    let is_active: bool = row.get(3);
    let expires_at: DateTime<Utc> = row.get(4);

    // 2. Verifikasi 1: Flag Status di Database
    if !is_active {
        return Err("Lisensi Anda telah dinonaktifkan oleh admin. Silakan hubungi support / beli lisensi baru.".to_string());
    }

    // 3. Verifikasi 2: Masa berlaku
    let now = Utc::now();
    if now > expires_at {
        return Err(format!("Lisensi Anda telah kadaluarsa pada {}. Silakan perbarui lisensi.", expires_at.format("%d %B %Y")));
    }

    // 4. Verifikasi 3: Pengecekan Perangkat Keras (Hardware Fingerprint Match)
    if db_machine_key != current_machine_key {
        return Err("Penolakan Akses: License Key ini terikat pada perangkat lain! Perangkat keras Anda tidak cocok.".to_string());
    }

    // 5. Jika semua cocok: Simpan Cache Lokal Terenkripsi (AES-256-GCM)
    let payload = format!(
        "{}||{}||{}||{}",
        email_clean, current_machine_key, expires_at.timestamp(), key_clean
    );

    let enc_key_bytes = derive_enc_key(current_machine_key);
    let enc_key = Key::<Aes256Gcm>::from_slice(&enc_key_bytes);
    let cipher = Aes256Gcm::new(enc_key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, payload.as_bytes())
        .map_err(|e| format!("Enkripsi cache lisensi gagal: {}", e))?;

    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    let encoded = base64::engine::general_purpose::STANDARD.encode(&combined);

    let lic_path = license_path(app_handle);
    if let Some(parent) = lic_path.parent() {
        fs::create_dir_all(parent).ok();
    }
    fs::write(&lic_path, &encoded).map_err(|e| format!("Gagal menyimpan cache lisensi: {}", e))?;

    let days_remaining = (expires_at - now).num_days();

    Ok(LicenseInfo {
        valid: true,
        username: email_clean,
        expires_at: expires_at.format("%Y-%m-%d").to_string(),
        days_remaining,
        message: format!("Verifikasi Neon DB Sukses! Lisensi aktif hingga {}", expires_at.format("%d %B %Y")),
    })
}

/// Cek Lisensi Lokal + Re-verify Neon DB jika online
pub async fn check_license_hybrid(app_handle: &tauri::AppHandle, machine_key: &str) -> LicenseInfo {
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

    let combined = match base64::engine::general_purpose::STANDARD.decode(encoded.trim()) {
        Ok(v) => v,
        Err(_) => return not_valid("File lisensi corrupt."),
    };

    if combined.len() < 12 {
        return not_valid("File lisensi corrupt.");
    }

    let nonce = Nonce::from_slice(&combined[..12]);
    let ciphertext = &combined[12..];

    let enc_key_bytes = derive_enc_key(machine_key);
    let enc_key = Key::<Aes256Gcm>::from_slice(&enc_key_bytes);
    let cipher = Aes256Gcm::new(enc_key);

    let plaintext = match cipher.decrypt(nonce, ciphertext) {
        Ok(p) => p,
        Err(_) => return not_valid("Lisensi tidak valid untuk perangkat ini! Perangkat keras telah berubah."),
    };

    let payload = match String::from_utf8(plaintext) {
        Ok(s) => s,
        Err(_) => return not_valid("Lisensi corrupt."),
    };

    let parts: Vec<&str> = payload.splitn(4, "||").collect();
    if parts.len() < 4 {
        return not_valid("Format cache lisensi tidak valid.");
    }

    let email = parts[0];
    let stored_machine_key = parts[1];
    let expiry_epoch: i64 = parts[2].parse().unwrap_or(0);
    let license_key = parts[3];

    // Hardware Mismatch Check
    if stored_machine_key != machine_key {
        return not_valid("Lisensi ini terikat pada perangkat lain! Perangkat keras tidak cocok.");
    }

    // Cek Online Sync dengan Neon DB jika ada koneksi
    if let Ok(db_client) = get_db_client().await {
        if let Ok(rows) = db_client.query(
            "SELECT is_active, expires_at, machine_key FROM licenses WHERE LOWER(email) = $1 AND UPPER(license_key) = $2 LIMIT 1",
            &[&email, &license_key],
        ).await {
            if let Some(row) = rows.first() {
                let is_active: bool = row.get(0);
                let db_expires_at: DateTime<Utc> = row.get(1);
                let db_machine_key: String = row.get(2);

                if !is_active || db_machine_key != machine_key || Utc::now() > db_expires_at {
                    // Hapus cache lisensi lokal jika di-disable di Neon DB!
                    fs::remove_file(&lic_path).ok();
                    return not_valid("Lisensi telah dinonaktifkan / tidak valid di Neon DB. Silakan beli lisensi baru.");
                }
            } else {
                fs::remove_file(&lic_path).ok();
                return not_valid("Lisensi tidak ditemukan di Neon DB.");
            }
        }
    }

    let now = Utc::now();
    if now.timestamp() > expiry_epoch {
        return not_valid("Lisensi sudah kadaluarsa. Silakan perbarui lisensi Anda.");
    }

    let expires_at = chrono::DateTime::<Utc>::from_timestamp(expiry_epoch, 0).unwrap();
    let days_remaining = (expires_at - now).num_days();

    LicenseInfo {
        valid: true,
        username: email.to_string(),
        expires_at: expires_at.format("%Y-%m-%d").to_string(),
        days_remaining,
        message: format!("Lisensi aktif untuk {}. Berlaku {} hari lagi.", email, days_remaining),
    }
}
