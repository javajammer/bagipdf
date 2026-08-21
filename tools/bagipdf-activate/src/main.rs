use clap::Parser;
use sha2::{Digest, Sha256};
use sysinfo::System;

/// BagiPDF Client Activation Tool — Ekstrak Machine Key Perangkat
#[derive(Parser)]
#[command(
    name = "bagipdf-activate",
    version = "1.0.0",
    author = "Muhammad Fahrizal Rahman",
    about = "Utility client untuk mendapatkan Machine Key perangkat unik"
)]
struct Cli {
    /// Email pengguna (contoh: santi@gmail.com)
    #[arg(short, long)]
    user: String,
}

fn collect_machine_key() -> String {
    let mut sys = System::new_all();
    sys.refresh_all();

    let mut parts: Vec<String> = Vec::new();

    // 1. Machine ID / OS Serial
    if let Some(id) = sysinfo::System::host_name() {
        parts.push(id);
    }

    // 2. MAC Address
    if let Ok(Some(mac)) = mac_address::get_mac_address() {
        parts.push(mac.to_string());
    }

    // 3. CPU Info
    if let Some(cpu) = sys.cpus().first() {
        parts.push(cpu.brand().to_string());
    }

    // Fallback if empty
    if parts.is_empty() {
        parts.push("BAGIPDF-FALLBACK-HW-KEY-V1".to_string());
    }

    let combined = parts.join("::");
    let mut hasher = Sha256::new();
    hasher.update(b"BagiPDF-HW-SALT-2026:");
    hasher.update(combined.as_bytes());
    hex::encode(hasher.finalize())
}

fn format_display_key(raw_hex: &str) -> String {
    if raw_hex.len() < 24 {
        return raw_hex.to_uppercase();
    }
    let chunks: Vec<&str> = (0..24)
        .step_by(4)
        .map(|i| &raw_hex[i..i + 4])
        .collect();
    chunks.join("-").to_uppercase()
}

fn main() {
    let cli = Cli::parse();
    let raw_key = collect_machine_key();
    let display_key = format_display_key(&raw_key);

    println!();
    println!("╔═════════════════════════════════════════════════════════════════╗");
    println!("║       🖥️  BAGIPDF ACTIVATION TOOL - MACHINE KEY PERANGKAT       ║");
    println!("╚═════════════════════════════════════════════════════════════════╝");
    println!();
    println!("  User / Email    : {}", cli.user);
    println!("  Machine Key     : {}", display_key);
    println!("  Machine Key Raw : {}", raw_key);
    println!();
    println!("  ───────────────────────────────────────────────────────────────");
    println!("  📱 LANGKAH SELANJUTNYA:");
    println!("     Kirimkan Email ({}) dan Machine Key di atas ke Admin via Email / WA.", cli.user);
    println!("     Admin akan mengaktifkan lisensi Anda dan memberikan User License Key.");
    println!("  ───────────────────────────────────────────────────────────────");
    println!();
}
