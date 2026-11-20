/**
 * Hoomaan 3D Viewport Interaction & Selection Engine
 *
 * Implements organ selection logic, multi-selection toggles, isolation lifecycle,
 * and cyclic layer transparency transitions.
 * Derived purely from specs/scene-interaction-selection.md.
 */

export const TRANSPARENCY_STOPS = [1.0, 0.28, 0.12] as const;

/**
 * Resolves the new selection set when an organ is picked or background clicked.
 */
export function resolveOrganSelection(
  currentSelected: ReadonlySet<string>,
  targetId: string | null,
  isAdditive: boolean,
): Set<string> {
  // Clicking empty viewport background clears selection
  if (targetId === null) {
    return new Set<string>();
  }

  // Non-additive (single click) replaces selection with the target
  if (!isAdditive) {
    return new Set<string>([targetId]);
  }

  // Additive mode (Shift+click): toggles membership of target
  const nextSet = new Set<string>(currentSelected);
  if (nextSet.has(targetId)) {
    nextSet.delete(targetId);
  } else {
    nextSet.add(targetId);
  }

  return nextSet;
}

/**
 * Enters isolation state for the provided selection.
 * If selection is empty, isolation is not activated.
 */
export function enterIsolationMode(
  selectedIds: ReadonlySet<string>,
): Set<string> | null {
  if (selectedIds.size === 0) {
    return null;
  }
  return new Set<string>(selectedIds);
}

/**
 * Drops an organ from active isolation. If the isolated set becomes empty,
 * isolation automatically deactivates (returns null) so the whole body is restored.
 */
export function removeOrganFromIsolation(
  currentIsolated: ReadonlySet<string> | null,
  targetId: string,
): Set<string> | null {
  if (currentIsolated === null) {
    return null;
  }

  const nextIsolated = new Set<string>(currentIsolated);
  nextIsolated.delete(targetId);

  return nextIsolated.size === 0 ? null : nextIsolated;
}

/**
 * Convenience helper wrappers matching standard functional idioms.
 */
export function applySingleSelection(organId: string | null): Set<string> {
  return resolveOrganSelection(new Set(), organId, false);
}

export function applyAdditiveSelection(
  current: ReadonlySet<string>,
  organId: string
): Set<string> {
  return resolveOrganSelection(current, organId, true);
}

export function enterIsolation(organIds: readonly string[]): Set<string> {
  return new Set(organIds);
}

export function leaveIsolation(): null {
  return null;
}
export function getNextTransparencyStep(current: number): number {
  const matchingIndex = TRANSPARENCY_STOPS.findIndex(
    (stop) => Math.abs(stop - current) < 0.02,
  );

  if (matchingIndex === -1) {
    return TRANSPARENCY_STOPS[1] ?? 0.28; // default to first ghost stop
  }

  const nextIndex = (matchingIndex + 1) % TRANSPARENCY_STOPS.length;
  return TRANSPARENCY_STOPS[nextIndex] ?? 1.0;
}
