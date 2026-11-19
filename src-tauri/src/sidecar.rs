//! Python AI engine sidecar lifecycle and process supervision.
//!
//! Spawns and manages the dedicated Python sidecar binary using standard IO pipes.
//! Relays JSON-RPC protocol frames directly to the frontend event bus and isolates
//! API credentials within OS-level memory rather than exposing them over local network ports.

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::Mutex;

use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

/// Target directory staging the sidecar distribution bundle.
const ENGINE_DIR: &str = "hoomaan-engine";

#[cfg(windows)]
const ENGINE_EXE: &str = "hoomaan-engine.exe";
#[cfg(not(windows))]
const ENGINE_EXE: &str = "hoomaan-engine";

/// Standard Tauri application event channel delivering sidecar frames.
pub const ENGINE_EVENT: &str = "hoomaan://engine-event";

#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error("the analysis engine is not running")]
    NotRunning,
    #[error("the analysis engine binary was not found at {0}. Run `pnpm sidecar:build`.")]
    Missing(String),
    #[error("failed to start the analysis engine: {0}")]
    Spawn(String),
    #[error("failed to send request to the analysis engine: {0}")]
    Write(String),
    #[error("{0}")]
    Internal(String),
}

impl serde::Serialize for EngineError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub struct EngineHandle {
    inner: Mutex<Option<Running>>,
    ready: AtomicBool,
    last_error: Mutex<Option<String>>,
    protocol: AtomicI64,
}

const NO_PROTOCOL: i64 = -1;

impl Default for EngineHandle {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
            ready: AtomicBool::new(false),
            last_error: Mutex::new(None),
            protocol: AtomicI64::new(NO_PROTOCOL),
        }
    }
}

#[derive(Debug, Default, serde::Serialize)]
pub struct EngineStatus {
    pub ready: bool,
    pub error: Option<String>,
    pub protocol_version: Option<i64>,
}

struct Running {
    child: Child,
    stdin: ChildStdin,
}

impl EngineHandle {
    /// Returns current connectivity status, error diagnostic, and negotiated protocol version.
    pub fn status(&self) -> EngineStatus {
        let ver = self.protocol.load(Ordering::Acquire);
        EngineStatus {
            ready: self.ready.load(Ordering::Acquire),
            error: self.last_error.lock().ok().and_then(|h| h.clone()),
            protocol_version: (ver != NO_PROTOCOL).then_some(ver),
        }
    }

    fn note_protocol(&self, version: Option<i64>) {
        self.protocol
            .store(version.unwrap_or(NO_PROTOCOL), Ordering::Release);
    }

    fn set_ready(&self, ready: bool) {
        self.ready.store(ready, Ordering::Release);
        if ready {
            self.note_failure(None);
        }
    }

    pub(crate) fn note_failure(&self, reason: Option<String>) {
        if let Ok(mut held) = self.last_error.lock() {
            *held = reason;
        }
    }

    /// Transmits a raw NDJSON string frame directly into the sidecar process stdin.
    pub fn send_frame(&self, frame: &str) -> Result<(), EngineError> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| EngineError::Internal("engine handle poisoned".into()))?;
        let active = guard.as_mut().ok_or(EngineError::NotRunning)?;

        active
            .stdin
            .write_all(frame.as_bytes())
            .and_then(|()| active.stdin.write_all(b"\n"))
            .and_then(|()| active.stdin.flush())
            .map_err(|e| EngineError::Write(e.to_string()))
    }

    /// Gracefully signals shutdown and reaps the sidecar child process.
    pub fn shutdown(&self) {
        self.set_ready(false);
        let Ok(mut guard) = self.inner.lock() else {
            return;
        };
        let Some(mut active) = guard.take() else {
            return;
        };

        let _ = active.stdin.write_all(b"{\"kind\":\"shutdown\"}\n");
        let _ = active.stdin.flush();
        drop(active.stdin);

        let _ = active.child.kill();
        let _ = active.child.wait();
    }
}

/// Discovers candidate locations for the sidecar executable across dev and resource paths.
fn engine_path(app: &AppHandle) -> Result<PathBuf, EngineError> {
    let mut searched = Vec::new();

    if cfg!(debug_assertions) {
        let dev_binary = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("engine")
            .join("dist")
            .join(ENGINE_DIR)
            .join(ENGINE_EXE);
        if dev_binary.is_file() {
            return Ok(dev_binary);
        }
        searched.push(dev_binary.display().to_string());
    }

    let bundled_binary = app
        .path()
        .resource_dir()
        .map_err(|e| EngineError::Internal(e.to_string()))?
        .join(ENGINE_DIR)
        .join(ENGINE_EXE);
    if bundled_binary.is_file() {
        return Ok(bundled_binary);
    }
    searched.push(bundled_binary.display().to_string());

    Err(EngineError::Missing(searched.join(" | ")))
}

/// Shuts down existing process and restarts a fresh engine sidecar instance.
pub fn restart(app: &AppHandle) -> Result<(), EngineError> {
    app.state::<EngineHandle>().shutdown();
    spawn(app)
}

