//! Windows Named Pipe Access Control List (ACL) configuration.
//!
//! Restricts IPC communication strictly to the current user process on the local machine.
//! Explicitly denies Network Logon users (`NU`) to prevent cross-machine named pipe calls.

#![cfg(windows)]

use std::ffi::c_void;
use std::fmt;
use std::os::windows::ffi::OsStrExt;
use std::ptr;

use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, LocalFree, HANDLE};
use windows_sys::Win32::Security::Authorization::{
    ConvertSecurityDescriptorToStringSecurityDescriptorW, ConvertSidToStringSidW,
    ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
};
use windows_sys::Win32::Security::{
    GetTokenInformation, TokenUser, DACL_SECURITY_INFORMATION, SECURITY_ATTRIBUTES, TOKEN_QUERY,
    TOKEN_USER,
};
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

/// Error conditions encountered while reading process identity or building security descriptors.
#[derive(Debug)]
pub enum AclError {
    Token(u32),
    Sid(u32),
    Descriptor(u32),
    #[allow(dead_code)]
    Readback(u32),
}

impl fmt::Display for AclError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Token(code) => write!(f, "could not read this process's token (Win32 {code})"),
            Self::Sid(code) => write!(f, "could not read this user's SID (Win32 {code})"),
            Self::Descriptor(code) => {
                write!(f, "could not build the security descriptor (Win32 {code})")
            }
            Self::Readback(code) => write!(f, "could not read the descriptor back (Win32 {code})"),
        }
    }
}

impl std::error::Error for AclError {}

fn to_wide_null(input: &str) -> Vec<u16> {
    std::ffi::OsStr::new(input)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

unsafe fn consume_win32_wide_string(ptr: *mut u16) -> String {
    let mut count = 0usize;
    while unsafe { *ptr.add(count) } != 0 {
        count += 1;
    }
    let converted = String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(ptr, count) });
    unsafe { LocalFree(ptr as *mut c_void) };
    converted
}

/// Retrieves the Security Identifier (SID) for the current process user as an SDDL string.
pub fn current_user_sid() -> Result<String, AclError> {
    let mut token_handle: HANDLE = ptr::null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token_handle) } == 0 {
        return Err(AclError::Token(unsafe { GetLastError() }));
    }

    let sid_result = extract_token_sid(token_handle);
    unsafe { CloseHandle(token_handle) };
    sid_result
}

fn extract_token_sid(token: HANDLE) -> Result<String, AclError> {
    let mut bytes_required = 0u32;
    unsafe {
        GetTokenInformation(token, TokenUser, ptr::null_mut(), 0, &mut bytes_required);
    }
    if bytes_required == 0 {
        return Err(AclError::Token(unsafe { GetLastError() }));
    }

    let mut storage = vec![0u8; bytes_required as usize];
    if unsafe {
        GetTokenInformation(
            token,
            TokenUser,
            storage.as_mut_ptr() as *mut c_void,
            bytes_required,
            &mut bytes_required,
        )
    } == 0
    {
        return Err(AclError::Token(unsafe { GetLastError() }));
    }

    let sid_ptr = unsafe { (*(storage.as_ptr() as *const TOKEN_USER)).User.Sid };
    let mut text_out: *mut u16 = ptr::null_mut();

    if unsafe { ConvertSidToStringSidW(sid_ptr, &mut text_out) } == 0 {
        return Err(AclError::Sid(unsafe { GetLastError() }));
    }

    Ok(unsafe { consume_win32_wide_string(text_out) })
}

/// Generates an SDDL string restricting access strictly to the current user SID and denying network callers.
pub fn owner_only_sddl() -> Result<String, AclError> {
    let sid = current_user_sid()?;
    Ok(format!("D:P(D;;GA;;;NU)(A;;GA;;;{sid})"))
}

#[allow(dead_code)]
pub fn as_windows_spells_it(sid: &str) -> Result<String, AclError> {
    let test_sec = SecurityAttributes::from_sddl(&format!("D:(A;;GA;;;{sid})"))?;
    let roundtrip = test_sec.to_sddl()?;
    roundtrip
        .rsplit_once(";;;")
        .and_then(|(_, rest)| rest.strip_suffix(')'))
        .map(str::to_owned)
        .ok_or(AclError::Readback(0))
}

/// Managed RAII wrapper for Windows SECURITY_ATTRIBUTES and SECURITY_DESCRIPTOR.
pub struct SecurityAttributes {
    descriptor: *mut c_void,
    attributes: SECURITY_ATTRIBUTES,
}

