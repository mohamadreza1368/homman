/**
 * HOOMAAN Memory Lab - HUD Header Controls
 */

interface MemoryLabHeaderProps {
  memoryCount: number;
  isHelpGuideVisible: boolean;
  onToggleHelpGuide: () => void;
  isFocusReaderActive: boolean;
  onToggleFocusReader: () => void;
  isAudioEnabled: boolean;
  onToggleAudio: () => void;
  onDismiss: () => void;
}

export function MemoryLabHeader({
  memoryCount,
  isHelpGuideVisible,
  onToggleHelpGuide,
  isFocusReaderActive,
  onToggleFocusReader,
  isAudioEnabled,
  onToggleAudio,
  onDismiss,
}: MemoryLabHeaderProps) {
  return (
    <>
      <header className="ml-head">
        <div className="ml-title">STUDY MEMORY</div>
        <div className="ml-sub">
          YOUR JOURNAL · {memoryCount} MEMORIES · STORED ON THIS COMPUTER
        </div>
      </header>

      <div className="ml-corner">
        <button
          type="button"
          className={`ml-help-toggle ${isHelpGuideVisible ? "ml-on" : ""}`}
          onClick={onToggleHelpGuide}
          aria-expanded={isHelpGuideVisible}
          aria-label="How this screen works"
          title="How this screen works (?)"
        >
          ?
        </button>
        <button
          type="button"
          className={`ml-focus-toggle ${isFocusReaderActive ? "ml-on" : ""}`}
          onClick={onToggleFocusReader}
          aria-pressed={isFocusReaderActive}
          title={
            isFocusReaderActive
              ? "Bring the film texture back"
              : "Clear the film texture and sharpen the text for reading"
          }
        >
          <i aria-hidden>◎</i>
          FOCUS {isFocusReaderActive ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          className={`ml-sound ${isAudioEnabled ? "ml-on" : ""}`}
          onClick={onToggleAudio}
          aria-pressed={isAudioEnabled}
          title={isAudioEnabled ? "Turn the lab's sound off" : "Turn the lab's sound on"}
        >
          <i aria-hidden>
            <b />
            <b />
            <b />
            <b />
          </i>
          SOUND {isAudioEnabled ? "ON" : "OFF"}
        </button>
        <button type="button" className="ml-exit" onClick={onDismiss}>
          EXIT <span aria-hidden>✕</span>
        </button>
      </div>
    </>
  );
}
