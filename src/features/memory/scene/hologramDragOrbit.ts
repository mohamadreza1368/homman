/**
 * HOOMAAN Hologram - Interactive Pointer Orbit Drag Controller
 */

export interface DragOrbitController {
  getAzimuth(): number;
  setAzimuth(val: number): void;
  isDragging(): boolean;
  dispose(): void;
}

export function attachDragOrbit(
  container: HTMLElement,
  initialAzimuth = 0,
): DragOrbitController {
  let azimuth = initialAzimuth;
  let dragAnchor: { x: number; startAzimuth: number } | null = null;

  container.style.cursor = "grab";

  function onPointerDown(e: PointerEvent): void {
    if ((e.target as Element | null)?.closest?.("button")) return;
    e.preventDefault();
    dragAnchor = { x: e.clientX, startAzimuth: azimuth };
    container.setPointerCapture(e.pointerId);
    container.style.cursor = "grabbing";
  }

  function onPointerMove(e: PointerEvent): void {
    if (dragAnchor) {
      azimuth = dragAnchor.startAzimuth + (e.clientX - dragAnchor.x) * 0.008;
    }
  }

  function onPointerUp(): void {
    dragAnchor = null;
    container.style.cursor = "grab";
  }

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerUp);

  return {
    getAzimuth: () => azimuth,
    setAzimuth: (val: number) => {
      azimuth = val;
    },
    isDragging: () => dragAnchor !== null,
    dispose: () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
    },
  };
}
