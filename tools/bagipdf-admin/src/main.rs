mod fingerprint;
mod history;
mod keygen;

use chrono::Utc;
use clap::{Parser, Subcommand};
use history::HistoryEntry;

/// BagiPDF Admin CLI — Kelola lisensi akses menu Ebupot
#[derive(Parser)]
#[command(
    name = "bagipdf-admin",
    version = "1.0.0",
    author = "Muhammad Fahrizal Rahman",
    about = "Admin tool untuk generate & track token lisensi Ebupot BagiPDF"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate token lisensi baru untuk user
    Activate {
        /// Nama user (contoh: santi, budi, PT_MAJU)
        #[arg(short, long)]
        user: String,
        /// Machine Key dari perangkat user (dikirim via WhatsApp)
        #[arg(short, long)]
        machine_key: String,
        /// Durasi lisensi dalam hari (default: 365)
        #[arg(short, long, default_value_t = 365)]
        duration: i64,
        /// Catatan tambahan (opsional)
        #[arg(short, long)]
        notes: Option<String>,
    },
    /// Tampilkan semua riwayat lisensi
    List {
        /// Filter berdasarkan status (active/revoked/expired/semua)
        #[arg(short, long, default_value = "semua")]
        status: String,
    },
    /// Cek status lisensi user tertentu
    Check {
        /// Nama user yang ingin dicek
        #[arg(short, long)]
        user: String,
    },
    /// Verifikasi token yang diberikan user (cek apakah valid)
    Verify {
        /// Nama user
        #[arg(short, long)]
        user: String,
        /// Machine Key user
        #[arg(short, long)]
        machine_key: String,
        /// Token yang ingin diverifikasi
        #[arg(short, long)]
        token: String,
    },
    /// Cabut (revoke) akses user
    Revoke {
        /// Nama user yang ingin dicabut aksesnya
        #[arg(short, long)]
        user: String,
    },
    /// Generate Machine Key dari perangkat ini (untuk testing)
    Fingerprint,
    /// Tampilkan lokasi file history
    Info,
}

fn main() {
    let cli = Cli::parse();
    println!();

    match cli.command {
        Commands::Activate { user, machine_key, duration, notes } => {
            cmd_activate(&user, &machine_key, duration, notes);
        }
        Commands::List { status } => {
            cmd_list(&status);
        }
        Commands::Check { user } => {
            cmd_check(&user);
        }
        Commands::Verify { user, machine_key, token } => {
            cmd_verify(&user, &machine_key, &token);
        }
        Commands::Revoke { user } => {
            cmd_revoke(&user);
        }
        Commands::Fingerprint => {
            cmd_fingerprint();
        }
        Commands::Info => {
            cmd_info();
        }
    }

    println!();
}

fn cmd_activate(user: &str, machine_key: &str, duration: i64, notes: Option<String>) {
    println!("╔══════════════════════════════════════════════════╗");
    println!("║         🔑 GENERATE TOKEN LISENSI EBUPOT         ║");
    println!("╚══════════════════════════════════════════════════╝");
    println!();
    println!("  User         : {}", user);
    println!("  Machine Key  : {}...", &machine_key[..machine_key.len().min(16)]);
    println!("  Durasi       : {} hari", duration);

    // Cek apakah user sudah punya lisensi aktif
    let history = history::load_history();
    let existing = history.iter().find(|e| {
        e.user.to_lowercase() == user.to_lowercase()
            && e.machine_key == machine_key
            && e.status == "active"
    });

    if let Some(existing) = existing {
        println!();
        println!("  ⚠️  User ini sudah punya lisensi aktif!");
        println!("  Token lama  : {}", existing.token);
        println!("  Kadaluarsa  : {}", existing.expires_at.format("%Y-%m-%d"));
        println!();
        print!("  Lanjutkan generate ulang? (y/N): ");
        use std::io::{self, Write};
        io::stdout().flush().ok();
        let mut input = String::new();
        io::stdin().read_line(&mut input).ok();
        if !input.trim().to_lowercase().starts_with('y') {
            println!("  Dibatalkan.");
            return;
        }
    }

    // Generate token
    let (token, expires_at) = keygen::generate_token(machine_key, user, duration);

    println!();
    println!("  ✅ TOKEN BERHASIL DIGENERATE:");
    println!();
    println!("  ┌─────────────────────────────────────────────┐");
    println!("  │  {}  │", token);
    println!("  └─────────────────────────────────────────────┘");
    println!();
    println!("  Berlaku s/d  : {}", expires_at.format("%d %B %Y"));
    println!("  Kadaluarsa   : {} hari lagi", duration);
    println!();
    println!("  📱 Kirim token di atas ke user via WhatsApp.");

    // Simpan ke history
    let entry = HistoryEntry {
        user: user.to_string(),
        machine_key: machine_key.to_string(),
        token,
        issued_at: Utc::now(),
        expires_at,
        status: "active".to_string(),
        duration_days: duration,
        notes,
    };
    history::add_entry(entry);
    println!("  💾 History disimpan ke: {}", history::history_path_display());
}

