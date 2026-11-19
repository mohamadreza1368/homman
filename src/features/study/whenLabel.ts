const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Produces relative or absolute temporal descriptions for journal entries.
 * Recent records display human-friendly intervals ("today", "yesterday", "N days ago"),
 * while older items format to short localized dates.
 */
export function whenLabel(timestampMs: number, referenceTime = Date.now()): string {
  const elapsedDays = Math.floor((referenceTime - timestampMs) / MILLISECONDS_PER_DAY);

  if (elapsedDays <= 0) return "today";
  if (elapsedDays === 1) return "yesterday";
  if (elapsedDays < 7) return `${elapsedDays} days ago`;

  return new Date(timestampMs).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
