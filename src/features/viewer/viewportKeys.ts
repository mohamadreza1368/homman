const TYPING_TAG_NAMES = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isTypingTarget(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) {
    return false;
  }
  return Boolean(node.isContentEditable) || TYPING_TAG_NAMES.has(node.tagName.toUpperCase());
}

export function viewportKey(evt: KeyboardEvent): string | null {
  const isModifierActive = evt.metaKey || evt.ctrlKey || evt.altKey;
  if (isModifierActive || isTypingTarget(evt.target)) {
    return null;
  }
  return evt.key.toLowerCase();
}
