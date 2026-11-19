import { invoke } from "@tauri-apps/api/core";

import { isTauriContext } from "./ipc";
import type { AiProvider, FiledMode, Language, UserProfile } from "./schemas";

export interface SessionSummary {
  id: string;
  kind: FiledMode;
  title: string;
  profile: UserProfile;
  language: Language;
  score: number | null;
  verdict: string | null;
  message_count: number;
  structure_count: number;
  case_id: string | null;
  visit_no: number | null;
  created_at: number;
  updated_at: number;
}

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  created_at: number;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  commands?: string;
}

export interface SessionDetail {
  session: SessionSummary;
  messages: StoredMessage[];
  structures: string[];
}

export interface StudyNote {
  id: number;
  organ_id: string | null;
  organ_label: string | null;
  session_id: string | null;
  body: string;
  created_at: number;
  updated_at: number;
}

export interface StudyStats {
  sessions: number;
  cases: number;
  graded_cases: number;
  notes: number;
  average_score: number | null;
}

export interface TurnInput {
  session_id: string;
  kind: FiledMode;
  title: string;
  profile: UserProfile;
  language: Language;
  question: string;
  answer: string;
  organ_ids: string[];
  model?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_tokens?: number | null;
  commands?: string | null;
  case_id?: string | null;
}

export interface NoteInput {
  organ_id: string | null;
  organ_label: string | null;
  session_id: string | null;
  body: string;
}

// ---------------------------------------------------------------------------
// Study Sessions
// ---------------------------------------------------------------------------

export function saveStudyTurn(turn: TurnInput): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("save_study_turn", { turn });
}

export function recordCaseResult(
  sessionId: string,
  score: number,
  verdict: string,
): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("record_case_result", { sessionId, score, verdict });
}

export function listStudySessions(
  query: string | null,
  organId: string | null,
  caseId: string | null,
  limit = 100,
): Promise<SessionSummary[]> {
  if (!isTauriContext()) return Promise.resolve([]);
  return invoke("list_study_sessions", { query, organId, caseId, limit });
}

export function getStudySession(sessionId: string): Promise<SessionDetail | null> {
  if (!isTauriContext()) return Promise.resolve(null);
  return invoke("get_study_session", { sessionId });
}

export function renameStudySession(sessionId: string, title: string): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("rename_study_session", { sessionId, title });
}

export function deleteStudySession(sessionId: string): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("delete_study_session", { sessionId });
}

// ---------------------------------------------------------------------------
// Virtual Clinical Patient Cases
// ---------------------------------------------------------------------------

export type CaseSex = "male" | "female";

export interface CaseFile {
  id: string;
  title: string;
  sex: CaseSex;
  age_years: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  findings: string;
  sealed_at: number;
  revealed_at: number | null;
  profile: UserProfile;
  language: Language;
  created_at: number;
  updated_at: number;
  visit_count: number;
}

export interface CaseInput {
  id: string;
  title: string;
  sex: CaseSex;
  age_years?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  findings: string;
  ground_truth: string;
  profile: UserProfile;
  language: Language;
}

export interface CaseVisit {
  session_id: string;
  visit_no: number;
  score: number | null;
  verdict: string | null;
  structures: string[];
  created_at: number;
}

export interface CaseSymptom {
  id: number;
  organ_id: string;
  organ_label: string | null;
  symptom: string;
  severity: number | null;
  session_id: string | null;
  created_at: number;
}

export interface SymptomInput {
  case_id: string;
  session_id?: string | null;
  organ_id: string;
  organ_label?: string | null;
  symptom: string;
  severity?: number | null;
}

export interface CaseFinding {
  id: number;
  visit_no: number;
  body: string;
  created_at: number;
}

export interface FindingInput {
  case_id: string;
  body: string;
}

export interface CaseDigest {
  case: CaseFile;
  ground_truth: string;
  visits: CaseVisit[];
  symptoms: CaseSymptom[];
  record_updates: CaseFinding[];
}

export const MAX_SEVERITY = 10;

export function addCaseSymptom(symptom: SymptomInput): Promise<CaseSymptom> {
  if (!isTauriContext()) {
    const timestamp = Date.now();
    return Promise.resolve({
      id: timestamp,
      organ_id: symptom.organ_id,
      organ_label: symptom.organ_label ?? null,
      symptom: symptom.symptom,
      severity: symptom.severity ?? null,
      session_id: symptom.session_id ?? null,
      created_at: timestamp,
    });
  }
  return invoke("add_case_symptom", { symptom });
}

export function caseSymptoms(caseId: string): Promise<CaseSymptom[]> {
  if (!isTauriContext()) return Promise.resolve([]);
  return invoke("case_symptoms", { caseId });
}

export function deleteCaseSymptom(id: number): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("delete_case_symptom", { id });
}

