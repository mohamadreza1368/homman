//! Low-level Windows Named Pipe abstraction and line-oriented transport.
//!
//! Enforces single-instance concurrency, message length bounds, and local-only
//! access control with `PIPE_REJECT_REMOTE_CLIENTS`.

#![cfg(windows)]

use std::ffi::c_void;
use std::fmt;
use std::os::windows::ffi::OsStrExt;
use std::ptr;
use std::sync::Arc;

use windows_sys::Win32::Foundation::{
    CloseHandle, GetLastError, LocalFree, ERROR_SUCCESS, GENERIC_READ, GENERIC_WRITE, HANDLE,
    INVALID_HANDLE_VALUE,
};
use windows_sys::Win32::Security::Authorization::{
    ConvertSecurityDescriptorToStringSecurityDescriptorW, GetSecurityInfo, SDDL_REVISION_1,
    SE_KERNEL_OBJECT,
};
use windows_sys::Win32::Security::DACL_SECURITY_INFORMATION;
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, ReadFile, WriteFile, FILE_SHARE_NONE, OPEN_EXISTING, PIPE_ACCESS_DUPLEX,
};
use windows_sys::Win32::System::Pipes::{
    ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe, WaitNamedPipeW, PIPE_READMODE_BYTE,
    PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_BYTE, PIPE_WAIT,
};
use windows_sys::Win32::System::IO::CancelIoEx;

use crate::control_acl::SecurityAttributes;

/// Maximum allowable line length in bytes before aborting an unbounded client stream.
pub const MAX_LINE: usize = 64 * 1024;

/// Single concurrent active connection enforcement.
const MAX_INSTANCES: u32 = 1;

/// Errors arising during low-level named pipe operations.
#[derive(Debug)]
pub enum PipeError {
    Create(u32),
    Connect(u32),
    Read(u32),
    Write(u32),
    Security(u32),
    LineTooLong,
}

impl fmt::Display for PipeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Create(code) => write!(f, "could not create the pipe (Win32 {code})"),
            Self::Connect(code) => write!(f, "could not accept a client (Win32 {code})"),
            Self::Read(code) => write!(f, "could not read from the pipe (Win32 {code})"),
            Self::Write(code) => write!(f, "could not write to the pipe (Win32 {code})"),
            Self::Security(code) => write!(f, "could not read the pipe's DACL (Win32 {code})"),
            Self::LineTooLong => write!(f, "a line exceeded {MAX_LINE} bytes without a newline"),
        }
    }
}

impl std::error::Error for PipeError {}

