import { useSceneStore } from "./sceneStore";
import { writeStoredView } from "./viewPreferences";

/**
 * Synchronizes active 3D viewport state with persistent local preferences in HOOMAAN.
 * Debounces store subscriptions to avoid synchronous main-thread write thrashing during user interactions.
 */
const DEBOUNCE_SETTLE_MS = 400;

export function startViewPersistence(): () => void {
  let debounceHandle: ReturnType<typeof setTimeout> | undefined;

  const unsubscribe = useSceneStore.subscribe((state, prev) => {
    // Only persist after anatomical manifest has finished initialization
    if (!state.manifest) return;

    const hasViewChanged =
      state.hiddenSystems !== prev.hiddenSystems ||
      state.systemOpacity !== prev.systemOpacity ||
      state.eyeTracking !== prev.eyeTracking ||
      state.labelsVisible !== prev.labelsVisible ||
      state.background !== prev.background ||
      state.depthProbeVisible !== prev.depthProbeVisible ||
      state.hideConnective !== prev.hideConnective;

    if (!hasViewChanged) return;

    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(() => {
      const current = useSceneStore.getState();
      writeStoredView({
        hiddenSystems: current.hiddenSystems,
        systemOpacity: current.systemOpacity,
        eyeTracking: current.eyeTracking,
        labelsVisible: current.labelsVisible,
        background: current.background,
        depthProbeVisible: current.depthProbeVisible,
        hideConnective: current.hideConnective,
      });
    }, DEBOUNCE_SETTLE_MS);
  });

  return () => {
    clearTimeout(debounceHandle);
    unsubscribe();
  };
}
