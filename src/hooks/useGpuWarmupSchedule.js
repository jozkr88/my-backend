import { useEffect, useState } from "react";

export function useGpuWarmupSchedule({ isInitialLoading }) {
  const [shouldWarmup, setShouldWarmup] = useState(false);

  useEffect(() => {
    if (isInitialLoading) {
      return undefined;
    }

    let idleHandle;
    let timeoutHandle;

    const enableWarmup = () => {
      setShouldWarmup(true);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleHandle = window.requestIdleCallback(enableWarmup, { timeout: 3000 });
    } else {
      timeoutHandle = window.setTimeout(enableWarmup, 1500);
    }

    return () => {
      if (typeof window !== "undefined" && idleHandle) {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [isInitialLoading]);

  return shouldWarmup;
}
