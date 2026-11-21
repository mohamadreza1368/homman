/**
 * HOOMAAN Memory Lab - Top Navigation Toolbar
 * Contains lab identity, hardware status indicators, audio toggle, and close controls.
 */

import { BrandLogo } from "@/components/BrandLogo";
import type { LabPhase } from "./scene/memoryScene";

interface MemoryLabToolbarProps {
  phase: LabPhase;
  audioActive: boolean;
  onToggleAudio: () => void;
  onDismiss: () => void;
}

export function MemoryLabToolbar({
  phase,
  audioActive,
  onToggleAudio,
  onDismiss,
}: MemoryLabToolbarProps) {
  return (
    <header className="ml-header" role="banner">
      <div className="ml-header-brand">
        <BrandLogo variant="mono-white" className="h-6 w-auto" decorative />
        <h1 className="ml-header-title">آزمایشگاه حافظه کالبدی</h1>
        <span className="ml-badge-status" data-phase={phase}>
          {phase === "boot" && "در حال بارگذاری..."}
          {phase === "live" && "همگام"}
        </span>
      </div>

      <div className="ml-header-actions">
        <button
          type="button"
          className="ml-btn-icon"
          onClick={onToggleAudio}
          title={audioActive ? "خاموش کردن صدا" : "روشن کردن جلوه‌های صوتی"}
          aria-label={audioActive ? "Mute audio" : "Enable audio"}
        >
          {audioActive ? "🔊" : "🔇"}
        </button>

        <button
          type="button"
          className="ml-btn-close"
          onClick={onDismiss}
          title="خروج از آزمایشگاه حافظه (Esc)"
          aria-label="Close Memory Lab"
        >
          ✕
        </button>
      </div>
    </header>
  );
}
