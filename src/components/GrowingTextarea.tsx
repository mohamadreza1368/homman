import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";

/** Maximum vertical growth viewport ceiling for expanding textarea instances. */
export const GROW_LIMIT = "38vh";

export interface GrowingTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "style"> {
  value: string;
  limit?: string;
}

/**
 * Auto-expanding textarea component that scales smoothly with text content
 * up to a bounded maximum ceiling (`limit`), preventing layout displacement in flex columns.
 */
export function GrowingTextarea({
  value,
  limit = GROW_LIMIT,
  className = "",
  ...props
}: GrowingTextareaProps) {
  const elementRef = useRef<HTMLTextAreaElement>(null);
  const baselineHeight = useRef<number | null>(null);

  const adjustDimensions = useCallback(() => {
    const el = elementRef.current;
    if (!el) return;

    // Do not resize if hidden (display: none yields 0 measurements)
    if (el.offsetHeight === 0 && el.scrollHeight === 0) {
      return;
    }

    if (baselineHeight.current === null && el.offsetHeight > 0) {
      baselineHeight.current = el.offsetHeight;
    }

    el.style.height = "auto";
    const targetHeight = Math.max(el.scrollHeight, baselineHeight.current ?? 0);
    el.style.height = `${targetHeight}px`;
  }, []);

  useLayoutEffect(() => {
    adjustDimensions();
  }, [value, adjustDimensions]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      adjustDimensions();
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [adjustDimensions]);

  return (
    <textarea
      ref={elementRef}
      value={value}
      style={{ maxHeight: limit }}
      className={`resize-none overflow-y-auto ${className}`}
      {...props}
    />
  );
}
