//! System diagnostics, logging, display management, and hardware bridge commands.

use std::path::PathBuf;
use tauri::{command, AppHandle, State};

use crate::app_log::{AppLog, LogEntry};
use crate::control_bridge::{BridgeError, BridgeStatus, ControlBridge};
use crate::display::{self, DisplaySettings, DisplayStatus};

#[derive(Debug, thiserror::Error)]
pub enum SystemCommandError {
    #[error(transparent)]
    Bridge(#[from] BridgeError),
    #[error("{0}")]
    Io(String),
}

impl serde::Serialize for SystemCommandError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type SystemResult<T> = Result<T, SystemCommandError>;

#[command]
pub fn bridge_status(bridge: State<'_, ControlBridge>) -> BridgeStatus {
    bridge.status()
}

#[command]
pub fn start_bridge(bridge: State<'_, ControlBridge>, port: Option<u16>) -> SystemResult<u16> {
    Ok(bridge.start(port)?)
}

#[command]
pub fn stop_bridge(bridge: State<'_, ControlBridge>) -> SystemResult<()> {
    bridge.stop()?;
    Ok(())
}

#[command]
pub fn read_log(logger: State<'_, AppLog>, limit: usize) -> Vec<LogEntry> {
    logger.recent(limit)
}

#[command]
pub fn log_location(app: AppHandle) -> Option<PathBuf> {
    crate::app_log::log_path(&app)
}

#[command]
pub fn clear_log(logger: State<'_, AppLog>) {
    logger.clear();
}

#[command]
pub fn log_event(logger: State<'_, AppLog>, level: String, message: String) {
    logger.log(&level, &message);
}

#[command]
pub fn save_log_copy(app: AppHandle, destination: PathBuf) -> SystemResult<()> {
    crate::app_log::copy_to(&app, &destination).map_err(|e| SystemCommandError::Io(e.to_string()))
}

#[command]
pub fn display_status() -> DisplayStatus {
    display::status()
}

#[command]
pub fn set_stable_display(settings: DisplaySettings) -> DisplayStatus {
    display::apply(settings)
}
