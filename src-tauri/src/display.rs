//! Hardware acceleration and window rendering stability configurations.
//!
//! Provides toggles to alleviate DirectComposition frame blinking on certain
//! Windows GPU configurations or disable DMA-BUF on Linux systems before the
//! WebView window process initializes.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const DISPLAY_FILE: &str = "display.json";

/// Environment variable controlling additional arguments passed to Microsoft WebView2.
const WEBVIEW2_ARGS_KEY: &str = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";

/// Default browser security and feature switches supplied by Tauri.
const TAURI_BASE_FLAGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";

/// Argument to disable direct hardware composition overlays in WebView2.
const DISABLE_COMPOSITION_FLAG: &str = "--disable-direct-composition";

/// Linux WebKitGTK DMA-BUF disabling variable.
const WEBKIT_NO_DMABUF_KEY: &str = "WEBKIT_DISABLE_DMABUF_RENDERER";

/// Platform application identifier corresponding to Tauri data folders.
const APP_BUNDLE_ID: &str = "com.hoomaan.app";

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplaySettings {
    #[serde(default)]
    pub stable_display: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayStatus {
    pub supported: bool,
    pub stable_display: bool,
    pub active: bool,
}

/// Reads the persistent display preferences, defaulting gracefully if unreadable.
pub fn read(dir: &Path) -> DisplaySettings {
    std::fs::read_to_string(dir.join(DISPLAY_FILE))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

/// Persists the display configuration file.
pub fn write(dir: &Path, settings: DisplaySettings) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;
    let serialized = serde_json::to_string_pretty(&settings).map_err(std::io::Error::other)?;
    std::fs::write(dir.join(DISPLAY_FILE), serialized)
}

/// Returns the formatted browser arguments when stable display is enabled.
pub fn browser_args(settings: DisplaySettings) -> Option<String> {
    if settings.stable_display {
        Some(format!("{TAURI_BASE_FLAGS} {DISABLE_COMPOSITION_FLAG}"))
    } else {
        None
    }
}

/// Indicates whether the active OS platform supports these display adjustments.
pub const SUPPORTED: bool = cfg!(any(windows, target_os = "linux"));

/// Checks whether the running WebView environment currently has stability flags engaged.
pub fn active() -> bool {
    if cfg!(windows) {
        std::env::var(WEBVIEW2_ARGS_KEY).is_ok_and(|val| {
            val.split_whitespace().any(|token| token == DISABLE_COMPOSITION_FLAG)
        })
    } else if cfg!(target_os = "linux") {
        std::env::var(WEBKIT_NO_DMABUF_KEY).is_ok_and(|val| val == "1")
    } else {
        false
    }
}

/// Discovers the application data storage directory prior to Tauri bootstrap.
fn data_dir_before_tauri() -> Option<PathBuf> {
    let parent = if cfg!(windows) {
        PathBuf::from(std::env::var_os("APPDATA")?)
    } else {
        match std::env::var_os("XDG_DATA_HOME").filter(|v| !v.is_empty()) {
            Some(custom) => PathBuf::from(custom),
            None => PathBuf::from(std::env::var_os("HOME")?).join(".local").join("share"),
        }
    };
    Some(parent.join(APP_BUNDLE_ID))
}

/// Configures environment variables prior to Webview instantiation.
pub fn apply_before_window() {
    if !SUPPORTED {
        return;
    }
    let flag_key = if cfg!(windows) {
        WEBVIEW2_ARGS_KEY
    } else {
        WEBKIT_NO_DMABUF_KEY
    };

    if std::env::var_os(flag_key).is_some() {
        return;
    }

    let Some(dir) = data_dir_before_tauri() else {
        return;
    };

    let preferences = read(&dir);
    if cfg!(windows) {
        if let Some(args) = browser_args(preferences) {
            std::env::set_var(WEBVIEW2_ARGS_KEY, args);
        }
    } else if preferences.stable_display {
        std::env::set_var(WEBKIT_NO_DMABUF_KEY, "1");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_test_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("hoomaan-disp-{label}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn off_by_default_and_when_the_file_is_missing_or_broken() {
        let dir = temp_test_dir("missing");
        assert_eq!(read(&dir), DisplaySettings::default());
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(DISPLAY_FILE), "bad-json").unwrap();
        assert!(!read(&dir).stable_display);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_stored_choice_reads_back() {
        let dir = temp_test_dir("roundtrip");
        write(&dir, DisplaySettings { stable_display: true }).unwrap();
        assert!(read(&dir).stable_display);
        write(&dir, DisplaySettings { stable_display: false }).unwrap();
        assert!(!read(&dir).stable_display);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn stable_display_keeps_tauris_defaults_and_adds_one_switch() {
        assert_eq!(browser_args(DisplaySettings::default()), None);
        let flags = browser_args(DisplaySettings { stable_display: true }).unwrap();
        assert!(flags.starts_with(TAURI_BASE_FLAGS));
        assert!(flags.ends_with(DISABLE_COMPOSITION_FLAG));
    }
}
