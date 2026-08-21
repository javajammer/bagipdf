use hmac::{Hmac, Mac};
use sha2::Sha256;
use base64::Engine;
use chrono::{Utc, DateTime, Duration};

type HmacSha256 = Hmac<Sha256>;

// APP_SECRET: XOR-obfuscated. Jangan ubah urutan bytes ini.
// Plain: "BagiPDF_FRM_S3CR3T_K3Y_2026_08!"
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

/// Struktur token yang disimpan dalam payload terenkripsi
#[derive(Debug)]
pub struct TokenPayload {
    pub username: String,
    pub machine_key: String,
    pub expires_at: DateTime<Utc>,
}

/// Generate token HMAC-SHA256 dari machine_key + username + expiry
/// Token format: BPDF-XXXX-XXXX-XXXX-XXXX-XXXX (24 char payload, prefix BPDF)
pub fn generate_token(machine_key: &str, username: &str, duration_days: i64) -> (String, DateTime<Utc>) {
    let expires_at = Utc::now() + Duration::days(duration_days);
    let expiry_epoch = expires_at.timestamp();

    // Payload yang akan di-HMAC
    let message = format!("{}||{}||{}", machine_key, username, expiry_epoch);
    let secret = get_app_secret();

    let mut mac = HmacSha256::new_from_slice(&secret).expect("HMAC init failed");
    mac.update(message.as_bytes());
    let result = mac.finalize().into_bytes();

    // Encode sebagai base64url, ambil 20 char
    let b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(result);
    let payload_chars: String = b64.chars().take(20).collect();

    // Encode expiry sebagai 8 hex char (truncated epoch mod 0xFFFFFFFF)
    let epoch_hex = format!("{:08X}", expiry_epoch as u32);

    // Format final: BPDF-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX (prefix + 6 blok 4 char)
    // 4 dari epoch, 20 dari hmac = 24 total
    let combined = format!("{}{}", epoch_hex, payload_chars);
    let blocks: Vec<&str> = combined
        .as_bytes()
        .chunks(4)
        .map(|c| std::str::from_utf8(c).unwrap_or("0000"))
        .collect();

    let token = format!("BPDF-{}", blocks.join("-"));
    (token, expires_at)
}

/// Verifikasi token — return Some(TokenPayload) jika valid, None jika tidak
pub fn verify_token(token: &str, machine_key: &str, username: &str) -> Result<TokenPayload, String> {
    // Strip prefix BPDF-
    let stripped = token.trim().replace("BPDF-", "").replace("-", "");
    if stripped.len() < 28 {
        return Err("Format token tidak valid (terlalu pendek)".to_string());
    }

    // Ambil 8 char pertama = epoch hex
    let epoch_hex = &stripped[0..8];
    let epoch_u32 = u32::from_str_radix(epoch_hex, 16)
        .map_err(|_| "Token corrupt (epoch tidak valid)".to_string())?;

    // Rekonstruksi expiry timestamp
    // Karena kita truncate ke u32, kita perlu cari epoch >= sekarang-2tahun yang cocok
    let now_epoch = Utc::now().timestamp();
    let base = (now_epoch & (0xFFFF_FFFF_0000_0000_u64 as i64)) | (epoch_u32 as i64);
    let expiry_epoch = if base < now_epoch - 2 * 365 * 86400 {
        base + 0x1_0000_0000_i64
    } else {
        base
    };

    let expires_at = DateTime::<Utc>::from_timestamp(expiry_epoch, 0)
        .ok_or("Token corrupt (timestamp tidak valid)")?;

    // Verifikasi HMAC
    let message = format!("{}||{}||{}", machine_key, username, expiry_epoch);
    let secret = get_app_secret();
    let mut mac = HmacSha256::new_from_slice(&secret).expect("HMAC init failed");
    mac.update(message.as_bytes());
    let expected_result = mac.finalize().into_bytes();
    let expected_b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(expected_result);
    let expected_payload: String = expected_b64.chars().take(20).collect();
    let expected_combined = format!("{}{}", epoch_hex, expected_payload);

    if stripped != expected_combined {
        return Err(format!(
            "Token tidak valid untuk machine_key ini (machine_key mismatch atau token salah).\nExpected prefix: {}...\nGot: {}...",
            &expected_combined[..8.min(expected_combined.len())],
            &stripped[..8.min(stripped.len())]
        ));
    }

    // Cek expiry
    if Utc::now() > expires_at {
        return Err(format!("Token sudah kadaluarsa sejak {}", expires_at.format("%Y-%m-%d")));
    }

    Ok(TokenPayload {
        username: username.to_string(),
        machine_key: machine_key.to_string(),
        expires_at,
    })
}
