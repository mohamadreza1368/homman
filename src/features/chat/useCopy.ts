import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reusable React hook for copying plain text to the system clipboard,
 * with temporary visual confirmation state that automatically resets.
 */
export function useCopy(resetAfterMs = 1600) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = useCallback(
    async (content: string): Promise<boolean> => {
      let successful = false;

      // Primary modern async clipboard API
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(content);
          successful = true;
        } catch {
          successful = false;
        }
      }

      // Legacy fallback for webviews without clipboard permissions
      if (!successful && typeof document !== "undefined") {
        try {
          const offscreenInput = document.createElement("textarea");
          offscreenInput.value = content;
          offscreenInput.style.position = "fixed";
          offscreenInput.style.top = "-9999px";
          offscreenInput.setAttribute("readonly", "");
          document.body.appendChild(offscreenInput);
          offscreenInput.select();
          successful = document.execCommand("copy");
          document.body.removeChild(offscreenInput);
        } catch {
          successful = false;
        }
      }

      if (successful) {
        setCopied(true);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setCopied(false);
        }, resetAfterMs);
      }

      return successful;
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
