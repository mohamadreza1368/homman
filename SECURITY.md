# Security Policy

## Overview
HOOMAAN is designed with security and privacy as first-class architectural priorities. The application operates primarily as a local-first desktop software, maintaining anatomical datasets and study records on the user's local machine.

## Vulnerability Reporting
If you identify any security vulnerability, confidential data leak risk, or potential attack vector in HOOMAAN:

- **Do NOT file a public issue.**
- Submit a confidential report via GitHub Security Advisories or email **info@hoomaan.app**.
- Include detailed reproduction steps, impacted components, operating system, and proof of concept if available.

### Review and Disclosure Timeline
- **Initial Acknowledgment:** Within 48 hours.
- **Triage and Impact Assessment:** Within 7 business days.
- **Resolution and Patch:** Coordinated with release schedule and published alongside release advisories.

## Security Boundaries & Model
- **Local Credentials:** External API keys are stored in encrypted OS credential stores (Windows Credential Manager / macOS Keychain / Linux Secret Service) and are never logged or exposed in plaintext.
- **Direct Custom API:** AI communications happen strictly over TLS to user-configured endpoints; no telemetric tracking or unprompted telemetry is dispatched.
- **IPC Isolation:** Webview commands are restricted to declared Tauri IPC interfaces with bounded parameter validation.
