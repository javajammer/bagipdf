use tokio_postgres::{Client, NoTls};
use postgres_native_tls::MakeTlsConnector;
use native_tls::TlsConnector;
use chrono::{DateTime, Utc};

const NEON_DB_URL: &str = "postgresql://neondb_owner:npg_fUByRKpo6sF1@ep-morning-frog-azz98qvs-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

pub async fn get_db_client() -> Result<Client, String> {
    let builder = TlsConnector::builder();
    let connector = builder.build().map_err(|e| format!("TLS connector init failed: {}", e))?;
    let tls = MakeTlsConnector::new(connector);

    let (client, connection) = tokio_postgres::connect(NEON_DB_URL, tls)
        .await
        .map_err(|e| format!("Koneksi ke Neon DB gagal: {}", e))?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("DB connection error: {}", e);
        }
    });

    Ok(client)
}

#[derive(Debug)]
pub struct DbLicenseRecord {
    pub id: i32,
    pub email: String,
    pub machine_key: String,
    pub license_key: String,
    pub is_active: bool,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub notes: Option<String>,
}

pub async fn db_upsert_license(
    email: &str,
    machine_key: &str,
    license_key: &str,
    duration_days: i64,
    notes: Option<&str>,
) -> Result<DateTime<Utc>, String> {
    let client = get_db_client().await?;
    let expires_at = Utc::now() + chrono::Duration::days(duration_days);

    client.execute(
        "INSERT INTO licenses (email, machine_key, license_key, is_active, issued_at, expires_at, notes)
         VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP, $4, $5)
         ON CONFLICT (email, machine_key) DO UPDATE SET
            license_key = EXCLUDED.license_key,
            is_active = TRUE,
            issued_at = CURRENT_TIMESTAMP,
            expires_at = EXCLUDED.expires_at,
            notes = EXCLUDED.notes",
        &[&email, &machine_key, &license_key, &expires_at, &notes],
    ).await.map_err(|e| format!("Gagal memperbarui Neon DB: {}", e))?;

    Ok(expires_at)
}

pub async fn db_toggle_license_status(email: &str, enable: bool) -> Result<bool, String> {
    let client = get_db_client().await?;
    let rows_affected = client.execute(
        "UPDATE licenses SET is_active = $1 WHERE LOWER(email) = LOWER($2)",
        &[&enable, &email],
    ).await.map_err(|e| format!("Gagal update status DB: {}", e))?;

    Ok(rows_affected > 0)
}

pub async fn db_list_licenses(status_filter: &str) -> Result<Vec<DbLicenseRecord>, String> {
    let client = get_db_client().await?;
    let rows = client.query(
        "SELECT id, email, machine_key, license_key, is_active, issued_at, expires_at, notes 
         FROM licenses ORDER BY id DESC",
        &[],
    ).await.map_err(|e| format!("Gagal fetch lisensi dari DB: {}", e))?;

    let now = Utc::now();
    let mut records = Vec::new();
    for row in rows {
        let is_active: bool = row.get(4);
        let expires_at: DateTime<Utc> = row.get(6);
        let effective_status = if is_active && now <= expires_at {
            "active"
        } else if !is_active {
            "revoked"
        } else {
            "expired"
        };

        if status_filter == "semua" || status_filter == effective_status {
            records.push(DbLicenseRecord {
                id: row.get(0),
                email: row.get(1),
                machine_key: row.get(2),
                license_key: row.get(3),
                is_active,
                issued_at: row.get(5),
                expires_at,
                notes: row.get(7),
            });
        }
    }
    Ok(records)
}

pub async fn db_get_user_license(email: &str) -> Result<Option<DbLicenseRecord>, String> {
    let client = get_db_client().await?;
    let rows = client.query(
        "SELECT id, email, machine_key, license_key, is_active, issued_at, expires_at, notes 
         FROM licenses WHERE LOWER(email) = LOWER($1) LIMIT 1",
        &[&email],
    ).await.map_err(|e| format!("Gagal query DB: {}", e))?;

    if let Some(row) = rows.first() {
        Ok(Some(DbLicenseRecord {
            id: row.get(0),
            email: row.get(1),
            machine_key: row.get(2),
            license_key: row.get(3),
            is_active: row.get(4),
            issued_at: row.get(5),
            expires_at: row.get(6),
            notes: row.get(7),
        }))
    } else {
        Ok(None)
    }
}
