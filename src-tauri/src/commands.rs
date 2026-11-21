//! Tauri IPC Command Router & Dispatcher for HOOMAAN Desktop.
//!
//! Exposes domain-partitioned command handlers to the Tauri Webview runtime:
//! - `auth`: Secure API credentials management via OS keyring.
//! - `engine`: Python AI tutor sidecar IPC communication and streaming.
//! - `study`: SQLite persistent study sessions, virtual cases, and note-taking.
//! - `system`: Hardware control bridge, diagnostic logging, and display scaling.

pub mod auth;
pub mod engine;
pub mod study;
pub mod system;

pub use auth::*;
pub use engine::*;
pub use study::*;
pub use system::*;
