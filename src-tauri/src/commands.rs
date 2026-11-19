//! Tauri command bindings exposed to the frontend webview runtime.
//!
//! Exposes typed invocation handlers for local SQLite journal storage, process
//! management of the Python sidecar, credential management, external IPC bridge,
//! and native OS dialog integration.

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

type CommandResult<T> = Result<T, CommandError>;

// ---------------------------------------------------------------------------
// Credentials Management
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
// Engine Sidecar Orchestration
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct FrontendRequest {
    request_id: String,
    provider: Provider,
    #[serde(flatten)]
    rest: Map<String, Value>,
}

const FORBIDDEN_FIELDS: [&str; 2] = ["api_key", "kind"];

fn build_frame(kind: &str, request: FrontendRequest) -> CommandResult<String> {
    if let Some(bad_field) = FORBIDDEN_FIELDS
        .iter()
        .find(|field| request.rest.contains_key(**field))
    {
        return Err(CommandError::Invalid(format!(
            "request must not set the reserved field '{bad_field}'"
        )));
    }

    let secret_key = keyring_store::read(request.provider)?;

    let mut map = request.rest;
    map.insert("kind".into(), Value::String(kind.into()));
    map.insert("request_id".into(), Value::String(request.request_id));
    map.insert(
        "provider".into(),
        serde_json::to_value(request.provider)
            .map_err(|e| CommandError::Invalid(e.to_string()))?,
    );
    map.insert("api_key".into(), Value::String(secret_key));

    serde_json::to_string(&Value::Object(map))
        .map_err(|e| CommandError::Invalid(e.to_string()))
}

#[tauri::command]
pub fn ask_agent(engine: State<'_, EngineHandle>, request: FrontendRequest) -> CommandResult<()> {
    let frame = build_frame("agent_request", request)?;
    engine.send_frame(&frame)?;
    Ok(())
}

