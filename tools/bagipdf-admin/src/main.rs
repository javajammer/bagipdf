mod fingerprint;
mod history;
mod keygen;
mod db;

use chrono::Utc;
use clap::{Parser, Subcommand};

/// BagiPDF Admin CLI — Kelola lisensi akses menu Ebupot (Neon DB Integrated)
#[derive(Parser)]
#[command(
    name = "bagipdf-admin",
    version = "2.0.0",
    author = "Muhammad Fahrizal Rahman",
    about = "Admin tool untuk mengaktifkan & mengelola lisensi Ebupot BagiPDF di Neon DB"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Aktifkan lisensi user di Neon DB (Flag IS_ACTIVE = TRUE)
    Activate {
        /// Alamat email user (contoh: santi@gmail.com)
        #[arg(short, long)]
        email: String,
        /// Machine Key perangkat user (dikirim via Email/WA)
        #[arg(short, long)]
        machine_key: String,
        /// Durasi lisensi dalam hari (default: 365)
        #[arg(short, long, default_value_t = 365)]
        duration: i64,
        /// Catatan tambahan (opsional)
        #[arg(short, long)]
        notes: Option<String>,
    },
    /// Nonaktifkan / Matikan flag lisensi user di Neon DB (Flag IS_ACTIVE = FALSE)
    Disable {
        /// Alamat email user yang akan dimatikan lisensinya
        #[arg(short, long)]
        email: String,
    },
    /// Tampilkan semua lisensi aktif/revoked/expired di Neon DB
    List {
        /// Filter berdasarkan status (active/revoked/expired/semua)
        #[arg(short, long, default_value = "semua")]
        status: String,
    },
    /// Cek status lisensi user tertentu di Neon DB
    Check {
        /// Email user yang ingin dicek
        #[arg(short, long)]
        email: String,
    },
    /// Generate Machine Key dari perangkat ini (untuk testing)
    Fingerprint,
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    println!();

    match cli.command {
        Commands::Activate { email, machine_key, duration, notes } => {
            cmd_activate(&email, &machine_key, duration, notes.as_deref()).await;
        }
        Commands::Disable { email } => {
            cmd_disable(&email).await;
        }
        Commands::List { status } => {
            cmd_list(&status).await;
        }
        Commands::Check { email } => {
            cmd_check(&email).await;
        }
        Commands::Fingerprint => {
            cmd_fingerprint();
        }
    }

    println!();
}

async fn cmd_activate(email: &str, machine_key: &str, duration: i64, notes: Option<&str>) {
    println!("╔══════════════════════════════════════════════════╗");
    println!("║       🔑 AKTIFKAN LISENSI NEON DB (EBUPOT)       ║");
    println!("╚══════════════════════════════════════════════════╝");
    println!();
    println!("  Email        : {}", email);
    println!("  Machine Key  : {}...", &machine_key[..machine_key.len().min(16)]);
    println!("  Durasi       : {} hari", duration);
    println!("  Menghubungi Neon DB...");

    // Generate license_key HMAC
    let (license_key, _) = keygen::generate_token(machine_key, email, duration);

    match db::db_upsert_license(email, machine_key, &license_key, duration, notes).await {
        Ok(expires_at) => {
            println!();
            println!("  ✅ LISENSI BERHASIL DIAKTIFKAN & FLAG NEON DB = ENABLED!");
            println!();
            println!("  ┌─────────────────────────────────────────────┐");
            println!("  │  User License Key:                           │");
            println!("  │  {}  │", license_key);
            println!("  └─────────────────────────────────────────────┘");
            println!();
            println!("  Berlaku s/d  : {}", expires_at.format("%d %B %Y"));
            println!();
            println!("  📱 Berikan Email ({}) & License Key di atas ke pelanggan.", email);
        }
        Err(e) => {
            println!();
            println!("  ❌ GAGAL AKTIFKAN LISENSI DI NEON DB:");
            println!("     {}", e);
        }
    }
}