impl SecurityAttributes {
    /// Builds a SECURITY_ATTRIBUTES struct parsed from an SDDL definition string.
    pub fn from_sddl(sddl: &str) -> Result<Self, AclError> {
        let mut descriptor_ptr: *mut c_void = ptr::null_mut();
        let wide_str = to_wide_null(sddl);

        if unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                wide_str.as_ptr(),
                SDDL_REVISION_1,
                &mut descriptor_ptr,
                ptr::null_mut(),
            )
        } == 0
        {
            return Err(AclError::Descriptor(unsafe { GetLastError() }));
        }

        Ok(Self {
            attributes: SECURITY_ATTRIBUTES {
                nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: descriptor_ptr,
                bInheritHandle: 0,
            },
            descriptor: descriptor_ptr,
        })
    }

    /// Creates an owner-only security attributes configuration.
    pub fn owner_only() -> Result<Self, AclError> {
        Self::from_sddl(&owner_only_sddl()?)
    }

    /// Returns a raw pointer suitable for CreateNamedPipeW.
    pub fn as_ptr(&self) -> *const SECURITY_ATTRIBUTES {
        &self.attributes
    }

    #[allow(dead_code)]
    pub fn to_sddl(&self) -> Result<String, AclError> {
        let mut out_str: *mut u16 = ptr::null_mut();
        if unsafe {
            ConvertSecurityDescriptorToStringSecurityDescriptorW(
                self.descriptor,
                SDDL_REVISION_1,
                DACL_SECURITY_INFORMATION,
                &mut out_str,
                ptr::null_mut(),
            )
        } == 0
        {
            return Err(AclError::Readback(unsafe { GetLastError() }));
        }
        Ok(unsafe { consume_win32_wide_string(out_str) })
    }
}

impl Drop for SecurityAttributes {
    fn drop(&mut self) {
        if !self.descriptor.is_null() {
            unsafe { LocalFree(self.descriptor) };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_current_user_has_a_sid() {
        let sid = current_user_sid().expect("this process has a token");
        assert!(sid.starts_with("S-1-"), "not a SID: {sid}");
    }

    #[test]
    fn the_sddl_grants_one_identity_and_denies_the_network() {
        let sddl = owner_only_sddl().expect("sddl");
        let sid = current_user_sid().expect("sid");

        assert!(sddl.starts_with("D:P"), "DACL is not protected: {sddl}");
        assert!(
            sddl.contains("(D;;GA;;;NU)"),
            "network is not denied: {sddl}"
        );
        assert!(
            sddl.contains(&format!("(A;;GA;;;{sid})")),
            "wrong grantee: {sddl}"
        );
    }

    #[test]
    fn a_well_known_sid_comes_back_under_its_alias() {
        assert_eq!(
            as_windows_spells_it("S-1-5-32-544").expect("administrators"),
            "BA"
        );
        let ours = current_user_sid().expect("sid");
        let spelled = as_windows_spells_it(&ours).expect("ours");
        assert!(spelled == ours || !spelled.starts_with("S-1-"));
    }

    #[test]
    fn windows_agrees_with_what_we_wrote() {
        let attributes = SecurityAttributes::owner_only().expect("descriptor");
        let carried = attributes.to_sddl().expect("readback");
        let us = as_windows_spells_it(&current_user_sid().expect("sid")).expect("spelling");

        assert!(carried.starts_with("D:P"), "not protected: {carried}");
        assert_eq!(
            carried.matches('(').count(),
            2,
            "unexpected ACEs: {carried}"
        );
        assert!(
            carried.contains("(D;;GA;;;NU)"),
            "network allowed: {carried}"
        );
        assert!(
            carried.contains(&format!("(A;;GA;;;{us})")),
            "wrong grantee: {carried}"
        );
    }

    #[test]
    fn the_handle_is_not_inheritable() {
        let attributes = SecurityAttributes::owner_only().expect("descriptor");
        let raw = unsafe { &*attributes.as_ptr() };
        assert_eq!(raw.bInheritHandle, 0);
        assert!(!raw.lpSecurityDescriptor.is_null());
    }

    #[test]
    fn a_malformed_sddl_is_an_error_and_not_a_default_pipe() {
        let refused = SecurityAttributes::from_sddl("this is not an SDDL string");
        assert!(matches!(refused, Err(AclError::Descriptor(_))));
    }
}
