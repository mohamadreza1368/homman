import { memo } from "react";
import { CONTROL_GUIDE_CATALOG } from "./memoryLabUtils";

export interface LabHelpProps {
  onClose: () => void;
}

export const LabHelp = memo(function LabHelp({ onClose }: LabHelpProps) {
  return (
    <section className="ml-panel ml-help" role="dialog" aria-label="How this screen works">
      <h3>
        HOW THIS SCREEN WORKS
        <button
          type="button"
          className="ml-expand"
          onClick={onClose}
          aria-label="Close the guide"
          title="Close (Esc)"
        >
          ✕
        </button>
      </h3>
      <div className="ml-help-body">
        {CONTROL_GUIDE_CATALOG.map((section) => (
          <div key={section.title} className="ml-help-group">
            <h4>{section.title}</h4>
            <dl>
              {section.items.map(([shortcut, description]) => (
                <div key={shortcut}>
                  <dt>{shortcut}</dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <p className="ml-help-foot">
          Everything here is read from this computer; nothing is sent anywhere.
        </p>
      </div>
    </section>
  );
});