fn to_wide_null(val: &str) -> Vec<u16> {
    std::ffi::OsStr::new(val)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

/// Converts a base identifier into standard Windows named pipe path format `\\.\pipe\<name>`.
pub fn pipe_path(name: &str) -> String {
    format!(r"\\.\pipe\{name}")
}

/// Safe reference-counted wrapper around Windows OS HANDLE.
pub struct PipeHandle {
    handle: HANDLE,
}

impl PipeHandle {
    fn raw(&self) -> HANDLE {
        self.handle
    }

    /// Cancels any synchronous pending blocking IO on this handle.
    pub fn cancel_io(&self) {
        unsafe { CancelIoEx(self.handle, ptr::null()) };
    }
}

impl Drop for PipeHandle {
    fn drop(&mut self) {
        if self.handle != INVALID_HANDLE_VALUE && !self.handle.is_null() {
            unsafe { CloseHandle(self.handle) };
        }
    }
}

unsafe impl Send for PipeHandle {}
unsafe impl Sync for PipeHandle {}

/// Server side of the named pipe connection.
pub struct ControlPipe {
    handle: Arc<PipeHandle>,
    pending: Vec<u8>,
}

impl ControlPipe {
    /// Creates a server named pipe instance configured with owner-only DACL security.
    pub fn create(name: &str) -> Result<Self, PipeError> {
        let sec_attr = SecurityAttributes::owner_only()
            .map_err(|_| PipeError::Security(unsafe { GetLastError() }))?;
        let full_path = to_wide_null(&pipe_path(name));

        let handle = unsafe {
            CreateNamedPipeW(
                full_path.as_ptr(),
                PIPE_ACCESS_DUPLEX,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                MAX_INSTANCES,
                MAX_LINE as u32,
                MAX_LINE as u32,
                0,
                sec_attr.as_ptr(),
            )
        };

        if handle == INVALID_HANDLE_VALUE {
            return Err(PipeError::Create(unsafe { GetLastError() }));
        }

        Ok(Self {
            handle: Arc::new(PipeHandle { handle }),
            pending: Vec::new(),
        })
    }

    /// Awaits incoming client connection.
    pub fn wait_for_client(&self) -> Result<(), PipeError> {
        const ERROR_PIPE_CONNECTED: u32 = 535;
        if unsafe { ConnectNamedPipe(self.handle.raw(), ptr::null_mut()) } != 0 {
            return Ok(());
        }
        match unsafe { GetLastError() } {
            ERROR_PIPE_CONNECTED => Ok(()),
            code => Err(PipeError::Connect(code)),
        }
    }

    /// Reads the next newline-terminated string payload from the pipe buffer.
    pub fn read_line(&mut self) -> Result<Option<String>, PipeError> {
        loop {
            if let Some(pos) = self.pending.iter().position(|b| *b == b'\n') {
                let mut segment: Vec<u8> = self.pending.drain(..=pos).collect();
                segment.pop();
                if segment.last() == Some(&b'\r') {
                    segment.pop();
                }
                return Ok(Some(String::from_utf8_lossy(&segment).into_owned()));
            }

            if self.pending.len() >= MAX_LINE {
                return Err(PipeError::LineTooLong);
            }

            let mut buf = [0u8; 4096];
            let mut read_bytes = 0u32;
            let ok = unsafe {
                ReadFile(
                    self.handle.raw(),
                    buf.as_mut_ptr(),
                    buf.len() as u32,
                    &mut read_bytes,
                    ptr::null_mut(),
                )
            };

            if ok == 0 {
                const ERROR_BROKEN_PIPE: u32 = 109;
                return match unsafe { GetLastError() } {
                    ERROR_BROKEN_PIPE => Ok(None),
                    code => Err(PipeError::Read(code)),
                };
            }
            if read_bytes == 0 {
                return Ok(None);
            }
            self.pending.extend_from_slice(&buf[..read_bytes as usize]);
        }
    }

    /// Disconnects the active client connection and purges unread buffer data.
    pub fn disconnect(&mut self) {
        self.pending.clear();
        unsafe { DisconnectNamedPipe(self.handle.raw()) };
    }

    /// Reads back the applied kernel security descriptor in SDDL format.
    #[allow(dead_code)]
    pub fn dacl_sddl(&self) -> Result<String, PipeError> {
        let mut desc_ptr: *mut c_void = ptr::null_mut();
        let status = unsafe {
            GetSecurityInfo(
                self.handle.raw(),
                SE_KERNEL_OBJECT,
                DACL_SECURITY_INFORMATION,
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                &mut desc_ptr,
            )
        };
        if status != ERROR_SUCCESS {
            return Err(PipeError::Security(status));
        }

        let mut out_str: *mut u16 = ptr::null_mut();
        let ok = unsafe {
            ConvertSecurityDescriptorToStringSecurityDescriptorW(
                desc_ptr,
                SDDL_REVISION_1,
                DACL_SECURITY_INFORMATION,
                &mut out_str,
                ptr::null_mut(),
            )
        };
        if ok == 0 {
            let code = unsafe { GetLastError() };
            unsafe { LocalFree(desc_ptr) };
            return Err(PipeError::Security(code));
        }

        let mut length = 0usize;
        while unsafe { *out_str.add(length) } != 0 {
            length += 1;
        }
        let sddl = String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(out_str, length) });
        unsafe {
            LocalFree(out_str as *mut c_void);
            LocalFree(desc_ptr);
        }
        Ok(sddl)
    }

    /// Obtains an Arc reference to the underlying pipe handle.
    pub fn shared_handle(&self) -> Arc<PipeHandle> {
        Arc::clone(&self.handle)
    }
}

