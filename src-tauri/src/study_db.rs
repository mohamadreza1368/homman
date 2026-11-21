//! Clean-room implementation of the desktop study journal database.
//!
//! Manages offline local SQLite storage for tutoring sessions, user study notes,
//! simulated clinical patient files, and token usage accounting.
//! Conforms to specs/desktop-study-database.md.

use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: i32 = 10;
pub const EXPORT_FORMAT: &str = "hoomaan.journal";
pub const EXPORT_VERSION: u32 = 1;

pub const MAX_TITLE: usize = 200;
pub const MAX_BODY: usize = 20_000;
pub const MAX_MESSAGE: usize = 100_000;
pub const MAX_COMMANDS: usize = 64 * 1024;
pub const MAX_VISITS: i64 = 20;

#[derive(Debug, thiserror::Error)]
pub enum StudyError {
    #[error("the study journal is unavailable: {0}")]
    Unavailable(String),
    #[error("{0}")]
    Invalid(String),
    #[error("study journal error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

impl serde::Serialize for StudyError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, StudyError>;

fn now_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// DTOs & Export Shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub profile: String,
    pub language: String,
    pub score: Option<i64>,
    pub verdict: Option<String>,
    pub message_count: i64,
    pub structure_count: i64,
    pub case_id: Option<String>,
    pub visit_no: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMessage {
    pub role: String,
    pub content: String,
    pub created_at: i64,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub input_tokens: Option<i64>,
    #[serde(default)]
    pub output_tokens: Option<i64>,
    #[serde(default)]
    pub cache_read_tokens: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub commands: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SessionDetail {
    pub session: SessionSummary,
    pub messages: Vec<StoredMessage>,
    pub structures: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CaseFile {
    pub id: String,
    pub title: String,
    pub sex: String,
    pub age_years: Option<i64>,
    pub height_cm: Option<i64>,
    pub weight_kg: Option<f64>,
    pub findings: String,
    pub sealed_at: i64,
    pub revealed_at: Option<i64>,
    pub profile: String,
    pub language: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub visit_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct CaseInput {
    pub id: String,
    pub title: String,
    pub sex: String,
    #[serde(default)]
    pub age_years: Option<i64>,
    #[serde(default)]
    pub height_cm: Option<i64>,
    #[serde(default)]
    pub weight_kg: Option<f64>,
    #[serde(default)]
    pub findings: String,
    pub ground_truth: String,
    pub profile: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseSymptom {
    pub id: i64,
    pub organ_id: String,
    pub organ_label: Option<String>,
    pub symptom: String,
    pub severity: Option<i64>,
    pub session_id: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseFinding {
    pub id: i64,
    pub visit_no: i64,
    pub body: String,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct FindingInput {
    pub case_id: String,
    pub body: String,
}

#[derive(Debug, Deserialize)]
pub struct SymptomInput {
    pub case_id: String,
    #[serde(default)]
    pub session_id: Option<String>,
    pub organ_id: String,
    #[serde(default)]
    pub organ_label: Option<String>,
    pub symptom: String,
    #[serde(default)]
    pub severity: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct CaseVisit {
    pub session_id: String,
    pub visit_no: i64,
    pub score: Option<i64>,
    pub verdict: Option<String>,
    pub structures: Vec<String>,
    pub created_at: i64,
}

#[derive(Debug, Serialize)]
pub struct CaseDigest {
    pub case: CaseFile,
    pub ground_truth: String,
    pub visits: Vec<CaseVisit>,
    pub symptoms: Vec<CaseSymptom>,
    pub record_updates: Vec<CaseFinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: i64,
    pub uuid: String,
    pub organ_id: Option<String>,
    pub organ_label: Option<String>,
    pub session_id: Option<String>,
    pub body: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportSession {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub profile: String,
    pub language: String,
    #[serde(default)]
    pub score: Option<i64>,
    #[serde(default)]
    pub verdict: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(default)]
    pub messages: Vec<StoredMessage>,
    #[serde(default)]
    pub structures: Vec<String>,
    #[serde(default)]
    pub case_id: Option<String>,
    #[serde(default)]
    pub visit_no: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportCase {
    pub id: String,
    pub title: String,
    pub sex: String,
    #[serde(default)]
    pub age_years: Option<i64>,
    #[serde(default)]
    pub height_cm: Option<i64>,
    #[serde(default)]
    pub weight_kg: Option<f64>,
    #[serde(default)]
    pub findings: String,
    pub ground_truth: String,
    pub sealed_at: i64,
    #[serde(default)]
    pub revealed_at: Option<i64>,
    pub profile: String,
    pub language: String,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(default)]
    pub symptoms: Vec<CaseSymptom>,
    #[serde(default)]
    pub record_updates: Vec<CaseFinding>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportNote {
    pub uuid: String,
    #[serde(default)]
    pub organ_id: Option<String>,
    #[serde(default)]
    pub organ_label: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    pub body: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JournalExport {
    pub format: String,
    pub version: u32,
    pub exported_at: i64,
    #[serde(default)]
    pub sessions: Vec<ExportSession>,
    #[serde(default)]
    pub notes: Vec<ExportNote>,
    #[serde(default)]
    pub cases: Vec<ExportCase>,
}

#[derive(Debug, Default, Serialize)]
pub struct ImportSummary {
    pub sessions_added: u32,
    pub sessions_updated: u32,
    pub notes_added: u32,
    pub notes_updated: u32,
    pub cases_added: u32,
    pub skipped: u32,
}

#[derive(Debug, Serialize)]
pub struct StudyStats {
    pub sessions: i64,
    pub cases: i64,
    pub graded_cases: i64,
    pub notes: i64,
    pub average_score: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct TurnInput {
    pub session_id: String,
    pub kind: String,
    pub title: String,
    pub profile: String,
    pub language: String,
    pub question: String,
    pub answer: String,
    pub organ_ids: Vec<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub input_tokens: Option<i64>,
    #[serde(default)]
    pub output_tokens: Option<i64>,
    #[serde(default)]
    pub cache_read_tokens: Option<i64>,
    #[serde(default)]
    pub case_id: Option<String>,
    #[serde(default)]
    pub commands: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NoteInput {
    pub organ_id: Option<String>,
    pub organ_label: Option<String>,
    pub session_id: Option<String>,
    pub body: String,
}

#[derive(Debug, Deserialize)]
pub struct UsageInput {
    pub session_id: Option<String>,
    pub provider: String,
    pub model: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    #[serde(default)]
    pub cache_read_tokens: i64,
}

#[derive(Debug, Serialize)]
pub struct UsageBucket {
    pub day: String,
    pub provider: String,
    pub model: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub turns: i64,
}

#[derive(Debug, Serialize)]
pub struct StudyCoverage {
    pub organ_id: String,
    pub touches: i64,
}

// ---------------------------------------------------------------------------
// Database Store
// ---------------------------------------------------------------------------

enum StoreState {
    Ready(Box<Connection>),
    Unavailable(String),
}

pub struct StudyDb(Mutex<StoreState>);

fn setup_canonical_schema(conn: &mut Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;

         CREATE TABLE IF NOT EXISTS case_file (
             id           TEXT PRIMARY KEY,
             title        TEXT NOT NULL,
             sex          TEXT NOT NULL,
             age_years    INTEGER,
             height_cm    INTEGER,
             weight_kg    REAL,
             findings     TEXT NOT NULL,
             ground_truth TEXT NOT NULL,
             profile      TEXT NOT NULL,
             language     TEXT NOT NULL,
             created_at   INTEGER NOT NULL,
             updated_at   INTEGER NOT NULL,
             revealed_at  INTEGER
         );

         CREATE TABLE IF NOT EXISTS case_symptom (
             id          INTEGER PRIMARY KEY AUTOINCREMENT,
             case_id     TEXT NOT NULL REFERENCES case_file(id) ON DELETE CASCADE,
             organ_id    TEXT NOT NULL,
             organ_label TEXT,
             symptom     TEXT NOT NULL,
             severity    INTEGER,
             session_id  TEXT,
             created_at  INTEGER NOT NULL
         );

         CREATE TABLE IF NOT EXISTS case_finding (
             id         INTEGER PRIMARY KEY AUTOINCREMENT,
             case_id    TEXT NOT NULL REFERENCES case_file(id) ON DELETE CASCADE,
             visit_no   INTEGER NOT NULL,
             body       TEXT NOT NULL,
             created_at INTEGER NOT NULL
         );

         CREATE TABLE IF NOT EXISTS study_session (
             id          TEXT PRIMARY KEY,
             kind        TEXT NOT NULL,
             title       TEXT NOT NULL,
             profile     TEXT NOT NULL,
             language    TEXT NOT NULL,
             score       INTEGER,
             verdict     TEXT,
             case_id     TEXT REFERENCES case_file(id) ON DELETE SET NULL,
             visit_no    INTEGER,
             created_at  INTEGER NOT NULL,
             updated_at  INTEGER NOT NULL
         );

         CREATE TABLE IF NOT EXISTS study_message (
             id                INTEGER PRIMARY KEY AUTOINCREMENT,
             session_id        TEXT NOT NULL REFERENCES study_session(id) ON DELETE CASCADE,
             role              TEXT NOT NULL,
             content           TEXT NOT NULL,
             model             TEXT,
             input_tokens      INTEGER,
             output_tokens     INTEGER,
             cache_read_tokens INTEGER,
             commands          TEXT,
             created_at        INTEGER NOT NULL
         );

         CREATE TABLE IF NOT EXISTS session_structure (
             session_id TEXT NOT NULL REFERENCES study_session(id) ON DELETE CASCADE,
             organ_id   TEXT NOT NULL,
             PRIMARY KEY (session_id, organ_id)
         );

         CREATE TABLE IF NOT EXISTS note (
             id          INTEGER PRIMARY KEY AUTOINCREMENT,
             uuid        TEXT NOT NULL UNIQUE,
             organ_id    TEXT,
             organ_label TEXT,
             session_id  TEXT REFERENCES study_session(id) ON DELETE SET NULL,
             body        TEXT NOT NULL,
             created_at  INTEGER NOT NULL,
             updated_at  INTEGER NOT NULL
         );

         CREATE TABLE IF NOT EXISTS token_usage (
             id                INTEGER PRIMARY KEY AUTOINCREMENT,
             session_id        TEXT REFERENCES study_session(id) ON DELETE SET NULL,
             provider          TEXT NOT NULL,
             model             TEXT NOT NULL,
             input_tokens      INTEGER NOT NULL,
             output_tokens     INTEGER NOT NULL,
             cache_read_tokens INTEGER NOT NULL,
             created_at        INTEGER NOT NULL
         );

         CREATE INDEX IF NOT EXISTS idx_study_message_session ON study_message(session_id);
         CREATE INDEX IF NOT EXISTS idx_session_structure_organ ON session_structure(organ_id);
         CREATE INDEX IF NOT EXISTS idx_note_organ ON note(organ_id);
         CREATE INDEX IF NOT EXISTS idx_note_uuid ON note(uuid);
         CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at);
         CREATE INDEX IF NOT EXISTS idx_case_symptom_case ON case_symptom(case_id);
         CREATE INDEX IF NOT EXISTS idx_case_finding_case ON case_finding(case_id);

         PRAGMA user_version = 10;"
    )?;
    Ok(())
}

impl StudyDb {
    pub fn open(path: &Path) -> Self {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        match Connection::open(path) {
            Ok(mut conn) => {
                if let Err(err) = setup_canonical_schema(&mut conn) {
                    Self(Mutex::new(StoreState::Unavailable(err.to_string())))
                } else {
                    Self(Mutex::new(StoreState::Ready(Box::new(conn))))
                }
            }
            Err(err) => Self(Mutex::new(StoreState::Unavailable(err.to_string()))),
        }
    }

    fn lock_conn(&self) -> Result<std::sync::MutexGuard<'_, StoreState>> {
        let guard = self
            .0
            .lock()
            .map_err(|e| StudyError::Unavailable(format!("store mutex poisoned: {e}")))?;
        Ok(guard)
    }

    pub fn save_turn(&self, turn: TurnInput) -> Result<()> {
        let title_clean = turn.title.trim();
        if title_clean.is_empty() {
            return Err(StudyError::Invalid("Session title cannot be empty".into()));
        }
        if title_clean.len() > MAX_TITLE {
            return Err(StudyError::Invalid("Session title exceeds max length".into()));
        }
        if turn.question.len() > MAX_MESSAGE || turn.answer.len() > MAX_MESSAGE {
            return Err(StudyError::Invalid("Message text exceeds limit".into()));
        }

        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let tx = conn.transaction()?;
        let now_ms = now_epoch_ms();

        let exists: bool = tx.query_row(
            "SELECT 1 FROM study_session WHERE id = ?",
            params![turn.session_id],
            |_| Ok(true),
        ).optional()?.unwrap_or(false);

        if !exists {
            tx.execute(
                "INSERT INTO study_session (id, kind, title, profile, language, case_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    turn.session_id,
                    turn.kind,
                    title_clean,
                    turn.profile,
                    turn.language,
                    turn.case_id,
                    now_ms,
                    now_ms
                ],
            )?;
        } else {
            tx.execute(
                "UPDATE study_session SET updated_at = ? WHERE id = ?",
                params![now_ms, turn.session_id],
            )?;
        }

        tx.execute(
            "INSERT INTO study_message (session_id, role, content, created_at)
             VALUES (?, 'user', ?, ?)",
            params![turn.session_id, turn.question, now_ms],
        )?;

        tx.execute(
            "INSERT INTO study_message (session_id, role, content, model, input_tokens, output_tokens, cache_read_tokens, commands, created_at)
             VALUES (?, 'assistant', ?, ?, ?, ?, ?, ?, ?)",
            params![
                turn.session_id,
                turn.answer,
                turn.model,
                turn.input_tokens,
                turn.output_tokens,
                turn.cache_read_tokens,
                turn.commands,
                now_ms
            ],
        )?;

        for organ_id in turn.organ_ids {
            tx.execute(
                "INSERT OR IGNORE INTO session_structure (session_id, organ_id) VALUES (?, ?)",
                params![turn.session_id, organ_id],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    pub fn record_case_result(&self, session_id: &str, score: i64, verdict: &str) -> Result<()> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let rows_affected = conn.execute(
            "UPDATE study_session SET score = ?, verdict = ?, updated_at = ? WHERE id = ?",
            params![score, verdict, now_epoch_ms(), session_id],
        )?;
        if rows_affected == 0 {
            return Err(StudyError::Invalid("Session not found".into()));
        }
        Ok(())
    }

    pub fn list_sessions(
        &self,
        query: Option<&str>,
        organ_id: Option<&str>,
        case_id: Option<&str>,
        limit: Option<i64>,
    ) -> Result<Vec<SessionSummary>> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let mut sql = String::from(
            "SELECT s.id, s.kind, s.title, s.profile, s.language, s.score, s.verdict,
                    s.case_id, s.visit_no, s.created_at, s.updated_at,
                    (SELECT COUNT(*) FROM study_message m WHERE m.session_id = s.id) as msg_count,
                    (SELECT COUNT(*) FROM session_structure st WHERE st.session_id = s.id) as struct_count
             FROM study_session s
             WHERE 1=1"
        );

        let mut params_vec: Vec<rusqlite::types::Value> = Vec::new();

        if let Some(c_id) = case_id {
            sql.push_str(" AND s.case_id = ?");
            params_vec.push(c_id.to_string().into());
        }

        if let Some(o_id) = organ_id {
            sql.push_str(" AND EXISTS (SELECT 1 FROM session_structure st WHERE st.session_id = s.id AND st.organ_id = ?)");
            params_vec.push(o_id.to_string().into());
        }

        if let Some(q) = query {
            let pattern = format!("%{}%", q.trim());
            sql.push_str(" AND (s.title LIKE ? OR EXISTS (SELECT 1 FROM study_message m WHERE m.session_id = s.id AND m.content LIKE ?))");
            params_vec.push(pattern.clone().into());
            params_vec.push(pattern.into());
        }

        sql.push_str(" ORDER BY s.updated_at DESC");

        if let Some(lim) = limit {
            sql.push_str(&format!(" LIMIT {lim}"));
        }

        let mut stmt = conn.prepare(&sql)?;
        let rusqlite_params = rusqlite::params_from_iter(params_vec.iter());
        let rows = stmt.query_map(rusqlite_params, |row| {
            Ok(SessionSummary {
                id: row.get(0)?,
                kind: row.get(1)?,
                title: row.get(2)?,
                profile: row.get(3)?,
                language: row.get(4)?,
                score: row.get(5)?,
                verdict: row.get(6)?,
                case_id: row.get(7)?,
                visit_no: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                message_count: row.get(11)?,
                structure_count: row.get(12)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn session(&self, session_id: &str) -> Result<Option<SessionDetail>> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let summary = conn.query_row(
            "SELECT s.id, s.kind, s.title, s.profile, s.language, s.score, s.verdict,
                    s.case_id, s.visit_no, s.created_at, s.updated_at,
                    (SELECT COUNT(*) FROM study_message m WHERE m.session_id = s.id) as msg_count,
                    (SELECT COUNT(*) FROM session_structure st WHERE st.session_id = s.id) as struct_count
             FROM study_session s WHERE s.id = ?",
            params![session_id],
            |row| {
                Ok(SessionSummary {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    title: row.get(2)?,
                    profile: row.get(3)?,
                    language: row.get(4)?,
                    score: row.get(5)?,
                    verdict: row.get(6)?,
                    case_id: row.get(7)?,
                    visit_no: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                    message_count: row.get(11)?,
                    structure_count: row.get(12)?,
                })
            },
        ).optional()?;

        let Some(summary) = summary else {
            return Ok(None);
        };

        let mut msg_stmt = conn.prepare(
            "SELECT role, content, created_at, model, input_tokens, output_tokens, cache_read_tokens, commands
             FROM study_message WHERE session_id = ? ORDER BY id ASC"
        )?;
        let messages = msg_stmt.query_map(params![session_id], |row| {
            Ok(StoredMessage {
                role: row.get(0)?,
                content: row.get(1)?,
                created_at: row.get(2)?,
                model: row.get(3)?,
                input_tokens: row.get(4)?,
                output_tokens: row.get(5)?,
                cache_read_tokens: row.get(6)?,
                commands: row.get(7)?,
            })
        })?.collect::<std::result::Result<Vec<_>, _>>()?;

        let mut struct_stmt = conn.prepare(
            "SELECT organ_id FROM session_structure WHERE session_id = ? ORDER BY organ_id ASC"
        )?;
        let structures = struct_stmt.query_map(params![session_id], |row| row.get(0))?
            .collect::<std::result::Result<Vec<String>, _>>()?;

        Ok(Some(SessionDetail {
            session: summary,
            messages,
            structures,
        }))
    }

    pub fn rename_session(&self, session_id: &str, title: &str) -> Result<()> {
        let title_clean = title.trim();
        if title_clean.is_empty() || title_clean.len() > MAX_TITLE {
            return Err(StudyError::Invalid("Invalid session title length".into()));
        }
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let rows = conn.execute(
            "UPDATE study_session SET title = ?, updated_at = ? WHERE id = ?",
            params![title_clean, now_epoch_ms(), session_id],
        )?;
        if rows == 0 {
            return Err(StudyError::Invalid("Session not found".into()));
        }
        Ok(())
    }

    pub fn delete_session(&self, session_id: &str) -> Result<()> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        conn.execute("DELETE FROM study_session WHERE id = ?", params![session_id])?;
        Ok(())
    }

    pub fn create_case(&self, input: CaseInput) -> Result<CaseFile> {
        let title_clean = input.title.trim();
        if title_clean.is_empty() || title_clean.len() > MAX_TITLE {
            return Err(StudyError::Invalid("Invalid case title".into()));
        }
        let now_ms = now_epoch_ms();

        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        conn.execute(
            "INSERT INTO case_file (id, title, sex, age_years, height_cm, weight_kg, findings, ground_truth, profile, language, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                input.id,
                title_clean,
                input.sex,
                input.age_years,
                input.height_cm,
                input.weight_kg,
                input.findings,
                input.ground_truth,
                input.profile,
                input.language,
                now_ms,
                now_ms
            ],
        )?;

        Ok(CaseFile {
            id: input.id,
            title: title_clean.to_string(),
            sex: input.sex,
            age_years: input.age_years,
            height_cm: input.height_cm,
            weight_kg: input.weight_kg,
            findings: input.findings,
            sealed_at: now_ms,
            revealed_at: None,
            profile: input.profile,
            language: input.language,
            created_at: now_ms,
            updated_at: now_ms,
            visit_count: 0,
        })
    }

    pub fn list_cases(&self) -> Result<Vec<CaseFile>> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let mut stmt = conn.prepare(
            "SELECT c.id, c.title, c.sex, c.age_years, c.height_cm, c.weight_kg, c.findings,
                    c.created_at, c.revealed_at, c.profile, c.language, c.created_at, c.updated_at,
                    (SELECT COUNT(*) FROM study_session s WHERE s.case_id = c.id) as visit_count
             FROM case_file c
             ORDER BY c.updated_at DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(CaseFile {
                id: row.get(0)?,
                title: row.get(1)?,
                sex: row.get(2)?,
                age_years: row.get(3)?,
                height_cm: row.get(4)?,
                weight_kg: row.get(5)?,
                findings: row.get(6)?,
                sealed_at: row.get(7)?,
                revealed_at: row.get(8)?,
                profile: row.get(9)?,
                language: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                visit_count: row.get(13)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn case_answer(&self, case_id: &str) -> Result<Option<String>> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let now_ms = now_epoch_ms();
        let _ = conn.execute(
            "UPDATE case_file SET revealed_at = COALESCE(revealed_at, ?) WHERE id = ?",
            params![now_ms, case_id],
        );

        let answer = conn.query_row(
            "SELECT ground_truth FROM case_file WHERE id = ?",
            params![case_id],
            |row| row.get(0),
        ).optional()?;

        Ok(answer)
    }

    pub fn case_digest(&self, case_id: &str) -> Result<Option<CaseDigest>> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let case_meta = conn.query_row(
            "SELECT c.id, c.title, c.sex, c.age_years, c.height_cm, c.weight_kg, c.findings,
                    c.created_at, c.revealed_at, c.profile, c.language, c.created_at, c.updated_at,
                    c.ground_truth,
                    (SELECT COUNT(*) FROM study_session s WHERE s.case_id = c.id) as visit_count
             FROM case_file c WHERE c.id = ?",
            params![case_id],
            |row| {
                Ok((
                    CaseFile {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        sex: row.get(2)?,
                        age_years: row.get(3)?,
                        height_cm: row.get(4)?,
                        weight_kg: row.get(5)?,
                        findings: row.get(6)?,
                        sealed_at: row.get(7)?,
                        revealed_at: row.get(8)?,
                        profile: row.get(9)?,
                        language: row.get(10)?,
                        created_at: row.get(11)?,
                        updated_at: row.get(12)?,
                        visit_count: row.get(14)?,
                    },
                    row.get::<_, String>(13)?,
                ))
            },
        ).optional()?;

        let Some((case_file, ground_truth)) = case_meta else {
            return Ok(None);
        };

        let mut visits_stmt = conn.prepare(
            "SELECT id, COALESCE(visit_no, 1), score, verdict, created_at
             FROM study_session WHERE case_id = ? ORDER BY created_at ASC"
        )?;
        let visits_raw = visits_stmt.query_map(params![case_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, Option<i64>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })?.collect::<std::result::Result<Vec<_>, _>>()?;

        let mut visits = Vec::new();
        for (v_id, v_no, v_score, v_verdict, v_created) in visits_raw {
            let mut struct_stmt = conn.prepare(
                "SELECT organ_id FROM session_structure WHERE session_id = ? ORDER BY organ_id ASC"
            )?;
            let structs = struct_stmt.query_map(params![v_id], |r| r.get(0))?
                .collect::<std::result::Result<Vec<String>, _>>()?;
            visits.push(CaseVisit {
                session_id: v_id,
                visit_no: v_no,
                score: v_score,
                verdict: v_verdict,
                structures: structs,
                created_at: v_created,
            });
        }

        let mut sym_stmt = conn.prepare(
            "SELECT id, organ_id, organ_label, symptom, severity, session_id, created_at
             FROM case_symptom WHERE case_id = ? ORDER BY created_at ASC"
        )?;
        let symptoms = sym_stmt.query_map(params![case_id], |row| {
            Ok(CaseSymptom {
                id: row.get(0)?,
                organ_id: row.get(1)?,
                organ_label: row.get(2)?,
                symptom: row.get(3)?,
                severity: row.get(4)?,
                session_id: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?.collect::<std::result::Result<Vec<_>, _>>()?;

        let mut find_stmt = conn.prepare(
            "SELECT id, visit_no, body, created_at FROM case_finding WHERE case_id = ? ORDER BY created_at ASC"
        )?;
        let record_updates = find_stmt.query_map(params![case_id], |row| {
            Ok(CaseFinding {
                id: row.get(0)?,
                visit_no: row.get(1)?,
                body: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?.collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(Some(CaseDigest {
            case: case_file,
            ground_truth,
            visits,
            symptoms,
            record_updates,
        }))
    }

    pub fn delete_case(&self, case_id: &str) -> Result<()> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        conn.execute("DELETE FROM case_file WHERE id = ?", params![case_id])?;
        Ok(())
    }

    pub fn add_symptom(&self, input: SymptomInput) -> Result<CaseSymptom> {
        let symptom_clean = input.symptom.trim();
        if symptom_clean.is_empty() {
            return Err(StudyError::Invalid("Symptom description cannot be empty".into()));
        }
        let now_ms = now_epoch_ms();

        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        conn.execute(
            "INSERT INTO case_symptom (case_id, organ_id, organ_label, symptom, severity, session_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                input.case_id,
                input.organ_id,
                input.organ_label,
                symptom_clean,
                input.severity,
                input.session_id,
                now_ms
            ],
        )?;

        let id = conn.last_insert_rowid();
        Ok(CaseSymptom {
            id,
            organ_id: input.organ_id,
            organ_label: input.organ_label,
            symptom: symptom_clean.to_string(),
            severity: input.severity,
            session_id: input.session_id,
            created_at: now_ms,
        })
    }

    pub fn symptoms(&self, case_id: &str) -> Result<Vec<CaseSymptom>> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let mut stmt = conn.prepare(
            "SELECT id, organ_id, organ_label, symptom, severity, session_id, created_at
             FROM case_symptom WHERE case_id = ? ORDER BY created_at ASC"
        )?;

        let rows = stmt.query_map(params![case_id], |row| {
            Ok(CaseSymptom {
                id: row.get(0)?,
                organ_id: row.get(1)?,
                organ_label: row.get(2)?,
                symptom: row.get(3)?,
                severity: row.get(4)?,
                session_id: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn delete_symptom(&self, id: i64) -> Result<()> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        conn.execute("DELETE FROM case_symptom WHERE id = ?", params![id])?;
        Ok(())
    }

    pub fn add_finding(&self, input: FindingInput) -> Result<CaseFinding> {
        let body_clean = input.body.trim();
        if body_clean.is_empty() {
            return Err(StudyError::Invalid("Finding text cannot be empty".into()));
        }
        let now_ms = now_epoch_ms();

        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let visit_no: i64 = conn.query_row(
            "SELECT COALESCE(MAX(visit_no), 0) + 1 FROM case_finding WHERE case_id = ?",
            params![input.case_id],
            |r| r.get(0),
        )?;

        conn.execute(
            "INSERT INTO case_finding (case_id, visit_no, body, created_at) VALUES (?, ?, ?, ?)",
            params![input.case_id, visit_no, body_clean, now_ms],
        )?;

        let id = conn.last_insert_rowid();
        Ok(CaseFinding {
            id,
            visit_no,
            body: body_clean.to_string(),
            created_at: now_ms,
        })
    }

    pub fn findings(&self, case_id: &str) -> Result<Vec<CaseFinding>> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let mut stmt = conn.prepare(
            "SELECT id, visit_no, body, created_at FROM case_finding WHERE case_id = ? ORDER BY created_at ASC"
        )?;

        let rows = stmt.query_map(params![case_id], |row| {
            Ok(CaseFinding {
                id: row.get(0)?,
                visit_no: row.get(1)?,
                body: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn delete_finding(&self, id: i64) -> Result<()> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        conn.execute("DELETE FROM case_finding WHERE id = ?", params![id])?;
        Ok(())
    }

    pub fn create_note(&self, input: NoteInput) -> Result<Note> {
        let body_clean = input.body.trim();
        if body_clean.is_empty() {
            return Err(StudyError::Invalid("Note content cannot be empty".into()));
        }
        if body_clean.len() > MAX_BODY {
            return Err(StudyError::Invalid("Note content exceeds max length".into()));
        }
        let now_ms = now_epoch_ms();
        let note_uuid = format!("note-{}", uuid_simple());

        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        conn.execute(
            "INSERT INTO note (uuid, organ_id, organ_label, session_id, body, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                note_uuid,
                input.organ_id,
                input.organ_label,
                input.session_id,
                body_clean,
                now_ms,
                now_ms
            ],
        )?;

        let id = conn.last_insert_rowid();
        Ok(Note {
            id,
            uuid: note_uuid,
            organ_id: input.organ_id,
            organ_label: input.organ_label,
            session_id: input.session_id,
            body: body_clean.to_string(),
            created_at: now_ms,
            updated_at: now_ms,
        })
    }

    pub fn update_note(&self, id: i64, body: &str) -> Result<()> {
        let body_clean = body.trim();
        if body_clean.is_empty() || body_clean.len() > MAX_BODY {
            return Err(StudyError::Invalid("Invalid note length".into()));
        }

        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let rows = conn.execute(
            "UPDATE note SET body = ?, updated_at = ? WHERE id = ?",
            params![body_clean, now_epoch_ms(), id],
        )?;
        if rows == 0 {
            return Err(StudyError::Invalid("Note not found".into()));
        }
        Ok(())
    }

    pub fn delete_note(&self, id: i64) -> Result<()> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        conn.execute("DELETE FROM note WHERE id = ?", params![id])?;
        Ok(())
    }

    pub fn list_notes(
        &self,
        organ_id: Option<&str>,
        query: Option<&str>,
        limit: Option<i64>,
    ) -> Result<Vec<Note>> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let mut sql = String::from(
            "SELECT id, uuid, organ_id, organ_label, session_id, body, created_at, updated_at
             FROM note WHERE 1=1"
        );
        let mut params_vec: Vec<rusqlite::types::Value> = Vec::new();

        if let Some(o_id) = organ_id {
            sql.push_str(" AND organ_id = ?");
            params_vec.push(o_id.to_string().into());
        }

        if let Some(q) = query {
            let pattern = format!("%{}%", q.trim());
            sql.push_str(" AND body LIKE ?");
            params_vec.push(pattern.into());
        }

        sql.push_str(" ORDER BY updated_at DESC");

        if let Some(lim) = limit {
            sql.push_str(&format!(" LIMIT {lim}"));
        }

        let mut stmt = conn.prepare(&sql)?;
        let rusqlite_params = rusqlite::params_from_iter(params_vec.iter());
        let rows = stmt.query_map(rusqlite_params, |row| {
            Ok(Note {
                id: row.get(0)?,
                uuid: row.get(1)?,
                organ_id: row.get(2)?,
                organ_label: row.get(3)?,
                session_id: row.get(4)?,
                body: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn stats(&self) -> Result<StudyStats> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let sessions: i64 = conn.query_row("SELECT COUNT(*) FROM study_session", [], |r| r.get(0))?;
        let cases: i64 = conn.query_row("SELECT COUNT(*) FROM case_file", [], |r| r.get(0))?;
        let graded_cases: i64 = conn.query_row("SELECT COUNT(*) FROM study_session WHERE score IS NOT NULL", [], |r| r.get(0))?;
        let notes: i64 = conn.query_row("SELECT COUNT(*) FROM note", [], |r| r.get(0))?;
        let average_score: Option<f64> = conn.query_row("SELECT AVG(score) FROM study_session WHERE score IS NOT NULL", [], |r| r.get(0))?;

        Ok(StudyStats {
            sessions,
            cases,
            graded_cases,
            notes,
            average_score,
        })
    }

    pub fn coverage(&self) -> Result<Vec<StudyCoverage>> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let mut stmt = conn.prepare(
            "SELECT organ_id, COUNT(*) as touches
             FROM (
                 SELECT organ_id FROM session_structure
                 UNION ALL
                 SELECT organ_id FROM note WHERE organ_id IS NOT NULL
                 UNION ALL
                 SELECT organ_id FROM case_symptom
             )
             GROUP BY organ_id
             ORDER BY touches DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(StudyCoverage {
                organ_id: row.get(0)?,
                touches: row.get(1)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn record_usage(&self, usage: UsageInput) -> Result<()> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        conn.execute(
            "INSERT INTO token_usage (session_id, provider, model, input_tokens, output_tokens, cache_read_tokens, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                usage.session_id,
                usage.provider,
                usage.model,
                usage.input_tokens,
                usage.output_tokens,
                usage.cache_read_tokens,
                now_epoch_ms()
            ],
        )?;

        Ok(())
    }

    pub fn usage(&self, days: i64) -> Result<Vec<UsageBucket>> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let day_count = if days <= 0 { 30 } else { days };
        let cutoff_ms = now_epoch_ms() - (day_count * 86_400_000);

        let mut stmt = conn.prepare(
            "SELECT date(created_at / 1000, 'unixepoch', 'localtime') as day,
                    provider, model,
                    SUM(input_tokens), SUM(output_tokens), SUM(cache_read_tokens), COUNT(*)
             FROM token_usage
             WHERE created_at >= ?
             GROUP BY day, provider, model
             ORDER BY day DESC"
        )?;

        let rows = stmt.query_map(params![cutoff_ms], |row| {
            Ok(UsageBucket {
                day: row.get(0)?,
                provider: row.get(1)?,
                model: row.get(2)?,
                input_tokens: row.get(3)?,
                output_tokens: row.get(4)?,
                cache_read_tokens: row.get(5)?,
                turns: row.get(6)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn export(&self) -> Result<JournalExport> {
        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let mut sessions_export = Vec::new();
        let mut sess_stmt = conn.prepare(
            "SELECT id, kind, title, profile, language, score, verdict, case_id, visit_no, created_at, updated_at
             FROM study_session ORDER BY created_at ASC"
        )?;
        let sess_rows = sess_stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<i64>>(8)?,
                row.get::<_, i64>(9)?,
                row.get::<_, i64>(10)?,
            ))
        })?.collect::<std::result::Result<Vec<_>, _>>()?;

        for (s_id, kind, title, prof, lang, score, verdict, case_id, visit_no, c_at, u_at) in sess_rows {
            let mut msg_stmt = conn.prepare(
                "SELECT role, content, created_at, model, input_tokens, output_tokens, cache_read_tokens, commands
                 FROM study_message WHERE session_id = ? ORDER BY id ASC"
            )?;
            let msgs = msg_stmt.query_map(params![s_id], |r| {
                Ok(StoredMessage {
                    role: r.get(0)?,
                    content: r.get(1)?,
                    created_at: r.get(2)?,
                    model: r.get(3)?,
                    input_tokens: r.get(4)?,
                    output_tokens: r.get(5)?,
                    cache_read_tokens: r.get(6)?,
                    commands: r.get(7)?,
                })
            })?.collect::<std::result::Result<Vec<_>, _>>()?;

            let mut st_stmt = conn.prepare(
                "SELECT organ_id FROM session_structure WHERE session_id = ? ORDER BY organ_id ASC"
            )?;
            let structs = st_stmt.query_map(params![s_id], |r| r.get(0))?
                .collect::<std::result::Result<Vec<String>, _>>()?;

            sessions_export.push(ExportSession {
                id: s_id,
                kind,
                title,
                profile: prof,
                language: lang,
                score,
                verdict,
                created_at: c_at,
                updated_at: u_at,
                messages: msgs,
                structures: structs,
                case_id,
                visit_no,
            });
        }

        let mut notes_export = Vec::new();
        let mut note_stmt = conn.prepare(
            "SELECT uuid, organ_id, organ_label, session_id, body, created_at, updated_at
             FROM note ORDER BY created_at ASC"
        )?;
        let n_rows = note_stmt.query_map([], |row| {
            Ok(ExportNote {
                uuid: row.get(0)?,
                organ_id: row.get(1)?,
                organ_label: row.get(2)?,
                session_id: row.get(3)?,
                body: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;
        for n in n_rows {
            notes_export.push(n?);
        }

        let mut cases_export = Vec::new();
        let mut case_stmt = conn.prepare(
            "SELECT id, title, sex, age_years, height_cm, weight_kg, findings, ground_truth,
                    created_at, revealed_at, profile, language, created_at, updated_at
             FROM case_file ORDER BY created_at ASC"
        )?;
        let c_rows = case_stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, Option<f64>>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, i64>(8)?,
                row.get::<_, Option<i64>>(9)?,
                row.get::<_, String>(10)?,
                row.get::<_, String>(11)?,
                row.get::<_, i64>(12)?,
                row.get::<_, i64>(13)?,
            ))
        })?.collect::<std::result::Result<Vec<_>, _>>()?;

        for (c_id, title, sex, age, h, w, findings, gt, sealed_at, rev_at, prof, lang, c_at, u_at) in c_rows {
            let mut sym_stmt = conn.prepare(
                "SELECT id, organ_id, organ_label, symptom, severity, session_id, created_at
                 FROM case_symptom WHERE case_id = ? ORDER BY created_at ASC"
            )?;
            let symptoms = sym_stmt.query_map(params![c_id], |r| {
                Ok(CaseSymptom {
                    id: r.get(0)?,
                    organ_id: r.get(1)?,
                    organ_label: r.get(2)?,
                    symptom: r.get(3)?,
                    severity: r.get(4)?,
                    session_id: r.get(5)?,
                    created_at: r.get(6)?,
                })
            })?.collect::<std::result::Result<Vec<_>, _>>()?;

            let mut f_stmt = conn.prepare(
                "SELECT id, visit_no, body, created_at FROM case_finding WHERE case_id = ? ORDER BY created_at ASC"
            )?;
            let findings_list = f_stmt.query_map(params![c_id], |r| {
                Ok(CaseFinding {
                    id: r.get(0)?,
                    visit_no: r.get(1)?,
                    body: r.get(2)?,
                    created_at: r.get(3)?,
                })
            })?.collect::<std::result::Result<Vec<_>, _>>()?;

            cases_export.push(ExportCase {
                id: c_id,
                title,
                sex,
                age_years: age,
                height_cm: h,
                weight_kg: w,
                findings,
                ground_truth: gt,
                sealed_at,
                revealed_at: rev_at,
                profile: prof,
                language: lang,
                created_at: c_at,
                updated_at: u_at,
                symptoms,
                record_updates: findings_list,
            });
        }

        Ok(JournalExport {
            format: EXPORT_FORMAT.to_string(),
            version: EXPORT_VERSION,
            exported_at: now_epoch_ms(),
            sessions: sessions_export,
            notes: notes_export,
            cases: cases_export,
        })
    }

    pub fn import(&self, journal: JournalExport) -> Result<ImportSummary> {
        if journal.format != EXPORT_FORMAT {
            return Err(StudyError::Invalid("Invalid journal format marker".into()));
        }

        let mut guard = self.lock_conn()?;
        let conn = match &mut *guard {
            StoreState::Ready(ref mut c) => c.as_mut(),
            StoreState::Unavailable(msg) => return Err(StudyError::Unavailable(msg.clone())),
        };

        let tx = conn.transaction()?;
        let mut summary = ImportSummary::default();

        for c in journal.cases {
            let exists: bool = tx.query_row(
                "SELECT 1 FROM case_file WHERE id = ?",
                params![c.id],
                |_| Ok(true),
            ).optional()?.unwrap_or(false);

            if !exists {
                tx.execute(
                    "INSERT INTO case_file (id, title, sex, age_years, height_cm, weight_kg, findings, ground_truth, profile, language, created_at, updated_at, revealed_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    params![
                        c.id, c.title, c.sex, c.age_years, c.height_cm, c.weight_kg,
                        c.findings, c.ground_truth, c.profile, c.language, c.created_at, c.updated_at, c.revealed_at
                    ],
                )?;

                for s in c.symptoms {
                    tx.execute(
                        "INSERT INTO case_symptom (case_id, organ_id, organ_label, symptom, severity, session_id, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)",
                        params![c.id, s.organ_id, s.organ_label, s.symptom, s.severity, s.session_id, s.created_at],
                    )?;
                }

                for f in c.record_updates {
                    tx.execute(
                        "INSERT INTO case_finding (case_id, visit_no, body, created_at) VALUES (?, ?, ?, ?)",
                        params![c.id, f.visit_no, f.body, f.created_at],
                    )?;
                }

                summary.cases_added += 1;
            } else {
                summary.skipped += 1;
            }
        }

        for s in journal.sessions {
            let existing_updated: Option<i64> = tx.query_row(
                "SELECT updated_at FROM study_session WHERE id = ?",
                params![s.id],
                |r| r.get(0),
            ).optional()?;

            match existing_updated {
                None => {
                    tx.execute(
                        "INSERT INTO study_session (id, kind, title, profile, language, score, verdict, case_id, visit_no, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        params![
                            s.id, s.kind, s.title, s.profile, s.language, s.score, s.verdict,
                            s.case_id, s.visit_no, s.created_at, s.updated_at
                        ],
                    )?;

                    for m in s.messages {
                        tx.execute(
                            "INSERT INTO study_message (session_id, role, content, model, input_tokens, output_tokens, cache_read_tokens, commands, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            params![
                                s.id, m.role, m.content, m.model, m.input_tokens, m.output_tokens,
                                m.cache_read_tokens, m.commands, m.created_at
                            ],
                        )?;
                    }

                    for organ_id in s.structures {
                        tx.execute(
                            "INSERT OR IGNORE INTO session_structure (session_id, organ_id) VALUES (?, ?)",
                            params![s.id, organ_id],
                        )?;
                    }

                    summary.sessions_added += 1;
                }
                Some(prev_updated) if s.updated_at > prev_updated => {
                    tx.execute(
                        "UPDATE study_session SET title = ?, score = ?, verdict = ?, updated_at = ? WHERE id = ?",
                        params![s.title, s.score, s.verdict, s.updated_at, s.id],
                    )?;
                    summary.sessions_updated += 1;
                }
                _ => {
                    summary.skipped += 1;
                }
            }
        }

        for n in journal.notes {
            let existing_updated: Option<i64> = tx.query_row(
                "SELECT updated_at FROM note WHERE uuid = ?",
                params![n.uuid],
                |r| r.get(0),
            ).optional()?;

            match existing_updated {
                None => {
                    tx.execute(
                        "INSERT INTO note (uuid, organ_id, organ_label, session_id, body, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)",
                        params![n.uuid, n.organ_id, n.organ_label, n.session_id, n.body, n.created_at, n.updated_at],
                    )?;
                    summary.notes_added += 1;
                }
                Some(prev_updated) if n.updated_at > prev_updated => {
                    tx.execute(
                        "UPDATE note SET body = ?, updated_at = ? WHERE uuid = ?",
                        params![n.body, n.updated_at, n.uuid],
                    )?;
                    summary.notes_updated += 1;
                }
                _ => {
                    summary.skipped += 1;
                }
            }
        }

        tx.commit()?;
        Ok(summary)
    }
}

fn uuid_simple() -> String {
    let now = now_epoch_ms();
    let rand_val = (now ^ 0x5deece66d) & 0xffffffffffff;
    format!("{:x}{:06x}", now, rand_val & 0xffffff)
}