/// Initializes and launches the sidecar process, piping stdout into the Tauri event stream.
pub fn spawn(app: &AppHandle) -> Result<(), EngineError> {
    let handle = app.state::<EngineHandle>();
    handle.set_ready(false);
    handle.note_protocol(None);
    match start(app) {
        Ok(()) => Ok(()),
        Err(err) => {
            app.state::<EngineHandle>()
                .note_failure(Some(err.to_string()));
            Err(err)
        }
    }
}

fn start(app: &AppHandle) -> Result<(), EngineError> {
    let binary_path = engine_path(app)?;

    let mut proc = Command::new(&binary_path);
    proc.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(parent_dir) = binary_path.parent() {
        proc.current_dir(parent_dir);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        proc.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = proc
        .spawn()
        .map_err(|e| EngineError::Spawn(format!("{} ({e})", binary_path.display())))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| EngineError::Spawn("engine stdin unavailable".into()))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| EngineError::Spawn("engine stdout unavailable".into()))?;
    let stderr = child.stderr.take();

    {
        let handle = app.state::<EngineHandle>();
        let mut guard = handle
            .inner
            .lock()
            .map_err(|_| EngineError::Internal("engine handle poisoned".into()))?;
        *guard = Some(Running { child, stdin });
    }

    let emitter_app = app.clone();
    std::thread::Builder::new()
        .name("engine-stdout".into())
        .spawn(move || {
            for incoming_line in BufReader::new(stdout).lines() {
                match incoming_line {
                    Ok(line) => forward_frame(&emitter_app, &line),
                    Err(err) => {
                        eprintln!("[engine] stdout read failed: {err}");
                        break;
                    }
                }
            }
            let state = emitter_app.state::<EngineHandle>();
            state.set_ready(false);
            state.note_failure(Some("The analysis engine stopped unexpectedly.".into()));
            let _ = emitter_app.emit(
                ENGINE_EVENT,
                serde_json::json!({
                    "type": "error",
                    "request_id": Value::Null,
                    "code": "internal_error",
                    "message": "The analysis engine stopped unexpectedly.",
                }),
            );
        })
        .map_err(|e| EngineError::Spawn(e.to_string()))?;

    if let Some(err_pipe) = stderr {
        std::thread::Builder::new()
            .name("engine-stderr".into())
            .spawn(move || {
                for diag in BufReader::new(err_pipe).lines().map_while(Result::ok) {
                    eprintln!("[engine] {diag}");
                }
            })
            .ok();
    }

    Ok(())
}

const LOG_ELISION: usize = 200;

fn elided(line: &str) -> String {
    if line.chars().count() <= LOG_ELISION {
        return line.to_owned();
    }
    let lead: String = line.chars().take(LOG_ELISION).collect();
    format!("{lead}… ({} chars elided)", line.chars().count() - LOG_ELISION)
}

pub(crate) fn forward_frame(app: &AppHandle, line: &str) {
    let clean = line.trim();
    if clean.is_empty() {
        return;
    }

    match serde_json::from_str::<Value>(clean) {
        Ok(json_val) => {
            if json_val.get("type").and_then(Value::as_str) == Some("ready") {
                let handle = app.state::<EngineHandle>();
                handle.note_protocol(json_val.get("protocol_version").and_then(Value::as_i64));
                handle.set_ready(true);
            }
            let _ = app.emit(ENGINE_EVENT, json_val);
        }
        Err(err) => {
            eprintln!(
                "[engine] non-protocol stdout line ({err}): {}",
                elided(clean)
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_short_line_is_logged_whole() {
        assert_eq!(
            elided("Traceback (most recent call last):"),
            "Traceback (most recent call last):"
        );
    }

    #[test]
    fn a_long_line_is_cut_and_says_so() {
        let input = "x".repeat(LOG_ELISION + 50);
        let out = elided(&input);
        assert!(out.starts_with(&"x".repeat(LOG_ELISION)));
        assert!(out.ends_with("(50 chars elided)"));
        assert!(out.len() < input.len());
    }

    #[test]
    fn cuts_multibyte_text_without_panicking() {
        for sample in [
            "Отговорите в този документ са генерирани от AI асистент. ".repeat(20),
            "La aorta ascendente y el cayado aórtico irrigan la cabeza. ".repeat(20),
        ] {
            let out = elided(&sample);
            assert!(out.contains('…'));
            let prefix: String = sample.chars().take(LOG_ELISION).collect();
            assert!(out.starts_with(&prefix));
        }
    }

    #[test]
    fn a_fresh_handle_has_heard_no_version() {
        let handle = EngineHandle::default();
        assert_eq!(handle.status().protocol_version, None);
    }

    #[test]
    fn the_announced_version_is_remembered_for_whoever_asks_later() {
        let handle = EngineHandle::default();
        handle.note_protocol(Some(2));
        handle.set_ready(true);

        let status = handle.status();
        assert!(status.ready);
        assert_eq!(status.protocol_version, Some(2));
    }

    #[test]
    fn protocol_zero_is_an_answer_and_not_a_silence() {
        let handle = EngineHandle::default();
        handle.note_protocol(Some(0));

        assert_eq!(handle.status().protocol_version, Some(0));
    }

    #[test]
    fn a_restart_forgets_the_previous_engine_s_version() {
        let handle = EngineHandle::default();
        handle.note_protocol(Some(2));
        handle.note_protocol(None);

        assert_eq!(handle.status().protocol_version, None);
    }
}
