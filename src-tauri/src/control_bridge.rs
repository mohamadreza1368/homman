//! IPC Control Bridge supervisor coordinating external automation clients.
//!
//! Provides a user-toggled local control pipe for external AI agents or development
//! tooling to direct the 3D scene. Ensures the bridge remains strictly opt-in,
//! enforces user-isolated pipe names, and isolates scene commands.

use serde::Serialize;
use std::fmt;

/// Current runtime metrics and status of the IPC control bridge.
#[derive(Debug, Clone, Serialize)]
pub struct BridgeStatus {
    pub supported: bool,
    pub running: bool,
    pub pipe: Option<String>,
    pub accepted: u64,
    pub refused: u64,
    #[serde(default)]
    pub server: Option<String>,
}

impl BridgeStatus {
    fn stopped(supported: bool) -> Self {
        Self {
            supported,
            running: false,
            pipe: None,
            accepted: 0,
            refused: 0,
            server: None,
        }
    }
}

/// Errors occurring while activating or managing the control bridge.
#[derive(Debug)]
#[cfg_attr(not(windows), allow(dead_code))]
pub enum BridgeError {
    #[cfg_attr(windows, allow(dead_code))]
    Unsupported,
    NoIdentity(String),
    AlreadyOpen,
    Pipe(String),
}

impl fmt::Display for BridgeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unsupported => write!(
                f,
                "this build has no control bridge; it is available on Windows"
            ),
            Self::NoIdentity(reason) => write!(f, "could not identify this account: {reason}"),
            Self::AlreadyOpen => write!(
                f,
                "another HOOMAAN window signed in as you already has the bridge on. \
                 Turn it off there, or use that window."
            ),
            Self::Pipe(reason) => write!(f, "{reason}"),
        }
    }
}

impl std::error::Error for BridgeError {}

#[cfg(windows)]
mod platform {
    use super::{BridgeError, BridgeStatus};

    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::{Arc, Mutex};

    use crate::control_acl;
    use crate::control_frame;
    use crate::control_listener::Listener;
    use crate::control_pipe::{pipe_path, PipeError, ERROR_PIPE_BUSY};

    const PIPE_STEM: &str = "hoomaan-control";

    struct Running {
        listener: Listener,
        tally: Arc<Tally>,
    }

    #[derive(Default)]
    struct Tally {
        accepted: AtomicU64,
        refused: AtomicU64,
        sequence: AtomicU64,
    }

    #[derive(Default)]
    pub struct ControlBridge {
        running: Mutex<Option<Running>>,
        stem: Option<String>,
    }

    impl ControlBridge {
        pub fn status(&self) -> BridgeStatus {
            let guard = self.locked();
            match guard.as_ref() {
                None => BridgeStatus::stopped(true),
                Some(state) => BridgeStatus {
                    supported: true,
                    running: true,
                    pipe: Some(pipe_path(state.listener.name())),
                    accepted: state.tally.accepted.load(Ordering::Relaxed),
                    refused: state.tally.refused.load(Ordering::Relaxed),
                    server: None,
                },
            }
        }

        pub fn start<F>(&self, on_command: F) -> Result<BridgeStatus, BridgeError>
        where
            F: Fn(String) + Send + 'static,
        {
            let mut guard = self.locked();
            if guard.is_some() {
                drop(guard);
                return Ok(self.status());
            }

            let name = match self.stem.as_deref() {
                Some(stem) => stem.to_owned(),
                None => pipe_name()?,
            };
            let tally = Arc::new(Tally::default());
            let counters = Arc::clone(&tally);

            let listener = Listener::start(&name, move |line| {
                let seq = counters.sequence.fetch_add(1, Ordering::Relaxed);
                match control_frame::admit(line, &control_frame::bridge_request_id(seq)) {
                    Ok(frame) => {
                        counters.accepted.fetch_add(1, Ordering::Relaxed);
                        on_command(frame);
                    }
                    Err(_) => {
                        counters.refused.fetch_add(1, Ordering::Relaxed);
                    }
                }
            })
            .map_err(|err| match err {
                PipeError::Create(ERROR_PIPE_BUSY) => BridgeError::AlreadyOpen,
                other => BridgeError::Pipe(other.to_string()),
            })?;

            *guard = Some(Running { listener, tally });
            drop(guard);
            Ok(self.status())
        }

        pub fn stop(&self) {
            let active = self.locked().take();
            drop(active);
        }

        #[cfg(test)]
        fn for_test() -> Self {
            static COUNTER: AtomicU64 = AtomicU64::new(0);
            let id = COUNTER.fetch_add(1, Ordering::Relaxed);
            Self {
                running: Mutex::new(None),
                stem: Some(format!("{PIPE_STEM}-test-{}-{id}", std::process::id())),
            }
        }