#[tauri::command]
pub fn list_models(engine: State<'_, EngineHandle>, request: FrontendRequest) -> CommandResult<()> {
    let frame = build_frame("list_models", request)?;
    engine.send_frame(&frame)?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct LocalRequest {
    request_id: String,
    #[serde(flatten)]
    rest: Map<String, Value>,
}

fn build_local_frame(kind: &str, request: LocalRequest) -> CommandResult<String> {
    if let Some(bad_field) = FORBIDDEN_FIELDS
        .iter()
        .find(|field| request.rest.contains_key(**field))
    {
        return Err(CommandError::Invalid(format!(
            "request must not set the reserved field '{bad_field}'"
        )));
    }
    let mut map = request.rest;
    map.insert("kind".into(), Value::String(kind.into()));
    map.insert("request_id".into(), Value::String(request.request_id));
    serde_json::to_string(&Value::Object(map))
        .map_err(|e| CommandError::Invalid(e.to_string()))
}

#[tauri::command]
pub fn ask_local(engine: State<'_, EngineHandle>, request: LocalRequest) -> CommandResult<()> {
    let frame = build_local_frame("local_chat_request", request)?;
    engine.send_frame(&frame)?;
    Ok(())
}

#[tauri::command]
pub fn list_local_models(
    engine: State<'_, EngineHandle>,
    request: LocalRequest,
) -> CommandResult<()> {
    let frame = build_local_frame("local_models_request", request)?;
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
    let cancel_msg = serde_json::json!({ "kind": "cancel", "request_id": request_id });
    engine.send_frame(&cancel_msg.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Study Journal Database
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
// File Export / Import Operations
// ---------------------------------------------------------------------------

const JOURNAL_FILE_EXTENSION: &str = "hoomaan-journal.json";

#[tauri::command]
pub async fn export_journal(
    app: tauri::AppHandle,
    db: State<'_, StudyDb>,
) -> CommandResult<Option<String>> {
    use tauri_plugin_dialog::DialogExt;

    let journal = db.export()?;
    let serialized = serde_json::to_string_pretty(&journal)
        .map_err(|e| CommandError::Invalid(e.to_string()))?;

    let Some(dest_path) = app
        .dialog()
        .file()
        .set_file_name(JOURNAL_FILE_EXTENSION)
        .add_filter("HOOMAAN journal", &["json"])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let target = dest_path
        .into_path()
        .map_err(|e| CommandError::Invalid(e.to_string()))?;

    std::fs::write(&target, serialized).map_err(|e| CommandError::Invalid(e.to_string()))?;
    Ok(Some(target.display().to_string()))
}

fn sanitize_suggested_filename(raw_name: &str) -> String {
    let sanitized: String = raw_name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        .take(80)
        .collect();
    let trimmed = sanitized.trim_matches('.').to_string();
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

    let image_bytes = base64::engine::general_purpose::STANDARD
        .decode(png_base64.as_bytes())
        .map_err(|_| CommandError::Invalid("The image could not be decoded.".into()))?;

    let chosen_name = file_name
        .as_deref()
        .map(sanitize_suggested_filename)
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "hoomaan-view.png".to_string());

    let Some(save_path) = app
        .dialog()
        .file()
        .set_file_name(&chosen_name)
        .add_filter("PNG image", &["png"])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let mut final_path = save_path
        .into_path()
        .map_err(|e| CommandError::Invalid(e.to_string()))?;
    if final_path.extension().is_none_or(|ext| !ext.eq_ignore_ascii_case("png")) {
        final_path.set_extension("png");
    }

    std::fs::write(&final_path, image_bytes).map_err(|e| CommandError::Invalid(e.to_string()))?;
    Ok(Some(final_path.display().to_string()))
}

#[tauri::command]
pub async fn import_journal(
    app: tauri::AppHandle,
    db: State<'_, StudyDb>,
) -> CommandResult<Option<ImportSummary>> {
    use tauri_plugin_dialog::DialogExt;

    let Some(picked_path) = app
        .dialog()
        .file()
        .add_filter("HOOMAAN journal", &["json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let target = picked_path
        .into_path()
        .map_err(|e| CommandError::Invalid(e.to_string()))?;

    let contents = std::fs::read_to_string(&target).map_err(|e| CommandError::Invalid(e.to_string()))?;
    let decoded_journal: JournalExport = serde_json::from_str(&contents).map_err(|_| {
        CommandError::Invalid("That file is not a HOOMAAN study journal.".into())
    })?;

    Ok(Some(db.import(decoded_journal)?))
}

// ---------------------------------------------------------------------------
// Control Bridge Supervision
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn bridge_status(app: tauri::AppHandle, bridge: State<'_, ControlBridge>) -> BridgeStatus {
    let mut current = bridge.status();
    current.server = mcp_server_dir(&app);
    current
}

fn mcp_server_dir(app: &tauri::AppHandle) -> Option<String> {
    let target_dir = app.path().resource_dir().ok()?.join("hoomaan-mcp");
    target_dir
        .join("atlas.py")
        .is_file()
        .then(|| target_dir.to_string_lossy().into_owned())
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

// ---------------------------------------------------------------------------
// Audit & Diagnostic Logging
// ---------------------------------------------------------------------------

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
pub fn log_event(log: State<'_, AppLog>, level: String, source: String, message: String) {
    log.append(&level, &source, &message);
}

// ---------------------------------------------------------------------------
// Display Hardware Settings
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn display_status(app: tauri::AppHandle) -> DisplayStatus {
    let persisted = app
        .path()
        .app_data_dir()
        .map(|dir| display::read(&dir))
        .unwrap_or_default();
    DisplayStatus {
        supported: display::SUPPORTED,
        stable_display: persisted.stable_display,
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
        .map_err(|err| CommandError::Invalid(format!("no data folder to keep the setting in: {err}")))?;
    display::write(&dir, DisplaySettings { stable_display: on })
        .map_err(|err| CommandError::Invalid(format!("could not save the display setting: {err}")))?;
    log.append(
        "info",
        "display",
        if on {
            "stable display on, from next launch"
        } else {
            "stable display off, from next launch"
        },
    );
    Ok(display_status(app))
}

#[cfg(test)]
mod tests {
    use super::{build_local_frame, sanitize_suggested_filename, LocalRequest};

    fn make_local_req(json_str: &str) -> LocalRequest {
        serde_json::from_str(json_str).expect("parse request")
    }

    #[test]
    fn a_local_request_gets_its_kind_and_id_and_nothing_else() {
        let frame = build_local_frame(
            "local_chat_request",
            make_local_req(r#"{"request_id":"local-1","query":"hola","model":"gemma3:4b"}"#),
        )
        .expect("build frame");
        let parsed: serde_json::Value = serde_json::from_str(&frame).unwrap();
        assert_eq!(parsed["kind"], "local_chat_request");
        assert_eq!(parsed["request_id"], "local-1");
        assert_eq!(parsed["query"], "hola");
        assert!(parsed.get("api_key").is_none());
    }

    #[test]
    fn a_local_request_cannot_smuggle_a_key_or_a_kind() {
        for invalid_json in [
            r#"{"request_id":"local-1","api_key":"sk-anything"}"#,
            r#"{"request_id":"local-1","kind":"agent_request"}"#,
        ] {
            assert!(build_local_frame("local_chat_request", make_local_req(invalid_json)).is_err());
        }
    }

    #[test]
    fn keeps_a_reasonable_name() {
        assert_eq!(
            sanitize_suggested_filename("hoomaan-axial-T8-13cm-cut.png"),
            "hoomaan-axial-T8-13cm-cut.png"
        );
    }

    #[test]
    fn adds_the_extension_when_it_is_missing() {
        assert_eq!(sanitize_suggested_filename("section"), "section.png");
    }

    #[test]
    fn refuses_to_carry_a_path() {
        assert_eq!(sanitize_suggested_filename("../../etc/passwd"), "etcpasswd.png");
        assert_eq!(
            sanitize_suggested_filename("C:\\Windows\\system32\\a"),
            "CWindowssystem32a.png"
        );
    }

    #[test]
    fn falls_back_rather_than_naming_a_file_nothing() {
        assert!(sanitize_suggested_filename("...").is_empty());
        assert!(sanitize_suggested_filename("").is_empty());
    }
}
