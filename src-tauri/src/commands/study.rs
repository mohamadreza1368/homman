//! Study journal database and virtual case simulation commands.

use tauri::{command, State};

use crate::study_db::{
    CaseDigest, CaseFile, CaseFinding, CaseInput, CaseSymptom, FindingInput, ImportSummary,
    JournalExport, Note, NoteInput, SessionDetail, SessionSummary, StudyCoverage, StudyDb,
    StudyError, StudyStats, SymptomInput, TurnInput, UsageBucket, UsageInput,
};

#[derive(Debug, thiserror::Error)]
pub enum StudyCommandError {
    #[error(transparent)]
    Database(#[from] StudyError),
}

impl serde::Serialize for StudyCommandError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type StudyResult<T> = Result<T, StudyCommandError>;

#[command]
pub fn save_study_turn(db: State<'_, StudyDb>, turn: TurnInput) -> StudyResult<()> {
    db.save_turn(turn)?;
    Ok(())
}

#[command]
pub fn record_case_result(
    db: State<'_, StudyDb>,
    session_id: String,
    score: i64,
    verdict: String,
) -> StudyResult<()> {
    db.record_case_result(&session_id, score, &verdict)?;
    Ok(())
}

#[command]
pub fn list_study_sessions(
    db: State<'_, StudyDb>,
    query: Option<String>,
    organ_id: Option<String>,
    case_id: Option<String>,
    limit: i64,
) -> StudyResult<Vec<SessionSummary>> {
    Ok(db.list_sessions(query.as_deref(), organ_id.as_deref(), case_id.as_deref(), limit)?)
}

#[command]
pub fn get_study_session(
    db: State<'_, StudyDb>,
    session_id: String,
) -> StudyResult<Option<SessionDetail>> {
    Ok(db.session(&session_id)?)
}

#[command]
pub fn rename_study_session(
    db: State<'_, StudyDb>,
    session_id: String,
    title: String,
) -> StudyResult<()> {
    db.rename_session(&session_id, &title)?;
    Ok(())
}

#[command]
pub fn delete_study_session(db: State<'_, StudyDb>, session_id: String) -> StudyResult<()> {
    db.delete_session(&session_id)?;
    Ok(())
}

#[command]
pub fn create_case(db: State<'_, StudyDb>, case: CaseInput) -> StudyResult<String> {
    Ok(db.create_case(case)?)
}

#[command]
pub fn list_cases(
    db: State<'_, StudyDb>,
    system: Option<String>,
    limit: i64,
) -> StudyResult<Vec<CaseFile>> {
    Ok(db.list_cases(system.as_deref(), limit)?)
}

#[command]
pub fn reveal_case_answer(db: State<'_, StudyDb>, case_id: String) -> StudyResult<Option<String>> {
    Ok(db.reveal_answer(&case_id)?)
}

#[command]
pub fn case_digest(db: State<'_, StudyDb>, case_id: String) -> StudyResult<Option<CaseDigest>> {
    Ok(db.digest(&case_id)?)
}

#[command]
pub fn delete_case(db: State<'_, StudyDb>, case_id: String) -> StudyResult<()> {
    db.delete_case(&case_id)?;
    Ok(())
}

#[command]
pub fn add_case_symptom(
    db: State<'_, StudyDb>,
    case_id: String,
    symptom: SymptomInput,
) -> StudyResult<String> {
    Ok(db.add_symptom(&case_id, symptom)?)
}

#[command]
pub fn case_symptoms(db: State<'_, StudyDb>, case_id: String) -> StudyResult<Vec<CaseSymptom>> {
    Ok(db.symptoms(&case_id)?)
}

#[command]
pub fn delete_case_symptom(db: State<'_, StudyDb>, symptom_id: String) -> StudyResult<()> {
    db.delete_symptom(&symptom_id)?;
    Ok(())
}

#[command]
pub fn add_case_finding(
    db: State<'_, StudyDb>,
    case_id: String,
    finding: FindingInput,
) -> StudyResult<String> {
    Ok(db.add_finding(&case_id, finding)?)
}

#[command]
pub fn case_findings(db: State<'_, StudyDb>, case_id: String) -> StudyResult<Vec<CaseFinding>> {
    Ok(db.findings(&case_id)?)
}

#[command]
pub fn delete_case_finding(db: State<'_, StudyDb>, finding_id: String) -> StudyResult<()> {
    db.delete_finding(&finding_id)?;
    Ok(())
}

#[command]
pub fn create_note(db: State<'_, StudyDb>, note: NoteInput) -> StudyResult<String> {
    Ok(db.create_note(note)?)
}

#[command]
pub fn update_note(
    db: State<'_, StudyDb>,
    note_id: String,
    title: String,
    body: String,
    organ_ids: Vec<String>,
) -> StudyResult<()> {
    db.update_note(&note_id, &title, &body, &organ_ids)?;
    Ok(())
}

#[command]
pub fn delete_note(db: State<'_, StudyDb>, note_id: String) -> StudyResult<()> {
    db.delete_note(&note_id)?;
    Ok(())
}

#[command]
pub fn list_notes(
    db: State<'_, StudyDb>,
    organ_id: Option<String>,
    limit: i64,
) -> StudyResult<Vec<Note>> {
    Ok(db.list_notes(organ_id.as_deref(), limit)?)
}

#[command]
pub fn study_stats(db: State<'_, StudyDb>) -> StudyResult<StudyStats> {
    Ok(db.stats()?)
}

#[command]
pub fn study_coverage(db: State<'_, StudyDb>) -> StudyResult<StudyCoverage> {
    Ok(db.coverage()?)
}

#[command]
pub fn record_token_usage(db: State<'_, StudyDb>, usage: UsageInput) -> StudyResult<()> {
    db.record_usage(usage)?;
    Ok(())
}

#[command]
pub fn token_usage(
    db: State<'_, StudyDb>,
    bucket: UsageBucket,
    limit: i64,
) -> StudyResult<Vec<(String, i64)>> {
    Ok(db.usage(bucket, limit)?)
}

#[command]
pub fn export_journal(db: State<'_, StudyDb>) -> StudyResult<JournalExport> {
    Ok(db.export_journal()?)
}

#[command]
pub fn import_journal(db: State<'_, StudyDb>, payload: JournalExport) -> StudyResult<ImportSummary> {
    Ok(db.import_journal(payload)?)
}

#[command]
pub fn save_view_image(
    db: State<'_, StudyDb>,
    view_id: String,
    image_bytes: Vec<u8>,
) -> StudyResult<()> {
    db.save_image(&view_id, &image_bytes)?;
    Ok(())
}
