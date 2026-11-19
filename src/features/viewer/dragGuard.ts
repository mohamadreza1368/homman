/**
 * Hoomaan 3D Viewer - Pointer Drag vs Click Discriminator
 */

/** Slop threshold in pixels differentiating precise selection click from camera orbit drag. */
export const DRAG_SLOP = 6;

let origin: { x: number; y: number } | null = null;
let travelled = false;

/** Registers pointer down position and resets travelled flag. */
export function beginPress(x: number, y: number): void {
  origin = { x, y };
  travelled = false;
}

/** Updates pointer position and flags gesture as travelled if threshold exceeded. */
export function trackPress(x: number, y: number): void {
  if (origin === null || travelled) return;
  if (Math.hypot(x - origin.x, y - origin.y) > DRAG_SLOP) {
    travelled = true;
  }
}

/** Returns true if active pointer gesture exceeded minimum drag distance. */
export function pressTravelled(): boolean {
  return travelled;
}

/** Resets drag tracker internal state. */
export function resetPress(): void {
  origin = null;
  travelled = false;
}
