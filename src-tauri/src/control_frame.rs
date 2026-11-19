//! Frame validation and normalization for incoming external bridge commands.
//!
//! Enforces protocol boundaries: only frames with `type == "scene_command"` are
//! admitted. Injects a deterministic `bridge-` stamped `request_id` and filters
//! out unauthorized payload properties.

#![cfg(windows)]

use std::fmt;

use serde_json::{json, Value};

/// Admissible message type allowed across the bridge pipe.
const PERMITTED_TYPE: &str = "scene_command";

/// Reason for rejecting an external frame.
#[derive(Debug, PartialEq, Eq)]
pub enum Refusal {
    NotJson,
    NotAnObject,
    WrongType(String),
    NoType,
    NoCommand,
    NoAction,
}

impl fmt::Display for Refusal {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotJson => write!(f, "not JSON"),
            Self::NotAnObject => write!(f, "not a JSON object"),
            Self::WrongType(name) => {
                write!(f, "only {PERMITTED_TYPE} frames cross this bridge, not {name:?}")
            }
            Self::NoType => write!(f, "no \"type\" field"),
            Self::NoCommand => write!(f, "no \"command\" object"),
            Self::NoAction => write!(f, "the command names no \"action\""),
        }
    }
}

/// Validates an incoming raw line and reconstructs an authorized `scene_command` frame.
pub fn admit(line: &str, request_id: &str) -> Result<String, Refusal> {
    // Strip optional leading UTF-8 Byte Order Mark (e.g. from PowerShell pipelines)
    let payload = line.strip_prefix('\u{feff}').unwrap_or(line);

    let parsed: Value = serde_json::from_str(payload).map_err(|_| Refusal::NotJson)?;
    let root = parsed.as_object().ok_or(Refusal::NotAnObject)?;

    match root.get("type").and_then(Value::as_str) {
        Some(PERMITTED_TYPE) => {}
        Some(mismatch) => return Err(Refusal::WrongType(mismatch.to_owned())),
        None => return Err(Refusal::NoType),
    }

    let command_obj = root
        .get("command")
        .filter(|v| v.is_object())
        .ok_or(Refusal::NoCommand)?;

    if command_obj.get("action").and_then(Value::as_str).is_none() {
        return Err(Refusal::NoAction);
    }

    Ok(json!({
        "type": PERMITTED_TYPE,
        "request_id": request_id,
        "command": command_obj,
    })
    .to_string())
}

/// Generates an identifiable sequence-tagged request ID for bridged commands.
pub fn bridge_request_id(sequence: u64) -> String {
    format!("bridge-{sequence}")
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_ID: &str = "bridge-1";

    fn parse_admitted(line: &str) -> Value {
        serde_json::from_str(&admit(line, TEST_ID).expect("should admit frame"))
            .expect("must be valid JSON")
    }

    #[test]
    fn a_scene_command_crosses() {
        let out = parse_admitted(
            r#"{"type":"scene_command","request_id":"x","command":{"action":"reset_view"}}"#,
        );
        assert_eq!(out["type"], "scene_command");
        assert_eq!(out["command"]["action"], "reset_view");
    }

    #[test]
    fn the_clients_request_id_is_replaced() {
        let out = parse_admitted(
            r#"{"type":"scene_command","request_id":"pretending-to-be-a-chat-turn","command":{"action":"reset_view"}}"#,
        );
        assert_eq!(out["request_id"], TEST_ID);
    }

    #[test]
    fn a_frame_with_no_request_id_still_gets_one() {
        let out = parse_admitted(r#"{"type":"scene_command","command":{"action":"reset_view"}}"#);
        assert_eq!(out["request_id"], TEST_ID);
    }

    #[test]
    fn extra_fields_do_not_travel() {
        let out = parse_admitted(
            r#"{"type":"scene_command","command":{"action":"reset_view"},"smuggled":"payload"}"#,
        );
        assert_eq!(out.as_object().expect("object").len(), 3);
        assert!(out.get("smuggled").is_none());
    }

    #[test]
    fn the_command_itself_is_passed_through_whole() {
        let out = parse_admitted(
            r#"{"type":"scene_command","command":{"action":"isolate_structures","organ_ids":["a","b"]}}"#,
        );
        assert_eq!(out["command"]["organ_ids"][1], "b");
    }

    #[test]
    fn a_leading_byte_order_mark_is_dropped_rather_than_refused() {
        let out = parse_admitted(
            "\u{feff}{\"type\":\"scene_command\",\"command\":{\"action\":\"reset_view\"}}",
        );
        assert_eq!(out["command"]["action"], "reset_view");
    }

    #[test]
    fn only_one_mark_and_only_at_the_start() {
        assert!(matches!(
            admit(
                "\u{feff}\u{feff}{\"type\":\"scene_command\",\"command\":{\"action\":\"reset_view\"}}",
                TEST_ID
            ),
            Err(Refusal::NotJson)
        ));
        assert!(matches!(
            admit(
                "{\"type\":\"scene_command\",\u{feff}\"command\":{\"action\":\"reset_view\"}}",
                TEST_ID
            ),
            Err(Refusal::NotJson)
        ));
    }

    #[test]
    fn every_other_frame_type_is_refused() {
        for kind in [
            "done",
            "text_delta",
            "error",
            "case_verdict",
            "ready",
            "models",
        ] {
            let line = format!(r#"{{"type":"{kind}","request_id":"x"}}"#);
            assert_eq!(
                admit(&line, TEST_ID),
                Err(Refusal::WrongType(kind.to_owned())),
                "a {kind} frame crossed the bridge"
            );
        }
    }

    #[test]
    fn a_frame_with_no_type_is_refused() {
        assert_eq!(
            admit(r#"{"command":{"action":"reset_view"}}"#, TEST_ID),
            Err(Refusal::NoType)
        );
    }

    #[test]
    fn a_command_that_is_not_an_object_is_refused() {
        assert_eq!(
            admit(r#"{"type":"scene_command","command":"reset_view"}"#, TEST_ID),
            Err(Refusal::NoCommand)
        );
    }

    #[test]
    fn a_command_with_no_action_is_refused() {
        assert_eq!(
            admit(
                r#"{"type":"scene_command","command":{"organ_id":"heart_l"}}"#,
                TEST_ID
            ),
            Err(Refusal::NoAction)
        );
    }

    #[test]
    fn rubbish_is_refused_rather_than_forwarded() {
        assert_eq!(admit("not json at all", TEST_ID), Err(Refusal::NotJson));
        assert_eq!(admit("", TEST_ID), Err(Refusal::NotJson));
        assert_eq!(admit("[1,2,3]", TEST_ID), Err(Refusal::NotAnObject));
        assert_eq!(admit("\"a string\"", TEST_ID), Err(Refusal::NotAnObject));
    }

    #[test]
    fn an_action_this_file_never_heard_of_still_crosses() {
        let out = parse_admitted(r#"{"type":"scene_command","command":{"action":"invent_a_new_organ"}}"#);
        assert_eq!(out["command"]["action"], "invent_a_new_organ");
    }

    #[test]
    fn the_stamped_id_says_where_the_frame_came_from() {
        assert_eq!(bridge_request_id(7), "bridge-7");
        assert!(bridge_request_id(0).starts_with("bridge-"));
    }
}