        fn locked(&self) -> std::sync::MutexGuard<'_, Option<Running>> {
            self.running
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
        }
    }

    fn pipe_name() -> Result<String, BridgeError> {
        let sid = control_acl::current_user_sid()
            .map_err(|err| BridgeError::NoIdentity(err.to_string()))?;
        Ok(format!("{PIPE_STEM}-{sid}"))
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use crate::control_pipe::ControlClient;
        use std::sync::mpsc;
        use std::time::Duration;

        const PATIENCE: Duration = Duration::from_secs(5);

        fn scene_command(action: &str) -> String {
            format!(r#"{{"type":"scene_command","command":{{"action":"{action}"}}}}"#)
        }

        #[test]
        fn a_new_bridge_is_off() {
            let bridge = ControlBridge::for_test();
            let status = bridge.status();
            assert!(status.supported);
            assert!(!status.running);
            assert!(status.pipe.is_none());
        }

        #[test]
        fn starting_names_a_pipe() {
            let bridge = ControlBridge::for_test();
            let status = bridge.start(|_| {}).expect("started");
            assert!(status.running);
            assert!(status
                .pipe
                .as_deref()
                .expect("a pipe path")
                .starts_with(r"\\.\pipe\"));
            bridge.stop();
        }

        #[test]
        fn the_pipe_is_named_for_this_account() {
            let sid = control_acl::current_user_sid().expect("this process has an identity");
            assert!(pipe_name().expect("a name").ends_with(&sid));
        }

        #[test]
        fn stopping_gives_up_the_pipe() {
            let bridge = ControlBridge::for_test();
            let started = bridge.start(|_| {}).expect("started");
            let path = started.pipe.expect("a pipe path");

            bridge.stop();

            let status = bridge.status();
            assert!(!status.running);
            assert!(
                ControlClient::connect_now(name_of(&path)).is_err(),
                "the pipe outlived the bridge"
            );
        }

        #[test]
        fn a_second_start_keeps_the_listener_it_already_had() {
            let bridge = ControlBridge::for_test();
            let first = bridge.start(|_| {}).expect("started");
            let second = bridge.start(|_| {}).expect("still started");
            assert_eq!(first.pipe, second.pipe);
            bridge.stop();
        }

        #[test]
        fn a_connected_client_reaches_the_sink() {
            let (tx, rx) = mpsc::channel();
            let bridge = ControlBridge::for_test();
            let status = bridge
                .start(move |frame| {
                    let _ = tx.send(frame);
                })
                .expect("started");

            let client = ControlClient::connect(name_of(status.pipe.as_deref().expect("a path")))
                .expect("connected");
            client
                .write_line(&scene_command("reset_view"))
                .expect("the command was sent");

            let frame = rx.recv_timeout(PATIENCE).expect("the sink received it");
            let parsed: serde_json::Value =
                serde_json::from_str(&frame).expect("the sink receives valid JSON");
            assert_eq!(parsed["type"], "scene_command");
            assert_eq!(parsed["command"]["action"], "reset_view");
            assert_eq!(parsed["request_id"], "bridge-0");

            drop(client);
            bridge.stop();
            assert_eq!(
                bridge.status().accepted,
                0,
                "the counters died with the run"
            );
        }

        #[test]
        fn what_is_not_a_scene_command_is_counted_and_dropped() {
            let (tx, rx) = mpsc::channel();
            let bridge = ControlBridge::for_test();
            let status = bridge
                .start(move |frame| {
                    let _ = tx.send(frame);
                })
                .expect("started");

            let client = ControlClient::connect(name_of(status.pipe.as_deref().expect("a path")))
                .expect("connected");

            client
                .write_line(r#"{"type":"done","request_id":"x"}"#)
                .expect("sent");
            client.write_line("not json at all").expect("sent");
            client
                .write_line(&scene_command("reset_view"))
                .expect("sent");

            let frame = rx
                .recv_timeout(PATIENCE)
                .expect("the scene command arrived");
            assert!(frame.contains("reset_view"));
            assert!(
                rx.try_recv().is_err(),
                "something other than the scene command reached the sink"
            );

            let status = bridge.status();
            assert_eq!(status.accepted, 1);
            assert_eq!(status.refused, 2);

            drop(client);
            bridge.stop();
        }

        #[test]
        fn each_admitted_frame_gets_its_own_id() {
            let (tx, rx) = mpsc::channel();
            let bridge = ControlBridge::for_test();
            let status = bridge
                .start(move |frame| {
                    let _ = tx.send(frame);
                })
                .expect("started");

            let client = ControlClient::connect(name_of(status.pipe.as_deref().expect("a path")))
                .expect("connected");
            for _ in 0..3 {
                client
                    .write_line(&scene_command("reset_view"))
                    .expect("sent");
            }

            let mut ids = Vec::new();
            for _ in 0..3 {
                let frame = rx.recv_timeout(PATIENCE).expect("a frame");
                let parsed: serde_json::Value = serde_json::from_str(&frame).expect("JSON");
                ids.push(parsed["request_id"].as_str().expect("an id").to_owned());
            }
            assert_eq!(ids, vec!["bridge-0", "bridge-1", "bridge-2"]);

            drop(client);
            bridge.stop();
        }

        fn name_of(path: &str) -> &str {
            path.rsplit('\\').next().expect("a pipe name")
        }
    }
}

#[cfg(not(windows))]
mod platform {
    use super::{BridgeError, BridgeStatus};

    #[derive(Default)]
    pub struct ControlBridge {
        _private: (),
    }

    impl ControlBridge {
        pub fn status(&self) -> BridgeStatus {
            BridgeStatus::stopped(false)
        }

        pub fn start<F>(&self, _on_command: F) -> Result<BridgeStatus, BridgeError>
        where
            F: Fn(String) + Send + 'static,
        {
            Err(BridgeError::Unsupported)
        }

        pub fn stop(&self) {}
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn there_is_no_bridge_here_and_it_says_so() {
            let bridge = ControlBridge::default();
            let status = bridge.status();
            assert!(!status.supported);
            assert!(!status.running);
            assert!(bridge.start(|_| {}).is_err());
            bridge.stop();
        }
    }
}

pub use platform::ControlBridge;
