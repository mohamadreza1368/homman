import { useEffect } from "react";

import { useBridgeStore } from "@/stores/bridgeStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

/**
 * Top bar status badge indicating that the IPC/Named Pipe control bridge is active
 * and listening for external viewport automation commands.
 */
export function BridgeIndicator() {
  const isBridgeActive = useBridgeStore((state) => state.status?.running ?? false);
  const triggerRefresh = useBridgeStore((state) => state.refresh);
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  useEffect(() => {
    void triggerRefresh();
  }, [triggerRefresh]);

  if (!isBridgeActive) {
    return null;
  }

  const badgeTooltip = isPersian
    ? "پل کنترلی هومان فعال است: برنامه‌ای در این رایانه می‌تواند نما را کنترل کند و پیام‌های خارجی را نمایش دهد. در تنظیمات می‌توانید آن را غیرفعال کنید."
    : "The control bridge is on: a program on this computer may control the view and display external, unsaved messages. Turn it off in Settings.";

  return (
    <span
      className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-sky-300"
      title={badgeTooltip}
    >
      {isPersian ? "پل کنترل" : "bridge"}
    </span>
  );
}
