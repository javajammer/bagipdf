use chrono::{DateTime, Utc, serde::ts_seconds};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    pub user: String,
    pub machine_key: String,
    pub token: String,
    #[serde(with = "ts_seconds")]
    pub issued_at: DateTime<Utc>,
    #[serde(with = "ts_seconds")]
    pub expires_at: DateTime<Utc>,
    pub status: String, // "active" | "revoked" | "expired"
    pub duration_days: i64,
    pub notes: Option<String>,
}

fn history_path() -> PathBuf {
    let dir = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".bagipdf-admin");
    fs::create_dir_all(&dir).ok();
    dir.join("history.json")
}

pub fn load_history() -> Vec<HistoryEntry> {
    let path = history_path();
    if !path.exists() {
        return Vec::new();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_history(entries: &[HistoryEntry]) {
    let path = history_path();
    let json = serde_json::to_string_pretty(entries).unwrap_or_default();
    fs::write(&path, json).ok();
}

pub fn add_entry(entry: HistoryEntry) {
    let mut history = load_history();
    // Hapus entry lama dengan user+machine_key yang sama
    history.retain(|e| !(e.user == entry.user && e.machine_key == entry.machine_key));
    history.push(entry);
    save_history(&history);
}

pub fn revoke_user(username: &str) -> bool {
    let mut history = load_history();
    let mut found = false;
    for entry in &mut history {
        if entry.user.to_lowercase() == username.to_lowercase() && entry.status == "active" {
            entry.status = "revoked".to_string();
            found = true;
        }
    }
    if found {
        save_history(&history);
    }
    found
}

pub fn history_path_display() -> String {
    history_path().to_string_lossy().to_string()
}
