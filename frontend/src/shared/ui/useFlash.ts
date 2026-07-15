import { useEffect, useState } from "react";
import type { FlashMessage } from "./Shell";

export function useFlash() {
  const [flash, setFlash] = useState<FlashMessage | null>(null);

  useEffect(() => {
    if (!flash || flash.tone === "error") {
      return;
    }
    const timeout = window.setTimeout(() => setFlash(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [flash]);

  return {
    flash,
    dismissFlash: () => setFlash(null),
    showFlash: (message: string, tone: FlashMessage["tone"] = "info") => {
      setFlash({ message, tone });
    },
  };
}
