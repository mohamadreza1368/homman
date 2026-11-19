import { useCallback, useEffect, useRef, useState } from "react";
import { readLocal, writeLocal } from "@/lib/localStore";

const PERSISTENCE_STORAGE_KEY = "hoomaan.layout.v1";

export const TREE_LIMITS = { min: 200, max: 560, default: 280 } as const;
export const CHAT_LIMITS = { min: 300, max: 720, default: 380 } as const;

export interface LayoutState {
  treeWidth: number;
  chatWidth: number;
  treeCollapsed: boolean;
  chatCollapsed: boolean;
}

const DEFAULT_WORKSPACE_LAYOUT: LayoutState = {
  treeWidth: TREE_LIMITS.default,
  chatWidth: CHAT_LIMITS.default,
  treeCollapsed: false,
  chatCollapsed: false,
};

/** Clamps a numeric dimension strictly within provided min and max thresholds. */
export const clamp = (val: number, minimum: number, maximum: number) =>
  Math.min(Math.max(val, minimum), maximum);

export type WidthUpdate = number | ((current: number) => number);

const evaluateWidthUpdate = (update: WidthUpdate, current: number) =>
  typeof update === "function" ? update(current) : update;

function retrieveSavedLayout(): LayoutState {
  try {
    const rawData = readLocal(PERSISTENCE_STORAGE_KEY);
    if (!rawData) return DEFAULT_WORKSPACE_LAYOUT;

    const parsedJson = JSON.parse(rawData) as Partial<LayoutState>;
    return {
      treeWidth: clamp(
        Number(parsedJson.treeWidth) || DEFAULT_WORKSPACE_LAYOUT.treeWidth,
        TREE_LIMITS.min,
        TREE_LIMITS.max,
      ),
      chatWidth: clamp(
        Number(parsedJson.chatWidth) || DEFAULT_WORKSPACE_LAYOUT.chatWidth,
        CHAT_LIMITS.min,
        CHAT_LIMITS.max,
      ),
      treeCollapsed: Boolean(parsedJson.treeCollapsed),
      chatCollapsed: Boolean(parsedJson.chatCollapsed),
    };
  } catch {
    return DEFAULT_WORKSPACE_LAYOUT;
  }
}

/**
 * Custom hook tracking pane width dimensions, collapse state, and debounced localStorage synchronization.
 */
export function useLayout() {
  const [layoutState, setLayoutState] = useState<LayoutState>(retrieveSavedLayout);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      try {
        writeLocal(PERSISTENCE_STORAGE_KEY, JSON.stringify(layoutState));
      } catch {
        // Suppress storage quota or security access exceptions
      }
    }, 250);

    return () => clearTimeout(debounceTimerRef.current);
  }, [layoutState]);

  const updateTreeWidth = useCallback((newWidth: WidthUpdate) => {
    setLayoutState((prev) => ({
      ...prev,
      treeWidth: clamp(
        evaluateWidthUpdate(newWidth, prev.treeWidth),
        TREE_LIMITS.min,
        TREE_LIMITS.max,
      ),
    }));
  }, []);

  const updateChatWidth = useCallback((newWidth: WidthUpdate) => {
    setLayoutState((prev) => ({
      ...prev,
      chatWidth: clamp(
        evaluateWidthUpdate(newWidth, prev.chatWidth),
        CHAT_LIMITS.min,
        CHAT_LIMITS.max,
      ),
    }));
  }, []);

  const toggleTreePane = useCallback(
    () => setLayoutState((prev) => ({ ...prev, treeCollapsed: !prev.treeCollapsed })),
    [],
  );

  const toggleChatPane = useCallback(
    () => setLayoutState((prev) => ({ ...prev, chatCollapsed: !prev.chatCollapsed })),
    [],
  );

  const resetLayout = useCallback(() => setLayoutState(DEFAULT_WORKSPACE_LAYOUT), []);

  return {
    layout: layoutState,
    setTreeWidth: updateTreeWidth,
    setChatWidth: updateChatWidth,
    toggleTree: toggleTreePane,
    toggleChat: toggleChatPane,
    reset: resetLayout,
  };
}
