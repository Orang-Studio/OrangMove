use serde::Serialize;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
const DEFAULT_MAX_TOTAL: i64 = 20 * 1024 * 1024 * 1024; // 20 GiB
#[derive(Clone)]
pub struct Store {
    pub pool: SqlitePool,
    pub dir: PathBuf,
    pub max_total: i64,
}
#[derive(Serialize, sqlx::FromRow)]
pub struct Meta {
    pub name: String,
    pub content_type: String,
    pub size: i64,
    pub expires_at: i64,
}

impl Store {
    pub async fn new(dir: PathBuf, db_url: &str) -> Result<Self, sqlx::Error> {
        tokio::fs::create_dir_all(&dir).await.ok();
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(db_url)
            .await?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS files (
                token TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                content_type TEXT NOT NULL,
                size INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await?;
        let max_total = std::env::var("ORANG_MAX_TOTAL")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_MAX_TOTAL);
        Ok(Self { pool, dir, max_total })
    }

    pub fn with_max_total(mut self, bytes: i64) -> Self {self.max_total = bytes;self}

    // Bytes currently held by live files.
    pub async fn live_total(&self) -> Result<i64, sqlx::Error> {
        let (total,): (i64,) =
            sqlx::query_as("SELECT COALESCE(SUM(size),0) FROM files WHERE expires_at > ?")
                .bind(now_secs())
                .fetch_one(&self.pool)
                .await?;
        Ok(total)
    }

    // token is always validated by token::is_valid before we get here.
    pub fn path_for(&self, token: &str) -> PathBuf {
        self.dir.join(token)
    }

    pub async fn insert(&self,token: &str,name: &str,content_type: &str,size: i64,ttl: i64,) -> Result<(), sqlx::Error> { let now = now_secs(); sqlx::query("INSERT INTO files (token,name,content_type,size,created_at,expires_at) VALUES (?,?,?,?,?,?)",)
        .bind(token)
        .bind(name)
        .bind(content_type)
        .bind(size)
        .bind(now)
        .bind(now + ttl)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_live(&self, token: &str) -> Result<Option<Meta>, sqlx::Error> {
        sqlx::query_as(
            "SELECT name, content_type, size, expires_at FROM files 
            WHERE token = ? AND expires_at > ?",
        )
        .bind(token)
        .bind(now_secs())
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn reap(&self) -> Result<u64, sqlx::Error> {
        let cutoff = now_secs();
        let expired: Vec<(String,)> =
            sqlx::query_as("SELECT token FROM files WHERE expires_at <= ?")
                .bind(cutoff)
                .fetch_all(&self.pool)
                .await?;
        for (token,) in &expired {let _ = tokio::fs::remove_file(self.path_for(token)).await;}
        sqlx::query("DELETE FROM files WHERE expires_at <= ?")
            .bind(cutoff)
            .execute(&self.pool)
            .await?;
        Ok(expired.len() as u64)
    }
}

pub fn now_secs() -> i64 {
    time::OffsetDateTime::now_utc().unix_timestamp()
}

pub fn sanitize_name(name: &str) -> String {
    let base = Path::new(name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let cleaned: String = base
        .chars()
        .filter(|c| !c.is_control() && *c != '"' && *c != '\\')
        .take(200)
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {"file".into()} else {trimmed.to_owned()}
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sanitize_strips_paths_and_bad_chars() {
        assert_eq!(sanitize_name("../../etc/passwd"), "passwd");
        assert_eq!(sanitize_name("a\"b\\c.txt"), "abc.txt");
        assert_eq!(sanitize_name("   "), "file");
        assert_eq!(sanitize_name("photo.jpg"), "photo.jpg");
    }
}