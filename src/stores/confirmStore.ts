import { create } from "zustand";

/**
 * Confirmation dialog state management for irrevocable actions in HOOMAAN.
 *
 * Uses a promise-driven pattern (`if (await askToConfirm(...)) ...`) to keep
 * calling code linear and prevent callback fragmentation.
 */
export interface ConfirmRequest {
  title: string;
  body: string;
  subject?: string;
  confirmLabel: string;
}

interface PendingConfirmation extends ConfirmRequest {
  settle: (confirmed: boolean) => void;
}

interface ConfirmState {
  pending: PendingConfirmation | null;
  answer: (confirmed: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  pending: null,
  answer: (confirmed: boolean) => {
    const current = get().pending;
    if (!current) return;
    set({ pending: null });
    current.settle(confirmed);
  },
}));

/**
 * Dispatches an interactive confirmation prompt.
 * Resolves to `true` if accepted by user, `false` if dismissed.
 * If a previous request is still pending, it is safely rejected before opening the new one.
 */
export function askToConfirm(request: ConfirmRequest): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const active = useConfirmStore.getState().pending;
    if (active) {
      active.settle(false);
    }
    useConfirmStore.setState({
      pending: { ...request, settle: resolve },
    });
  });
}
