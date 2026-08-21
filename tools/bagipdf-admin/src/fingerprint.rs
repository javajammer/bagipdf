use sha2::{Sha256, Digest};
use std::fs;

/// Kumpulkan identifier hardware cross-platform dan return SHA-256 fingerprint.
/// Sama persis dengan logic di app BagiPDF agar machine_key cocok.
pub fn collect_machine_key() -> String {
    let mut parts: Vec<String> = Vec::new();

    // 1. Machine UID (cross-platform, paling stabil)
    if let Ok(uid) = machine_uid() {
        if !uid.is_empty() { parts.push(uid); }
    }

    // 2. MAC Address
    if let Ok(Some(mac)) = mac_address::get_mac_address() {
        parts.push(mac.to_string());
    }

    // 3. Platform-specific identifiers
    #[cfg(target_os = "linux")]
    {
        for path in [
            "/sys/class/dmi/id/product_uuid",
            "/sys/class/dmi/id/board_serial",
            "/sys/class/dmi/id/product_serial",
            "/etc/machine-id",
        ] {
            if let Ok(val) = fs::read_to_string(path) {
                let v = val.trim().to_string();
                if !v.is_empty() && v != "None" && v != "To Be Filled By O.E.M." {
                    parts.push(v);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let queries = [
            ("wmic", vec!["bios", "get", "SerialNumber", "/value"]),
            ("wmic", vec!["baseboard", "get", "SerialNumber", "/value"]),
            ("wmic", vec!["cpu", "get", "ProcessorId", "/value"]),
        ];
        for (cmd, args) in &queries {
            if let Ok(out) = Command::new(cmd).args(args).output() {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines() {
                    if let Some(val) = line.split('=').nth(1) {
                        let v = val.trim().to_string();
                        if !v.is_empty() && v != "None" && v != "To Be Filled By O.E.M." {
                            parts.push(v);
                        }
                    }
                }
            }
        }
        // Machine GUID from registry
        if let Ok(out) = Command::new("reg")
            .args(["query", r"HKLM\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"])
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if line.contains("MachineGuid") {
                    if let Some(guid) = line.split_whitespace().last() {
                        parts.push(guid.to_string());
                    }
                }
            }
        }
    }

    // 4. CPU brand via sysinfo
    let mut sys = sysinfo::System::new();
    sys.refresh_cpu_all();
    if let Some(cpu) = sys.cpus().first() {
        let brand = cpu.brand().trim().to_string();
        if !brand.is_empty() {
            parts.push(brand);
        }
    }

    // Hash semua parts
    let raw = parts.join("||");
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}

/// Baca machine-id cross-platform
fn machine_uid() -> Result<String, Box<dyn std::error::Error>> {
    #[cfg(target_os = "linux")]
    {
        let uid = fs::read_to_string("/etc/machine-id")?.trim().to_string();
        return Ok(uid);
    }
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let out = Command::new("reg")
            .args(["query", r"HKLM\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"])
            .output()?;
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            if line.contains("MachineGuid") {
                if let Some(guid) = line.split_whitespace().last() {
                    return Ok(guid.to_string());
                }
            }
        }
    }
    Ok(String::new())
}

/// Format fingerprint 64-char hex menjadi tampilan user-friendly 8-4-4-4-12
pub fn format_machine_key_display(raw_hex: &str) -> String {
    // Ambil 32 char pertama, format sebagai 8-4-4-4-4
    let chars: Vec<char> = raw_hex.to_uppercase().chars().take(24).collect();
    let s: String = chars.into_iter().collect();
    if s.len() >= 24 {
        format!("{}-{}-{}-{}-{}-{}",
            &s[0..4], &s[4..8], &s[8..12], &s[12..16], &s[16..20], &s[20..24])
    } else {
        s
    }
}
