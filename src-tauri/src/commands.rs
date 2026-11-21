//! Tauri command bindings exposed to the frontend webview runtime.
//!
//! Handles invocation dispatch across credential storage, Python engine sidecar IPC,
//! local SQLite study database, system control bridge, and hardware settings.

use serde::Deserialize;
use serde_json::{Map, Value};
use tauri::{Manager, State};

use crate::app_log::{AppLog, LogEntry};
use crate::control_bridge::{BridgeError, BridgeStatus, ControlBridge};
use crate::display::{self, DisplaySettings, DisplayStatus};
use crate::keyring_store::{self, KeyringError, Provider};
use crate::sidecar::{EngineError, EngineHandle, EngineStatus};
use crate::study_db::{
    CaseDigest, CaseFile, CaseFinding, CaseInput, CaseSymptom, FindingInput, ImportSummary,
    JournalExport, Note, NoteInput, SessionDetail, SessionSummary, StudyCoverage, StudyDb,
    StudyError, StudyStats, SymptomInput, TurnInput, UsageBucket, UsageInput,
};

#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error(transparent)]
    Keyring(#[from] KeyringError),
    #[error(transparent)]
    Engine(#[from] EngineError),
    #[error(transparent)]
    Study(#[from] StudyError),
    #[error(transparent)]
    Bridge(#[from] BridgeError),
    #[error("{0}")]
    Invalid(String),
}

impl serde::Serialize for CommandError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type CommandResult<T> = Result<T, CommandError>;

// ---------------------------------------------------------------------------
// 1. Authentication & Keyring Handlers
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn save_api_key(provider: Provider, api_key: String) -> CommandResult<()> {
    keyring_store::store(provider, &api_key)?;
    Ok(())
}

#[tauri::command]
pub fn has_api_key(provider: Provider) -> bool {
    keyring_store::exists(provider)
}

#[tauri::command]
pub fn delete_api_key(provider: Provider) -> CommandResult<()> {
    keyring_store::delete(provider)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// 2. Python Sidecar Execution & Protocol Framing
// ---------------------------------------------------------------------------

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

fn assert_unreserved_fields(fields: &Map<String, Value>) -> CommandResult<()> {
    for forbidden in &["api_key", "kind"] {
        if fields.contains_key(*forbidden) {
            return Err(CommandError::Invalid(format!(
                "request payload must not define reserved field '{forbidden}'"
            )));
        }
    }
    Ok(())
}

fn compose_provider_frame(kind: &str, request: FrontendRequest) -> CommandResult<String> {
    assert_unreserved_fields(&request.rest)?;
    let api_secret = keyring_store::read(request.provider)?;

    let mut envelope = request.rest;
    envelope.insert("kind".into(), Value::String(kind.into()));
    envelope.insert("request_id".into(), Value::String(request.request_id));
    envelope.insert(
        "provider".into(),
        serde_json::to_value(request.provider)
            .map_err(|e| CommandError::Invalid(e.to_string()))?,
    );
    envelope.insert("api_key".into(), Value::String(api_secret));

    serde_json::to_string(&Value::Object(envelope)).map_err(|e| CommandError::Invalid(e.to_string()))
}

fn compose_local_frame(kind: &str, request: LocalRequest) -> CommandResult<String> {
    assert_unreserved_fields(&request.rest)?;
    let mut envelope = request.rest;
    envelope.insert("kind".into(), Value::String(kind.into()));
    envelope.insert("request_id".into(), Value::String(request.request_id));
    serde_json::to_string(&Value::Object(envelope)).map_err(|e| CommandError::Invalid(e.to_string()))
}

#[tauri::command]
pub fn ask_agent(engine: State<'_, EngineHandle>, request: FrontendRequest) -> CommandResult<()> {
    let frame = compose_provider_frame("agent_request", request)?;
    engine.send_frame(&frame)?;
    Ok(())
}

#[tauri::command]
pub fn list_models(engine: State<'_, EngineHandle>, request: FrontendRequest) -> CommandResult<()> {
    let frame = compose_provider_frame("list_models", request)?;
    engine.send_frame(&frame)?;
    Ok(())
}

#[tauri::command]
pub fn ask_local(engine: State<'_, EngineHandle>, request: LocalRequest) -> CommandResult<()> {
    let frame = compose_local_frame("local_chat_request", request)?;
    engine.send_frame(&frame)?;
    Ok(())
}

#[tauri::command]
pub fn list_local_models(
    engine: State<'_, EngineHandle>,
    request: LocalRequest,
) -> CommandResult<()> {
    let frame = compose_local_frame("local_models_request", request)?;
    engine.send_frame(&frame)?;
    Ok(())
}

#[tauri::command]
pub fn engine_status(engine: State<'_, EngineHandle>) -> EngineStatus {
    engine.status()
}

#[tauri::command]
pub fn restart_engine(app: tauri::AppHandle) -> CommandResult<()> {
    crate::sidecar::restart(&app)?;
    Ok(())
}

#[tauri::command]
pub fn cancel_request(engine: State<'_, EngineHandle>, request_id: String) -> CommandResult<()> {
    let frame = serde_json::json!({
        "kind": "cancel",
        "request_id": request_id
    });
    engine.send_frame(&frame.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// 3. Local Study Journal & Case Simulation
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn save_study_turn(db: State<'_, StudyDb>, turn: TurnInput) -> CommandResult<()> {
    db.save_turn(turn)?;
    Ok(())
}

#[tauri::command]
pub fn record_case_result(
    db: State<'_, StudyDb>,
    session_id: String,
    score: i64,
    verdict: String,
) -> CommandResult<()> {
    db.record_case_result(&session_id, score, &verdict)?;
    Ok(())
}

#[tauri::command]
pub fn list_study_sessions(
    db: State<'_, StudyDb>,
    query: Option<String>,
    organ_id: Option<String>,
    case_id: Option<String>,
    limit: i64,
) -> CommandResult<Vec<SessionSummary>> {
    Ok(db.list_sessions(query.as_deref(), organ_id.as_deref(), case_id.as_deref(), limit)?)
}

#[tauri::command]
pub fn get_study_session(
    db: State<'_, StudyDb>,
    session_id: String,
) -> CommandResult<Option<SessionDetail>> {
    Ok(db.session(&session_id)?)
}

#[tauri::command]
pub fn rename_study_session(
    db: State<'_, StudyDb>,
    session_id: String,
    title: String,
) -> CommandResult<()> {
    db.rename_session(&session_id, &title)?;
    Ok(())
}

#[tauri::command]
pub fn delete_study_session(db: State<'_, StudyDb>, session_id: String) -> CommandResult<()> {
    db.delete_session(&session_id)?;
    Ok(())
}

#[tauri::command]
pub fn create_case(db: State<'_, StudyDb>, case: CaseInput) -> CommandResult<CaseFile> {
    Ok(db.create_case(case)?)
}

#[tauri::command]
pub fn list_cases(db: State<'_, StudyDb>) -> CommandResult<Vec<CaseFile>> {
    Ok(db.list_cases()?)
}

#[tauri::command]
pub fn reveal_case_answer(
    db: State<'_, StudyDb>,
    case_id: String,
) -> CommandResult<Option<String>> {
    Ok(db.case_answer(&case_id)?)
}

#[tauri::command]
pub fn case_digest(db: State<'_, StudyDb>, case_id: String) -> CommandResult<Option<CaseDigest>> {
    Ok(db.case_digest(&case_id)?)
}

#[tauri::command]
pub fn delete_case(db: State<'_, StudyDb>, case_id: String) -> CommandResult<()> {
    db.delete_case(&case_id)?;
    Ok(())
}

#[tauri::command]
pub fn add_case_symptom(
    db: State<'_, StudyDb>,
    symptom: SymptomInput,
) -> CommandResult<CaseSymptom> {
    Ok(db.add_symptom(symptom)?)
}

#[tauri::command]
pub fn case_symptoms(db: State<'_, StudyDb>, case_id: String) -> CommandResult<Vec<CaseSymptom>> {
    Ok(db.symptoms(&case_id)?)
}

#[tauri::command]
pub fn delete_case_symptom(db: State<'_, StudyDb>, id: i64) -> CommandResult<()> {
    db.delete_symptom(id)?;
    Ok(())
}

#[tauri::command]
pub fn add_case_finding(
    db: State<'_, StudyDb>,
    finding: FindingInput,
) -> CommandResult<CaseFinding> {
    Ok(db.add_finding(finding)?)
}

#[tauri::command]
pub fn case_findings(db: State<'_, StudyDb>, case_id: String) -> CommandResult<Vec<CaseFinding>> {
    Ok(db.findings(&case_id)?)
}

#[tauri::command]
pub fn delete_case_finding(db: State<'_, StudyDb>, id: i64) -> CommandResult<()> {
    db.delete_finding(id)?;
    Ok(())
}

#[tauri::command]
pub fn create_note(db: State<'_, StudyDb>, note: NoteInput) -> CommandResult<Note> {
    Ok(db.create_note(note)?)
}

#[tauri::command]
pub fn update_note(db: State<'_, StudyDb>, id: i64, body: String) -> CommandResult<()> {
    db.update_note(id, &body)?;
    Ok(())
}

#[tauri::command]
pub fn delete_note(db: State<'_, StudyDb>, id: i64) -> CommandResult<()> {
    db.delete_note(id)?;
    Ok(())
}

#[tauri::command]
pub fn list_notes(
    db: State<'_, StudyDb>,
    organ_id: Option<String>,
    query: Option<String>,
    limit: i64,
) -> CommandResult<Vec<Note>> {
    Ok(db.list_notes(organ_id.as_deref(), query.as_deref(), limit)?)
}

#[tauri::command]
pub fn study_stats(db: State<'_, StudyDb>) -> CommandResult<StudyStats> {
    Ok(db.stats()?)
}

#[tauri::command]
pub fn study_coverage(db: State<'_, StudyDb>) -> CommandResult<Vec<StudyCoverage>> {
    Ok(db.coverage()?)
}

#[tauri::command]
pub fn record_token_usage(db: State<'_, StudyDb>, usage: UsageInput) -> CommandResult<()> {
    Ok(db.record_usage(usage)?)
}

#[tauri::command]
pub fn token_usage(db: State<'_, StudyDb>, days: i64) -> CommandResult<Vec<UsageBucket>> {
    Ok(db.usage(days)?)
}

// ---------------------------------------------------------------------------
// 4. Native Dialogs & Disk Transfer
// ---------------------------------------------------------------------------

const JOURNAL_DEFAULT_NAME: &str = "hoomaan-journal.json";

#[tauri::command]
pub async fn export_journal(
    app: tauri::AppHandle,
    db: State<'_, StudyDb>,
) -> CommandResult<Option<String>> {
    use tauri_plugin_dialog::DialogExt;

    let payload = db.export()?;
    let encoded = serde_json::to_string_pretty(&payload)
        .map_err(|e| CommandError::Invalid(e.to_string()))?;

    let Some(chosen) = app
        .dialog()
        .file()
        .set_file_name(JOURNAL_DEFAULT_NAME)
        .add_filter("HOOMAAN journal", &["json"])
        .blocking_save_file()
    else {
        return Ok(None);
    };

    let target_file = chosen
        .into_path()
        .map_err(|e| CommandError::Invalid(e.to_string()))?;
    std::fs::write(&target_file, encoded).map_err(|e| CommandError::Invalid(e.to_string()))?;
    Ok(Some(target_file.display().to_string()))
}

#[tauri::command]
pub async fn import_journal(
    app: tauri::AppHandle,
    db: State<'_, StudyDb>,
) -> CommandResult<Option<ImportSummary>> {
    use tauri_plugin_dialog::DialogExt;

    let Some(selected) = app
        .dialog()
        .file()
        .add_filter("HOOMAAN journal", &["json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };

    let filepath = selected
        .into_path()
        .map_err(|e| CommandError::Invalid(e.to_string()))?;
    let raw_text = std::fs::read_to_string(&filepath).map_err(|e| CommandError::Invalid(e.to_string()))?;
    let decoded: JournalExport = serde_json::from_str(&raw_text).map_err(|_| {
        CommandError::Invalid("That file is not a HOOMAAN study journal.".into())
    })?;

    Ok(Some(db.import(decoded)?))
}

fn sanitize_view_filename(name: &str) -> String {
    let clean: String = name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        .take(80)
        .collect();
    let trimmed = clean.trim_matches('.').to_string();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.to_ascii_lowercase().ends_with(".png") {
        trimmed
    } else {
        format!("{trimmed}.png")
    }
}

#[tauri::command]
pub async fn save_view_image(
    app: tauri::AppHandle,
    png_base64: String,
    file_name: Option<String>,
) -> CommandResult<Option<String>> {
    use base64::Engine as _;
    use tauri_plugin_dialog::DialogExt;

    let image_data = base64::engine::general_purpose::STANDARD
        .decode(png_base64.as_bytes())
        .map_err(|_| CommandError::Invalid("The image could not be decoded.".into()))?;

    let default_name = file_name
        .as_deref()
        .map(sanitize_view_filename)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "hoomaan-view.png".to_string());

    let Some(dialog_result) = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("PNG image", &["png"])
        .blocking_save_file()
    else {
        return Ok(None);
    };

    let mut dest_path = dialog_result
        .into_path()
        .map_err(|e| CommandError::Invalid(e.to_string()))?;
    if dest_path.extension().is_none_or(|ext| !ext.eq_ignore_ascii_case("png")) {
        dest_path.set_extension("png");
    }

    std::fs::write(&dest_path, image_data).map_err(|e| CommandError::Invalid(e.to_string()))?;
    Ok(Some(dest_path.display().to_string()))
}

// ---------------------------------------------------------------------------
// 5. External Bridge Supervision & Diagnostics
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn bridge_status(app: tauri::AppHandle, bridge: State<'_, ControlBridge>) -> BridgeStatus {
    let mut status = bridge.status();
    let resource_root = app.path().resource_dir().ok().map(|d| d.join("hoomaan-mcp"));
    status.server = resource_root.and_then(|r| {
        if r.join("atlas.py").is_file() {
            Some(r.to_string_lossy().into_owned())
        } else {
            None
        }
    });
    status
}

#[tauri::command]
pub fn start_bridge(
    app: tauri::AppHandle,
    bridge: State<'_, ControlBridge>,
) -> CommandResult<BridgeStatus> {
    Ok(bridge.start(move |frame| crate::sidecar::forward_frame(&app, &frame))?)
}

#[tauri::command]
pub fn stop_bridge(bridge: State<'_, ControlBridge>) -> BridgeStatus {
    bridge.stop();
    bridge.status()
}

#[tauri::command]
pub fn read_log(log: State<'_, AppLog>) -> Vec<LogEntry> {
    log.read()
}

#[tauri::command]
pub fn log_location(log: State<'_, AppLog>) -> Option<String> {
    log.path().map(|path| path.display().to_string())
}

#[tauri::command]
pub fn clear_log(log: State<'_, AppLog>) -> CommandResult<()> {
    log.clear()
        .map_err(|err| CommandError::Invalid(format!("could not clear the log: {err}")))
}

#[tauri::command]
pub fn log_event(log: State<'_, AppLog>, level: String, source: String, message: String) {
    log.append(&level, &source, &message);
}

#[tauri::command]
pub async fn save_log_copy(
    app: tauri::AppHandle,
    contents: String,
) -> CommandResult<Option<String>> {
    use tauri_plugin_dialog::DialogExt;

    let Some(dest) = app
        .dialog()
        .file()
        .set_file_name("hoomaan-log.txt")
        .add_filter("Text file", &["txt"])
        .blocking_save_file()
    else {
        return Ok(None);
    };

    let mut dest_path = dest
        .into_path()
        .map_err(|e| CommandError::Invalid(e.to_string()))?;
    if dest_path.extension().is_none_or(|ext| !ext.eq_ignore_ascii_case("txt")) {
        dest_path.set_extension("txt");
    }

    std::fs::write(&dest_path, contents).map_err(|e| CommandError::Invalid(e.to_string()))?;
    Ok(Some(dest_path.display().to_string()))
}

#[tauri::command]
pub fn display_status(app: tauri::AppHandle) -> DisplayStatus {
    let settings = app
        .path()
        .app_data_dir()
        .map(|dir| display::read(&dir))
        .unwrap_or_default();
    DisplayStatus {
        supported: display::SUPPORTED,
        stable_display: settings.stable_display,
        active: display::active(),
    }
}

#[tauri::command]
pub fn set_stable_display(
    app: tauri::AppHandle,
    log: State<'_, AppLog>,
    on: bool,
) -> CommandResult<DisplayStatus> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| CommandError::Invalid(format!("no data directory: {err}")))?;
    display::write(&dir, DisplaySettings { stable_display: on })
        .map_err(|err| CommandError::Invalid(format!("could not save display setting: {err}")))?;
    log.append(
        "info",
        "display",
        if on {
            "stable display enabled"
        } else {
            "stable display disabled"
        },
    );
    Ok(display_status(app))
}
