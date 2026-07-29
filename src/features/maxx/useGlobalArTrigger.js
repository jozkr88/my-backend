import { useEffect } from "react";

export function useGlobalArTrigger(callback, label) {
  useEffect(() => {
    window.__triggerAR = () => {
      console.log(`🎙️ Voice → launching AR via ${label}`);
      callback();
    };

    return () => {
      delete window.__triggerAR;
    };
  }, [callback, label]);
}
