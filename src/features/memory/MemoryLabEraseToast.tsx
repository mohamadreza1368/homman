/**
 * HOOMAAN Memory Lab - Erase & Restore Undo Toast
 * Displays an ephemeral countdown notification with single-click restoration.
 */

interface MemoryLabEraseToastProps {
  pendingItem: { key: string; left: number } | null;
  onRestore: (key: string) => void;
}

export function MemoryLabEraseToast({ pendingItem, onRestore }: MemoryLabEraseToastProps) {
  if (!pendingItem) return null;

  return (
    <div className="ml-toast" role="status">
      <span>MEMORY ERASED</span>
      <button type="button" onClick={() => onRestore(pendingItem.key)}>
        RESTORE ({pendingItem.left})
      </button>
    </div>
  );
}
