//! Python AI sidecar engine IPC commands and message serialization.

use serde::Deserialize;
use serde_json::{Map, Value};
use tauri::{command, AppHandle, State};

use crate::keyring_store::{self, KeyringError, Provider};
use crate::sidecar::{EngineError, EngineHandle, EngineStatus};

#[derive(Debug, thiserror::Error)]
pub enum EngineCommandError {
    #[error(transparent)]
    Sidecar(#[from] EngineError),
    #[error(transparent)]
    Key(#[from] KeyringError),
    #[error("{0}")]
    Validation(String),
}

impl serde::Serialize for EngineCommandError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type EngineResult<T> = Result<T, EngineCommandError>;

#[derive(Debug, Deserialize)]
pub struct FrontendRequest {
    request_id: String,
    provider: Provider,
    #[serde(flatten)]
    rest: Map<String, Value>,
}

#[derive(Debug, Deserialize)]
pub struct LocalRequest {
    request_id: String,
    #[serde(flatten)]
    rest: Map<String, Value>,
}

fn ensure_safe_payload(fields: &Map<String, Value>) -> EngineResult<()> {
    for reserved in ["api_key", "kind"] {
        if fields.contains_key(reserved) {
            return Err(EngineCommandError::Validation(format!(
                "Payload defines reserved identifier: {reserved}"
            )));
        }
    }
    Ok(())
}

fn build_envelope(
    kind: &str,
    req_id: String,
    prov: Option<Provider>,
    api_key: Option<String>,
    mut rest: Map<String, Value>,
) -> EngineResult<String> {
    ensure_safe_payload(&rest)?;
    rest.insert("kind".into(), Value::String(kind.into()));
    rest.insert("request_id".into(), Value::String(req_id));

    if let Some(p) = prov {
        rest.insert(
            "provider".into(),
            serde_json::to_value(p).map_err(|e| EngineCommandError::Validation(e.to_string()))?,
        );
    }
    if let Some(k) = api_key {
        rest.insert("api_key".into(), Value::String(k));
    }

    serde_json::to_string(&Value::Object(rest))
        .map_err(|e| EngineCommandError::Validation(e.to_string()))
}

#[command]
pub fn ask_agent(engine: State<'_, EngineHandle>, request: FrontendRequest) -> EngineResult<()> {
    let key = keyring_store::read(request.provider)?;
    let packet = build_envelope(
        "agent_request",
        request.request_id,
        Some(request.provider),
        Some(key),
        request.rest,
    )?;
    engine.send_frame(&packet)?;
    Ok(())
}

#[command]
pub fn list_models(engine: State<'_, EngineHandle>, request: FrontendRequest) -> EngineResult<()> {
    let key = keyring_store::read(request.provider)?;
    let packet = build_envelope(
        "list_models",
        request.request_id,
        Some(request.provider),
        Some(key),
        request.rest,
    )?;
    engine.send_frame(&packet)?;
    Ok(())
}

#[command]
pub fn ask_local(engine: State<'_, EngineHandle>, request: LocalRequest) -> EngineResult<()> {
    let packet = build_envelope(
        "local_chat_request",
        request.request_id,
        None,
        None,
        request.rest,
    )?;
    engine.send_frame(&packet)?;
    Ok(())
}

#[command]
pub fn list_local_models(
    engine: State<'_, EngineHandle>,
    request: LocalRequest,
) -> EngineResult<()> {
    let packet = build_envelope(
        "local_models_request",
        request.request_id,
        None,
        None,
        request.rest,
    )?;
    engine.send_frame(&packet)?;
    Ok(())
}

#[command]
pub fn engine_status(engine: State<'_, EngineHandle>) -> EngineStatus {
    engine.status()
}

#[command]
pub fn restart_engine(app: AppHandle) -> EngineResult<()> {
    crate::sidecar::restart(&app)?;
    Ok(())
}

#[command]
pub fn cancel_request(engine: State<'_, EngineHandle>, request_id: String) -> EngineResult<()> {
    let msg = serde_json::json!({
        "kind": "cancel",
        "request_id": request_id
    });
    engine.send_frame(&msg.to_string())?;
    Ok(())
}
