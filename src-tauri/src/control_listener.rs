//! Background worker thread listening on the IPC control named pipe.
//!
//! Accepts incoming client connections one at a time, reads incoming lines,
//! and passes them to a dispatch callback without blocking the main event thread.

#![cfg(windows)]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;

use crate::control_pipe::{ControlClient, ControlPipe, PipeError, PipeHandle};

/// Managed handle to an active named pipe listening background thread.
pub struct Listener {
    stopping: Arc<AtomicBool>,
    handle: Arc<PipeHandle>,
    name: String,
    thread: Option<JoinHandle<()>>,
}

impl Listener {
    /// Instantiates the named pipe and starts the client accept loop on a dedicated thread.
    pub fn start<F>(name: &str, mut on_line: F) -> Result<Self, PipeError>
    where
        F: FnMut(&str) + Send + 'static,
    {
        let mut pipe = ControlPipe::create(name)?;
        let handle = pipe.shared_handle();
        let stopping = Arc::new(AtomicBool::new(false));

        let stop_flag = Arc::clone(&stopping);
        let worker_thread = std::thread::Builder::new()
            .name("hoomaan-control".into())
            .spawn(move || {
                while !stop_flag.load(Ordering::SeqCst) {
                    if pipe.wait_for_client().is_err() {
                        break;
                    }
                    if stop_flag.load(Ordering::SeqCst) {
                        break;
                    }

                    loop {
                        match pipe.read_line() {
                            Ok(Some(msg)) => on_line(&msg),
                            Ok(None) => break,
                            Err(_) => break,
                        }
                        if stop_flag.load(Ordering::SeqCst) {
                            break;
                        }
                    }

                    pipe.disconnect();
                }
            })
            .map_err(|_| PipeError::Create(0))?;

        Ok(Self {
            stopping,
            handle,
            name: name.to_owned(),
            thread: Some(worker_thread),
        })
    }

    /// Returns the registered name of the named pipe.
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Signals the worker thread to terminate, cancelling any pending synchronous IO.
    pub fn stop(&mut self) {
        let Some(worker) = self.thread.take() else {
            return;
        };
        self.stopping.store(true, Ordering::SeqCst);
        self.handle.cancel_io();
        // Wake any thread blocked on ConnectNamedPipe by attempting a connection
        drop(ControlClient::connect(&self.name));
        let _ = worker.join();
    }
}

impl Drop for Listener {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicU32;
    use std::sync::mpsc;
    use std::sync::Mutex;
    use std::time::Duration;

    const TIMEOUT: Duration = Duration::from_secs(5);

    fn make_test_pipe_name() -> String {
        static ID: AtomicU32 = AtomicU32::new(0);
        format!(
            "hoomaan-listener-{}-{}",
            std::process::id(),
            ID.fetch_add(1, Ordering::Relaxed)
        )
    }

    fn record_lines() -> (Arc<Mutex<Vec<String>>>, impl FnMut(&str) + Send + 'static) {
        let storage = Arc::new(Mutex::new(Vec::new()));
        let dest = Arc::clone(&storage);
        (storage, move |line: &str| {
            dest.lock().unwrap().push(line.to_owned());
        })
    }

    fn spawn_listener() -> (Listener, Arc<Mutex<Vec<String>>>) {
        let (storage, handler) = record_lines();
        let listener = Listener::start(&make_test_pipe_name(), handler).expect("must start listener");
        (listener, storage)
    }

    fn open_client(listener: &Listener) -> ControlClient {
        ControlClient::connect(listener.name()).expect("must connect client")
    }

    fn poll_until_count(storage: &Arc<Mutex<Vec<String>>>, target: usize) -> Vec<String> {
        let limit = std::time::Instant::now() + TIMEOUT;
        loop {
            let entries = storage.lock().unwrap().clone();
            if entries.len() >= target || std::time::Instant::now() > limit {
                return entries;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    fn safely_stop(mut listener: Listener) {
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            listener.stop();
            let _ = tx.send(());
        });
        assert!(
            rx.recv_timeout(TIMEOUT).is_ok(),
            "stop failed to return within timeout"
        );
    }

    #[test]
    fn stopping_while_nobody_has_connected_returns() {
        let (listener, _) = spawn_listener();
        safely_stop(listener);
    }

    #[test]
    fn stopping_with_a_silent_client_attached_returns() {
        let (listener, _) = spawn_listener();
        let _client = ControlClient::connect(listener.name()).expect("client connected");
        safely_stop(listener);
    }

    #[test]
    fn a_connected_client_is_obeyed() {
        let (listener, storage) = spawn_listener();
        let client = open_client(&listener);
        client
            .write_line(r#"{"action":"reset_view"}"#)
            .expect("write succeeded");
        assert_eq!(poll_until_count(&storage, 1), vec![r#"{"action":"reset_view"}"#]);
    }

    #[test]
    fn what_a_client_sends_is_handed_over_untouched() {
        let (listener, storage) = spawn_listener();
        let client = open_client(&listener);
        for item in ["one", r#"{"type":"done"}"#, "not json"] {
            client.write_line(item).expect("write line");
        }
        assert_eq!(
            poll_until_count(&storage, 3),
            vec!["one", r#"{"type":"done"}"#, "not json"]
        );
        drop(client);
        safely_stop(listener);
    }

    #[test]
    fn a_client_leaving_does_not_end_the_listener() {
        let (listener, storage) = spawn_listener();

        let client1 = open_client(&listener);
        client1.write_line("one").expect("write line");
        assert_eq!(poll_until_count(&storage, 1).len(), 1);
        drop(client1);

        let client2 = open_client(&listener);
        client2.write_line("two").expect("write line");
        assert_eq!(poll_until_count(&storage, 2), vec!["one", "two"]);
    }

    #[test]
    fn a_client_that_floods_is_dropped_and_the_next_one_is_served() {
        let (listener, storage) = spawn_listener();

        let flooding = ControlClient::connect(listener.name()).expect("flood client");
        let bulk = vec![b'x'; 8192];
        while flooding.write_raw(&bulk).is_ok() {}
        drop(flooding);

        let good_client = open_client(&listener);
        good_client.write_line("still here").expect("write line");
        assert_eq!(poll_until_count(&storage, 1), vec!["still here"]);
    }

    #[test]
    fn dropping_the_listener_stops_it() {
        let (listener, _) = spawn_listener();
        let pipe_name = listener.name().to_owned();
        drop(listener);

        assert!(ControlClient::connect(&pipe_name).is_err());
    }
}
