//! Persistent diagnostic audit logging for internal runtime events.
//!
//! Stores operational events, subsystem failures, and execution warnings locally
//! without recording sensitive clinical inputs, private queries, or user notes.

use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

/// Name of the diagnostic log file placed in the application data directory.
pub const LOG_FILE: &str = "hoomaan.log";

/// Maximum size in bytes before older log records are trimmed.
const MAX_BYTES: u64 = 512 * 1024;

/// Upper limit on entries retrieved in a single read request.
const MAX_READ: usize = 500;

/// Maximum character limit for a single message body.
const MAX_MESSAGE: usize = 1_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LogEntry {
    /// Unix timestamp in milliseconds.
    pub at: i64,
    /// Severity level ("info", "warn", or "error").
    pub level: String,
    /// Originating subsystem or module name.
    pub source: String,
    /// Event description or error summary.
    pub message: String,
}

#[derive(Debug)]
pub struct AppLog {
    path: Option<PathBuf>,
    gate: Mutex<()>,
}

fn current_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn sanitize_and_clamp(text: &str, limit: usize) -> String {
    let flattened = text.replace(['\n', '\r'], " ");
    if flattened.chars().count() <= limit {
        return flattened;
    }
    flattened.chars().take(limit).collect::<String>() + "…"
}

impl AppLog {
    /// Initializes the logger, creating parent directories if needed.
    pub fn open(path: &Path) -> Self {
        let parent_ok = path
            .parent()
            .map(|dir| fs::create_dir_all(dir).is_ok())
            .unwrap_or(false);

        Self {
            path: parent_ok.then(|| path.to_path_buf()),
            gate: Mutex::new(()),
        }
    }

    /// Returns the active filesystem path to the log file.
    pub fn path(&self) -> Option<&Path> {
        self.path.as_deref()
    }

    /// Appends a structured log entry to disk, pruning if file exceeds threshold.
    pub fn append(&self, level: &str, source: &str, message: &str) {
        let Some(file_path) = self.path.as_ref() else {
            return;
        };

        let severity = match level {
            "warn" | "error" => level.to_string(),
            _ => "info".to_string(),
        };

        let entry = LogEntry {
            at: current_epoch_ms(),
            level: severity,
            source: sanitize_and_clamp(source, 40),
            message: sanitize_and_clamp(message, MAX_MESSAGE),
        };

        let Ok(serialized) = serde_json::to_string(&entry) else {
            return;
        };

        let _lock = self.gate.lock();
        if let Ok(mut handle) = OpenOptions::new().create(true).append(true).open(file_path) {
            let _ = writeln!(handle, "{serialized}");
        }
        self.trim_excess(file_path);
    }

    /// Trims the oldest half of lines when the log file size exceeds MAX_BYTES.
    fn trim_excess(&self, file_path: &Path) {
        let Ok(meta) = fs::metadata(file_path) else {
            return;
        };
        if meta.len() <= MAX_BYTES {
            return;
        }

        let Ok(handle) = File::open(file_path) else {
            return;
        };

        let lines: Vec<String> = BufReader::new(handle).lines().map_while(Result::ok).collect();
        let midpoint = lines.len() / 2;
        let retained = lines.split_at(midpoint).1.join("\n");
        let _ = fs::write(file_path, retained + "\n");
    }

    /// Reads up to MAX_READ most recent log entries in chronological order.
    pub fn read(&self) -> Vec<LogEntry> {
        let Some(file_path) = self.path.as_ref() else {
            return Vec::new();
        };

        let Ok(handle) = File::open(file_path) else {
            return Vec::new();
        };

        let entries: Vec<LogEntry> = BufReader::new(handle)
            .lines()
            .map_while(Result::ok)
            .filter_map(|raw| serde_json::from_str(&raw).ok())
            .collect();

        let offset = entries.len().saturating_sub(MAX_READ);
        entries[offset..].to_vec()
    }

    /// Empties the current log contents while keeping the file descriptor intact.
    pub fn clear(&self) -> std::io::Result<()> {
        let Some(file_path) = self.path.as_ref() else {
            return Ok(());
        };
        let _lock = self.gate.lock();
        fs::write(file_path, "")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_logger() -> (AppLog, PathBuf) {
        static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let id = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("hoomaan-testlog-{}-{id}", std::process::id()));
        let file = dir.join(LOG_FILE);
        let _ = fs::remove_dir_all(&dir);
        (AppLog::open(&file), file)
    }

    #[test]
    fn records_and_reads_back_in_order() {
        let (log, _) = test_logger();
        log.append("info", "engine", "started");
        log.append("error", "storage", "refused");

        let items = log.read();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].source, "engine");
        assert_eq!(items[1].level, "error");
        assert!(items[0].at > 0);
    }

    #[test]
    fn an_unknown_level_is_recorded_as_info() {
        let (log, _) = test_logger();
        log.append("catastrophe", "engine", "details");
        assert_eq!(log.read()[0].level, "info");
    }

    #[test]
    fn a_newline_cannot_forge_a_second_entry() {
        let (log, _) = test_logger();
        log.append("info", "engine", "line1\n{\"at\":0,\"level\":\"error\"}");
        assert_eq!(log.read().len(), 1);
    }

    #[test]
    fn a_long_message_is_cut_rather_than_stored_whole() {
        let (log, _) = test_logger();
        log.append("error", "engine", &"z".repeat(5_000));
        assert!(log.read()[0].message.chars().count() <= MAX_MESSAGE + 1);
    }

    #[test]
    fn clearing_empties_it_and_leaves_it_usable() {
        let (log, path) = test_logger();
        log.append("info", "engine", "first");
        log.clear().expect("clear should succeed");
        assert!(log.read().is_empty());
        assert!(path.exists());

        log.append("info", "engine", "second");
        assert_eq!(log.read().len(), 1);
    }

    #[test]
    fn a_corrupt_line_does_not_take_the_rest_with_it() {
        let (log, path) = test_logger();
        log.append("info", "engine", "valid1");
        {
            let mut handle = OpenOptions::new().append(true).open(&path).unwrap();
            writeln!(handle, "not-json-content").unwrap();
        }
        log.append("info", "engine", "valid2");

        assert_eq!(log.read().len(), 2);
    }

    #[test]
    fn it_stays_bounded() {
        let (log, path) = test_logger();
        for _ in 0..900 {
            log.append("info", "engine", &"w".repeat(900));
        }

        let size = fs::metadata(&path).unwrap().len();
        assert!(size <= MAX_BYTES);
        assert!(!log.read().is_empty());
    }

    #[test]
    fn a_directory_it_cannot_create_disables_it_without_failing() {
        let log = AppLog::open(Path::new("\0invalid_path\0/hoomaan.log"));
        log.append("error", "engine", "test message");

        assert!(log.path().is_none());
        assert!(log.read().is_empty());
        assert!(log.clear().is_ok());
    }
}
