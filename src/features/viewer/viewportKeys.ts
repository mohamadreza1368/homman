/**
 * Hoomaan 3D Viewer - Viewport Keyboard Shortcut Guard
 */

/** Returns true if event target is an active text input or editable element. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * Normalizes keyboard event key for viewport controls, rejecting inputs, modifiers, or shortcuts.
 */
export function viewportKey(event: KeyboardEvent): string | null {
  if (isTypingTarget(event.target)) return null;
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  return event.key.toLowerCase();
}
