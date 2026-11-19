import { useCallback, useEffect, useRef, useState } from "react";

/** Default idle inactivity window before activating resting screen (15 minutes). */
export const IDLE_MS = 15 * 60 * 1000;

/** Monitored window interaction events signaling human activity. */
const OBSERVED_ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "pointermove",
  "pointerdown",
  "keydown",
  "wheel",
  "focus",
];

/** Checks if keyboard interaction is focused inside an active text editing element. */
function isInputElement(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (node.isContentEditable) return true;
  const tagName = node.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

/** Validates Ctrl+X or Cmd+X shortcut chord for manually toggling resting display. */
function isRestingToggleChord(event: Event): boolean {
  if (!(event instanceof KeyboardEvent)) return false;
  if (!event.ctrlKey && !event.metaKey) return false;
  if (event.key.toLowerCase() !== "x") return false;
  return !isInputElement(event.target);
}

/**
 * Scans DOM input controls to verify whether unsubmitted draft text is present.
 */
export function hasUnsentText(): boolean {
  const inputElements = document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
    "textarea, input[type='text']",
  );
  for (const element of inputElements) {
    if (element.value.trim() !== "") return true;
  }
  return false;
}

export interface IdleOptions {
  armed: boolean;
  idleMs?: number;
}

/**
 * Hook governing resting screensaver trigger conditions, activity timeouts, and keyboard shortcut toggles.
 */
export function useIdleScreen({ armed, idleMs = IDLE_MS }: IdleOptions): {
  showing: boolean;
  dismiss: () => void;
} {
  const [isShowing, setIsShowing] = useState(false);
  const lastInteractionTime = useRef(Date.now());

  const dismissScreen = useCallback(() => setIsShowing(false), []);

  const armedStateRef = useRef(armed);
  armedStateRef.current = armed;

  useEffect(() => {
    function registerActivity(event: Event) {
      lastInteractionTime.current = Date.now();
      if (isRestingToggleChord(event)) return;
      setIsShowing(false);
    }

    for (const evtName of OBSERVED_ACTIVITY_EVENTS) {
      window.addEventListener(evtName, registerActivity, { passive: true });
    }
    return () => {
      for (const evtName of OBSERVED_ACTIVITY_EVENTS) {
        window.removeEventListener(evtName, registerActivity);
      }
    };
  }, []);

  useEffect(() => {
    const intervalTimer = setInterval(() => {
      if (document.hidden) {
        lastInteractionTime.current = Date.now();
        return;
      }
      if (!armedStateRef.current || hasUnsentText()) {
        lastInteractionTime.current = Date.now();
        return;
      }
      if (Date.now() - lastInteractionTime.current >= idleMs) {
        setIsShowing(true);
      }
    }, 1_000);

    return () => clearInterval(intervalTimer);
  }, [idleMs]);

  useEffect(() => {
    function handleToggleKey(event: KeyboardEvent) {
      if (!isRestingToggleChord(event)) return;
      event.preventDefault();
      setIsShowing((active) => !active);
      lastInteractionTime.current = Date.now();
    }

    window.addEventListener("keydown", handleToggleKey);
    return () => window.removeEventListener("keydown", handleToggleKey);
  }, []);

  return { showing: isShowing, dismiss: dismissScreen };
}
