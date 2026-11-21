//! Authentication and secure credential storage commands.

use tauri::command;
use crate::keyring_store::{self, KeyringError, Provider};

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error(transparent)]
    Store(#[from] KeyringError),
}

impl serde::Serialize for AuthError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type AuthResult<T> = Result<T, AuthError>;

#[command]
pub fn save_api_key(provider: Provider, api_key: String) -> AuthResult<()> {
    keyring_store::store(provider, &api_key)?;
    Ok(())
}

#[command]
pub fn has_api_key(provider: Provider) -> bool {
    keyring_store::exists(provider)
}

#[command]
pub fn delete_api_key(provider: Provider) -> AuthResult<()> {
    keyring_store::delete(provider)?;
    Ok(())
}