/// Client connector endpoint for automated testing or paired clients.
pub struct ControlClient {
    handle: HANDLE,
}

const BUSY_PATIENCE_MS: u32 = 2_000;
pub const ERROR_PIPE_BUSY: u32 = 231;

impl ControlClient {
    /// Connects to a named pipe, waiting briefly if an instance is in teardown transition.
    pub fn connect(name: &str) -> Result<Self, PipeError> {
        match Self::connect_now(name) {
            Err(PipeError::Connect(ERROR_PIPE_BUSY)) => {}
            res => return res,
        }

        let wide_path = to_wide_null(&pipe_path(name));
        unsafe { WaitNamedPipeW(wide_path.as_ptr(), BUSY_PATIENCE_MS) };
        Self::connect_now(name)
    }

    /// Connects to the named pipe immediately without blocking retries.
    pub fn connect_now(name: &str) -> Result<Self, PipeError> {
        let wide_path = to_wide_null(&pipe_path(name));
        let handle = unsafe {
            CreateFileW(
                wide_path.as_ptr(),
                GENERIC_READ | GENERIC_WRITE,
                FILE_SHARE_NONE,
                ptr::null(),
                OPEN_EXISTING,
                0,
                ptr::null_mut(),
            )
        };

        if handle == INVALID_HANDLE_VALUE {
            return Err(PipeError::Connect(unsafe { GetLastError() }));
        }
        Ok(Self { handle })
    }

