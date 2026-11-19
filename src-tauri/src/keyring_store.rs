//! Secure credential store interface for managing third-party AI provider API keys.
//!
//! Enforces unidirectional security: the user interface can write or purge API keys,
//! or verify their presence, but secret keys are never echoed back to the web view.

use serde::{Deserialize, Serialize};

/// System keyring service name identifying HOOMAAN credentials.
const KEYRING_SERVICE: &str = "HOOMAAN";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Anthropic,
    Openai,
    Google,
}

impl Provider {
    /// Maps provider variant to credential store account identifier.
    fn account_id(self) -> &'static str {
        match self {
            Provider::Anthropic => "anthropic",
            Provider::Openai => "openai",
            Provider::Google => "google",
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum KeyringError {
    #[error("no API key stored for this provider")]
    NotFound,
    #[error("credential store unavailable: {0}")]
    Backend(String),
    #[error("API key must not be empty")]
    Empty,
}

impl serde::Serialize for KeyringError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

fn create_entry(provider: Provider) -> Result<keyring::Entry, KeyringError> {
    keyring::Entry::new(KEYRING_SERVICE, provider.account_id())
        .map_err(|err| KeyringError::Backend(err.to_string()))
}

/// Saves an API key for the specified provider into the platform credential vault.
pub fn store(provider: Provider, api_key: &str) -> Result<(), KeyringError> {
    let clean_key = api_key.trim();
    if clean_key.is_empty() {
        return Err(KeyringError::Empty);
    }
    create_entry(provider)?
        .set_password(clean_key)
        .map_err(|err| KeyringError::Backend(err.to_string()))
}

/// Reads the provider key from the keyring for internal sidecar consumption only.
pub(crate) fn read(provider: Provider) -> Result<String, KeyringError> {
    match create_entry(provider)?.get_password() {
        Ok(token) => Ok(token),
        Err(keyring::Error::NoEntry) => Err(KeyringError::NotFound),
        Err(err) => Err(KeyringError::Backend(err.to_string())),
    }
}

/// Checks whether an API key has been recorded for the specified provider.
pub fn exists(provider: Provider) -> bool {
    read(provider).is_ok()
}

/// Deletes any stored API key for the provider. If absent, succeeds idempotently.
pub fn delete(provider: Provider) -> Result<(), KeyringError> {
    match create_entry(provider)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(KeyringError::Backend(err.to_string())),
    }
}