export function addCaseFinding(finding: FindingInput): Promise<CaseFinding> {
  if (!isTauriContext()) {
    const timestamp = Date.now();
    return Promise.resolve({
      id: timestamp,
      visit_no: 1,
      body: finding.body,
      created_at: timestamp,
    });
  }
  return invoke("add_case_finding", { finding });
}

export function caseFindings(caseId: string): Promise<CaseFinding[]> {
  if (!isTauriContext()) return Promise.resolve([]);
  return invoke("case_findings", { caseId });
}

export function deleteCaseFinding(id: number): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("delete_case_finding", { id });
}

export const MAX_VISITS = 20;

export function createCase(kase: CaseInput): Promise<CaseFile> {
  if (!isTauriContext()) {
    const currentMs = Date.now();
    return Promise.resolve({
      id: kase.id,
      title: kase.title,
      sex: kase.sex,
      age_years: kase.age_years ?? null,
      height_cm: kase.height_cm ?? null,
      weight_kg: kase.weight_kg ?? null,
      findings: kase.findings,
      sealed_at: currentMs,
      revealed_at: null,
      profile: kase.profile,
      language: kase.language,
      created_at: currentMs,
      updated_at: currentMs,
      visit_count: 0,
    });
  }
  return invoke("create_case", { case: kase });
}

export function listCases(): Promise<CaseFile[]> {
  if (!isTauriContext()) return Promise.resolve([]);
  return invoke("list_cases");
}

export function revealCaseAnswer(caseId: string): Promise<string | null> {
  if (!isTauriContext()) return Promise.resolve(null);
  return invoke("reveal_case_answer", { caseId });
}

export function caseDigest(caseId: string): Promise<CaseDigest | null> {
  if (!isTauriContext()) return Promise.resolve(null);
  return invoke("case_digest", { caseId });
}

export function deleteCase(caseId: string): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("delete_case", { caseId });
}

// ---------------------------------------------------------------------------
// Clinical & Anatomical Notes
// ---------------------------------------------------------------------------

export function createNote(note: NoteInput): Promise<StudyNote> {
  if (!isTauriContext()) {
    const now = Date.now();
    return Promise.resolve({
      id: now,
      organ_id: note.organ_id,
      organ_label: note.organ_label,
      session_id: note.session_id,
      body: note.body,
      created_at: now,
      updated_at: now,
    });
  }
  return invoke("create_note", { note });
}

export function updateNote(id: number, body: string): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("update_note", { id, body });
}

export function deleteNote(id: number): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("delete_note", { id });
}

export function listNotes(
  organId: string | null,
  query: string | null,
  limit = 200,
): Promise<StudyNote[]> {
  if (!isTauriContext()) return Promise.resolve([]);
  return invoke("list_notes", { organId, query, limit });
}

// ---------------------------------------------------------------------------
// Learning Statistics & Coverage
// ---------------------------------------------------------------------------

export function studyStats(): Promise<StudyStats> {
  if (!isTauriContext()) {
    return Promise.resolve({
      sessions: 0,
      cases: 0,
      graded_cases: 0,
      notes: 0,
      average_score: null,
    });
  }
  return invoke("study_stats");
}

export interface StudyCoverage {
  organ_id: string;
  touches: number;
}

export function studyCoverage(): Promise<StudyCoverage[]> {
  if (!isTauriContext()) return Promise.resolve([]);
  return invoke("study_coverage");
}

// ---------------------------------------------------------------------------
// Consumption & Token Telemetry
// ---------------------------------------------------------------------------

export interface UsageInput {
  session_id: string | null;
  provider: AiProvider;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
}

export interface UsageBucket {
  day: string;
  provider: AiProvider;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  turns: number;
}

export function recordTokenUsage(usage: UsageInput): Promise<void> {
  if (!isTauriContext()) return Promise.resolve();
  return invoke("record_token_usage", { usage });
}

export function tokenUsage(days: number): Promise<UsageBucket[]> {
  if (!isTauriContext()) return Promise.resolve([]);
  return invoke("token_usage", { days });
}

// ---------------------------------------------------------------------------
// Import / Export Portability
// ---------------------------------------------------------------------------

export interface ImportSummary {
  sessions_added: number;
  sessions_updated: number;
  notes_added: number;
  notes_updated: number;
  cases_added: number;
  skipped: number;
}

export function exportJournal(): Promise<string | null> {
  if (!isTauriContext()) return Promise.resolve(null);
  return invoke("export_journal");
}

export function importJournal(): Promise<ImportSummary | null> {
  if (!isTauriContext()) return Promise.resolve(null);
  return invoke("import_journal");
}

export function saveViewImage(
  pngBase64: string,
  fileName?: string,
): Promise<string | null> {
  if (!isTauriContext()) return Promise.resolve(null);
  return invoke("save_view_image", { pngBase64, fileName });
}