async fn cmd_disable(email: &str) {
    println!("╔══════════════════════════════════════════════════╗");
    println!("║      🚫 MATIKAN FLAG LISENSI NEON DB (DISABLE)   ║");
    println!("╚══════════════════════════════════════════════════╝");
    println!();
    println!("  Email        : {}", email);
    println!("  Mengubah flag IS_ACTIVE = FALSE di Neon DB...");

    match db::db_toggle_license_status(email, false).await {
        Ok(true) => {
            println!();
            println!("  ✅ Lisensi untuk '{}' BERHASIL DIMATIKAN (DISABLED)!", email);
            println!("  Aplikasi BagiPDF desktop milik user tidak akan bisa membuka menu Ebupot.");
        }
        Ok(false) => {
            println!();
            println!("  ⚠️ Email '{}' tidak ditemukan di Neon DB.", email);
        }
        Err(e) => {
            println!();
            println!("  ❌ Gagal mengubah status di Neon DB: {}", e);
        }
    }
}

async fn cmd_list(filter_status: &str) {
    println!("╔══════════════════════════════════════════════════╗");
    println!("║          📋 DAFTAR LISENSI NEON DB               ║");
    println!("╚══════════════════════════════════════════════════╝");
    println!();

    match db::db_list_licenses(filter_status).await {
        Ok(records) => {
            if records.is_empty() {
                println!("  (Tidak ada data lisensi)");
                return;
            }
            println!("  {:<25} {:<12} {:<12} {}", "EMAIL", "STATUS", "EXPIRES AT", "LICENSE KEY");
            println!("  {}", "─".repeat(75));

            for r in &records {
                let status_str = if r.is_active && Utc::now() <= r.expires_at {
                    "✅ ENABLED "
                } else if !r.is_active {
                    "🚫 DISABLED"
                } else {
                    "⏰ EXPIRED "
                };
                println!("  {:<25} {} {:<12} {}",
                    r.email, status_str, r.expires_at.format("%Y-%m-%d"), r.license_key
                );
            }
            println!();
            println!("  Total: {} record", records.len());
        }
        Err(e) => {
            println!("  ❌ Gagal fetch data dari Neon DB: {}", e);
        }
    }
}

async fn cmd_check(email: &str) {
    println!("╔══════════════════════════════════════════════════╗");
    println!("║         🔍 CEK LISENSI USER NEON DB              ║");
    println!("╚══════════════════════════════════════════════════╝");
    println!();

    match db::db_get_user_license(email).await {
        Ok(Some(r)) => {
            let now = Utc::now();
            let is_valid = r.is_active && now <= r.expires_at;
            println!("  Email        : {}", r.email);
            println!("  Machine Key  : {}...", &r.machine_key[..r.machine_key.len().min(20)]);
            println!("  License Key  : {}", r.license_key);
            println!("  Expires At   : {}", r.expires_at.format("%d %B %Y"));
            println!("  Flag DB      : {}", if r.is_active { "ENABLED (TRUE)" } else { "DISABLED (FALSE)" });
            println!("  Status Final : {}", if is_valid { "✅ AKTIF & VALID" } else { "❌ TIDAK VALID / MATI" });
        }
        Ok(None) => {
            println!("  ❌ Email '{}' tidak ditemukan di Neon DB.", email);
        }
        Err(e) => {
            println!("  ❌ Error DB: {}", e);
        }
    }
}

fn cmd_fingerprint() {
    println!("╔══════════════════════════════════════════════════╗");
    println!("║          🖥️  MACHINE KEY PERANGKAT INI            ║");
    println!("╚══════════════════════════════════════════════════╝");
    println!();
    let raw_key = fingerprint::collect_machine_key();
    let display_key = fingerprint::format_machine_key_display(&raw_key);
    println!("  Machine Key (Full)    : {}", raw_key);
    println!("  Machine Key (Display) : {}", display_key);
}