fn cmd_list(filter_status: &str) {
    println!("╔══════════════════════════════════════════════════╗");
    println!("║          📋 RIWAYAT LISENSI EBUPOT               ║");
    println!("╚══════════════════════════════════════════════════╝");
    println!();

    let mut history = history::load_history();

    // Update status expired
    let now = Utc::now();
    for entry in &mut history {
        if entry.status == "active" && now > entry.expires_at {
            entry.status = "expired".to_string();
        }
    }
    history::save_history(&history);

    let filtered: Vec<_> = history.iter().filter(|e| {
        filter_status == "semua" || e.status == filter_status
    }).collect();

    if filtered.is_empty() {
        println!("  (Tidak ada data)");
        return;
    }

    println!("  {:<15} {:<12} {:<12} {:<10} {}",
        "USER", "STATUS", "BERLAKU S/D", "DURASI", "TOKEN");
    println!("  {}", "─".repeat(75));

    for entry in &filtered {
        let status_icon = match entry.status.as_str() {
            "active" => "✅ active ",
            "revoked" => "🚫 revoked",
            _ => "⏰ expired",
        };
        println!("  {:<15} {} {:<12} {:<5} hari  {}",
            entry.user,
            status_icon,
            entry.expires_at.format("%Y-%m-%d"),
            entry.duration_days,
            entry.token
        );
        if let Some(notes) = &entry.notes {
            println!("  {:<15}              Catatan: {}", "", notes);
        }
    }

    println!();
    println!("  Total: {} lisensi", filtered.len());
}

fn cmd_check(user: &str) {
    println!("╔══════════════════════════════════════════════════╗");
    println!("║            🔍 CEK STATUS LISENSI                 ║");
    println!("╚══════════════════════════════════════════════════╝");
    println!();

    let history = history::load_history();
    let entries: Vec<_> = history.iter()
        .filter(|e| e.user.to_lowercase() == user.to_lowercase())
        .collect();

    if entries.is_empty() {
        println!("  ❌ User '{}' tidak ditemukan dalam history.", user);
        return;
    }

    for entry in &entries {
        let now = Utc::now();
        let is_expired = now > entry.expires_at;
        let effective_status = if entry.status == "active" && is_expired {
            "expired"
        } else {
            &entry.status
        };

        println!("  User          : {}", entry.user);
        println!("  Machine Key   : {}...", &entry.machine_key[..entry.machine_key.len().min(20)]);
        println!("  Token         : {}", entry.token);
        println!("  Diterbitkan   : {}", entry.issued_at.format("%d %B %Y %H:%M UTC"));
        println!("  Kadaluarsa    : {}", entry.expires_at.format("%d %B %Y"));
        println!("  Status        : {}", match effective_status {
            "active" => "✅ AKTIF",
            "revoked" => "🚫 DICABUT",
            _ => "⏰ KADALUARSA",
        });
        if effective_status == "active" {
            let remaining = entry.expires_at - now;
            println!("  Sisa          : {} hari", remaining.num_days());
        }
        if let Some(notes) = &entry.notes {
            println!("  Catatan       : {}", notes);
        }
        println!();
    }
}

fn cmd_verify(user: &str, machine_key: &str, token: &str) {
    println!("╔══════════════════════════════════════════════════╗");
    println!("║           ✔️  VERIFIKASI TOKEN                    ║");
    println!("╚══════════════════════════════════════════════════╝");
    println!();

    match keygen::verify_token(token, machine_key, user) {
        Ok(payload) => {
            println!("  ✅ Token VALID!");
            println!();
            println!("  User          : {}", payload.username);
            println!("  Machine Key   : {}...", &payload.machine_key[..payload.machine_key.len().min(20)]);
            println!("  Kadaluarsa    : {}", payload.expires_at.format("%d %B %Y"));
            let remaining = payload.expires_at - Utc::now();
            println!("  Sisa          : {} hari", remaining.num_days());
        }
        Err(e) => {
            println!("  ❌ Token TIDAK VALID!");
            println!();
            println!("  Alasan: {}", e);
        }
    }
}

fn cmd_revoke(user: &str) {
    println!("╔══════════════════════════════════════════════════╗");
    println!("║             🚫 REVOKE AKSES USER                 ║");
    println!("╚══════════════════════════════════════════════════╝");
    println!();

    if history::revoke_user(user) {
        println!("  ✅ Akses user '{}' berhasil dicabut.", user);
        println!("  Catatan: User perlu memasukkan token baru untuk aktivasi ulang.");
    } else {
        println!("  ❌ User '{}' tidak ditemukan atau tidak memiliki lisensi aktif.", user);
    }
}

fn cmd_fingerprint() {
    println!("╔══════════════════════════════════════════════════╗");
    println!("║          🖥️  MACHINE KEY PERANGKAT INI            ║");
    println!("╚══════════════════════════════════════════════════╝");
    println!();
    println!("  Mengumpulkan data hardware...");

    let raw_key = fingerprint::collect_machine_key();
    let display_key = fingerprint::format_machine_key_display(&raw_key);

    println!();
    println!("  Machine Key (Full)    : {}", raw_key);
    println!("  Machine Key (Display) : {}", display_key);
    println!();
    println!("  Gunakan Machine Key (Full) saat generate token.");
}

fn cmd_info() {
    println!("╔══════════════════════════════════════════════════╗");
    println!("║              ℹ️  INFORMASI SISTEM                  ║");
    println!("╚══════════════════════════════════════════════════╝");
    println!();
    println!("  History file  : {}", history::history_path_display());
    println!("  Tool version  : 1.0.0");
    println!("  App target    : BagiPDF v2.3.x");
    println!();
    println!("  Contoh penggunaan:");
    println!("  $ ./bagipdf-admin activate --user santi --machine-key <KEY> --duration 365");
    println!("  $ ./bagipdf-admin list");
    println!("  $ ./bagipdf-admin check --user santi");
    println!("  $ ./bagipdf-admin revoke --user santi");
    println!("  $ ./bagipdf-admin fingerprint");
}