    #[allow(dead_code)]
    pub fn write_line(&self, line: &str) -> Result<(), PipeError> {
        let formatted = format!("{line}\n");
        let bytes = formatted.as_bytes();
        let mut written = 0u32;
        let ok = unsafe {
            WriteFile(
                self.handle,
                bytes.as_ptr(),
                bytes.len() as u32,
                &mut written,
                ptr::null_mut(),
            )
        };
        if ok == 0 {
            return Err(PipeError::Write(unsafe { GetLastError() }));
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub fn read_line(&self) -> Result<Option<String>, PipeError> {
        let mut buffer = [0u8; 4096];
        let mut count = 0u32;
        let ok = unsafe {
            ReadFile(
                self.handle,
                buffer.as_mut_ptr(),
                buffer.len() as u32,
                &mut count,
                ptr::null_mut(),
            )
        };
        if ok == 0 || count == 0 {
            return Ok(None);
        }
        Ok(Some(
            String::from_utf8_lossy(&buffer[..count as usize])
                .trim_end()
                .to_owned(),
        ))
    }

    #[allow(dead_code)]
    pub fn write_raw(&self, bytes: &[u8]) -> Result<(), PipeError> {
        let mut count = 0u32;
        let ok = unsafe {
            WriteFile(
                self.handle,
                bytes.as_ptr(),
                bytes.len() as u32,
                &mut count,
                ptr::null_mut(),
            )
        };
        if ok == 0 {
            return Err(PipeError::Write(unsafe { GetLastError() }));
        }
        Ok(())
    }
}

unsafe impl Send for ControlClient {}

impl Drop for ControlClient {
    fn drop(&mut self) {
        if self.handle != INVALID_HANDLE_VALUE && !self.handle.is_null() {
            unsafe { CloseHandle(self.handle) };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    fn unique_name() -> String {
        static NEXT: AtomicU32 = AtomicU32::new(0);
        format!(
            "hoomaan-test-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        )
    }

    fn connected() -> (ControlPipe, ControlClient) {
        let name = unique_name();
        let pipe = ControlPipe::create(&name).expect("pipe created");

        let joining = std::thread::spawn(move || ControlClient::connect(&name));
        pipe.wait_for_client().expect("client accepted");
        let client = joining.join().expect("client thread").expect("connected");

        (pipe, client)
    }

    #[test]
    fn the_pipe_carries_the_acl_we_asked_for() {
        let pipe = ControlPipe::create(&unique_name()).expect("pipe created");
        let carried = pipe.dacl_sddl().expect("dacl readable");

        let us = crate::control_acl::as_windows_spells_it(
            &crate::control_acl::current_user_sid().expect("sid"),
        )
        .expect("spelling");

        assert!(carried.starts_with("D:P"), "not protected: {carried}");
        assert_eq!(
            carried.matches('(').count(),
            2,
            "unexpected ACEs: {carried}"
        );
        assert!(
            carried.contains("(D;;FA;;;NU)"),
            "network allowed: {carried}"
        );
        assert!(
            carried.contains(&format!("(A;;FA;;;{us})")),
            "wrong grantee: {carried}"
        );
    }

    #[test]
    fn the_owner_can_still_open_it() {
        let (_pipe, _client) = connected();
    }

    #[test]
    fn a_pipe_nobody_created_cannot_be_opened() {
        assert!(ControlClient::connect("hoomaan-no-listener-here").is_err());
    }

    #[test]
    fn a_second_client_is_refused_while_the_first_holds_the_pipe() {
        let name = unique_name();
        let pipe = ControlPipe::create(&name).expect("pipe created");
        let joining = {
            let name = name.clone();
            std::thread::spawn(move || ControlClient::connect(&name))
        };
        pipe.wait_for_client().expect("client accepted");
        let _first = joining.join().expect("thread").expect("connected");

        assert!(
            matches!(
                ControlClient::connect_now(&name),
                Err(PipeError::Connect(231))
            ),
            "a second client got in while the first held the only instance"
        );
    }

    #[test]
    fn a_line_arrives_whole() {
        let (mut pipe, client) = connected();
        client
            .write_line(r#"{"action":"reset_view"}"#)
            .expect("written");
        let line = pipe.read_line().expect("read").expect("a line");
        assert_eq!(line, r#"{"action":"reset_view"}"#);
    }

    #[test]
    fn a_line_split_across_writes_is_reassembled() {
        let (mut pipe, client) = connected();
        client.write_raw(br#"{"action":"res"#).expect("part one");
        client.write_raw(b"et_view\"}\n").expect("part two");
        let line = pipe.read_line().expect("read").expect("a line");
        assert_eq!(line, r#"{"action":"reset_view"}"#);
    }

    #[test]
    fn two_lines_in_one_write_stay_two_lines() {
        let (mut pipe, client) = connected();
        client.write_raw(b"first\nsecond\n").expect("written");
        assert_eq!(pipe.read_line().expect("read").as_deref(), Some("first"));
        assert_eq!(pipe.read_line().expect("read").as_deref(), Some("second"));
    }

    #[test]
    fn a_carriage_return_is_not_part_of_the_line() {
        let (mut pipe, client) = connected();
        client.write_raw(b"{}\r\n").expect("written");
        assert_eq!(pipe.read_line().expect("read").as_deref(), Some("{}"));
    }

    #[test]
    fn a_client_that_hangs_up_reads_as_the_end() {
        let (mut pipe, client) = connected();
        drop(client);
        assert!(pipe.read_line().expect("read").is_none());
    }

    #[test]
    fn a_client_that_never_sends_a_newline_is_refused() {
        let (mut pipe, client) = connected();
        std::thread::spawn(move || {
            let filler = vec![b'x'; 8192];
            while client.write_raw(&filler).is_ok() {}
        });
        assert!(matches!(pipe.read_line(), Err(PipeError::LineTooLong)));
    }

    #[test]
    fn a_disconnect_drops_what_the_last_client_left_behind() {
        let (mut pipe, client) = connected();
        client.write_raw(b"half a comm").expect("written");
        drop(client);
        let _ = pipe.read_line();
        pipe.disconnect();
        assert!(pipe.pending.is_empty());
    }
}
