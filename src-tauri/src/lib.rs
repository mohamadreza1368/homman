mod app_log;
mod commands;
#[cfg(windows)]
mod control_acl;
mod control_bridge;
#[cfg(windows)]
mod control_frame;
#[cfg(windows)]
mod control_listener;
#[cfg(windows)]
mod control_pipe;
mod display;
mod keyring_store;
pub(crate) mod sidecar;
mod study_db;
mod window_fit;

use tauri::{Manager, RunEvent, WindowEvent};

use app_log::AppLog;
use control_bridge::ControlBridge;
use sidecar::EngineHandle;
use study_db::StudyDb;

const STUDY_DB_FILENAME: &str = "study.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Early configuration of hardware acceleration switches prior to WebView initialization.
    display::apply_before_window();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(EngineHandle::default())
        .manage(ControlBridge::default())
        .invoke_handler(tauri::generate_handler![
            commands::save_api_key,
            commands::has_api_key,
            commands::delete_api_key,
            commands::ask_agent,
            commands::list_models,
            commands::ask_local,
            commands::list_local_models,
            commands::engine_status,
            commands::restart_engine,
            commands::cancel_request,
            commands::save_study_turn,
            commands::record_case_result,
            commands::list_study_sessions,
            commands::get_study_session,
            commands::rename_study_session,
            commands::delete_study_session,
            commands::create_case,
            commands::list_cases,
            commands::reveal_case_answer,
            commands::case_digest,
            commands::delete_case,
            commands::add_case_symptom,
            commands::case_symptoms,
            commands::delete_case_symptom,
            commands::add_case_finding,
            commands::case_findings,
            commands::delete_case_finding,
            commands::create_note,
            commands::update_note,
            commands::delete_note,
            commands::list_notes,
            commands::study_stats,
            commands::study_coverage,
            commands::record_token_usage,
            commands::token_usage,
            commands::export_journal,
            commands::import_journal,
            commands::save_view_image,
            commands::bridge_status,
            commands::start_bridge,
            commands::stop_bridge,
            commands::read_log,
            commands::log_location,
            commands::clear_log,
            commands::log_event,
            commands::save_log_copy,
            commands::display_status,
            commands::set_stable_display,
        ])
        .setup(|app| {
            if let Some(main_win) = app.get_webview_window("main") {
                window_fit::fit_to_work_area(&main_win);
            }

            let app_data_path = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            let logger = AppLog::open(&app_data_path.join(app_log::LOG_FILE));
            logger.append(
                "info",
                "app",
                &format!("started, version {}", app.package_info().version),
            );
            app.manage(logger);

            let db_path = app_data_path.join(STUDY_DB_FILENAME);
            app.manage(StudyDb::open(&db_path));
            app.state::<AppLog>()
                .append("info", "journal", "opened");

            if let Err(spawn_err) = sidecar::spawn(app.handle()) {
                eprintln!("[engine] {spawn_err}");
                app.state::<AppLog>()
                    .append("error", "engine", &format!("failed to start: {spawn_err}"));
                let _ = tauri::Emitter::emit(
                    app.handle(),
                    sidecar::ENGINE_EVENT,
                    serde_json::json!({
                        "type": "error",
                        "request_id": serde_json::Value::Null,
                        "code": "internal_error",
                        "message": spawn_err.to_string(),
                    }),
                );
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Destroyed) {
                window.app_handle().state::<EngineHandle>().shutdown();
                window.app_handle().state::<ControlBridge>().stop();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building HOOMAAN")
        .run(|app, event| {
            if matches!(event, RunEvent::Exit) {
                app.state::<EngineHandle>().shutdown();
                app.state::<ControlBridge>().stop();
            }
        });
}
