/**
 * Protocol specification and Zod validation schemas for the HOOMAAN 3D IPC pipeline:
 * React Desktop Interface <-> Tauri Rust Core <-> Python Analysis Sidecar.
 *
 * Wire fields follow snake_case consistently across TypeScript, Rust serde, and Python Pydantic.
 */

export * from "./schemas/primitives";
export * from "./schemas/sceneCommands";
export * from "./schemas/simulation";
export * from "./schemas/engineEvents";
export * from "./schemas/manifest";
