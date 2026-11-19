import { useEffect, useState } from "react";

import { onStorageFailure, storageFailure } from "@/lib/localStore";
import { useInterfaceLanguage } from "@/stores/interfaceLanguage";

/**
 * Diagnostic banner informing user if browser storage permissions block persistent state saving.
 */
export function StorageNotice() {
  const [activeFailure, setActiveFailure] = useState(storageFailure);
  const isPersian = useInterfaceLanguage((state) => state.language === "fa");

  useEffect(() => {
    setActiveFailure(storageFailure());
    return onStorageFailure(() => setActiveFailure(storageFailure()));
  }, []);

  if (activeFailure === null) return null;

  return (
    <p
      title={activeFailure}
      className="shrink-0 border-t border-amber-700/50 bg-amber-500/10 px-4 py-2 text-[10px] leading-snug text-amber-300"
    >
      {isPersian
        ? "این دستگاه اجازه ذخیره تنظیمات را به هومان نمی‌دهد. تنظیمات مدل، سامانه‌ها و چیدمان شما در اجرای بعدی به حالت پیش‌فرض باز خواهند گشت. یادداشت‌ها و کلیدهای API تحت تأثیر قرار نمی‌گیرند و در جای دیگری نگهداری می‌شوند."
        : "This machine is not letting HOOMAAN remember anything. Your provider, model, systems and layout will be back to their defaults next time you open it. Your notes and your API keys are unaffected — those are kept elsewhere."}
    </p>
  );
}
